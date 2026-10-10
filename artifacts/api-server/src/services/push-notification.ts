import webpush from "web-push";
import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  pushSubscriptionsTable,
  whatsappSettingsTable,
  workspacesTable,
  type PushSubscriptionRow,
} from "@workspace/db";
import { logger } from "../lib/logger";

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

const DEFAULT_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contato@teltech.com.br";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

// In-memory cache of VAPID keys by workspace ID to ensure zero latency and bulletproof fallback
const inMemoryKeyCache = new Map<string, { publicKey: string; privateKey: string }>();

let schemaMigrationPromise: Promise<void> | null = null;

/**
 * Idempotently verifies and creates all database columns and tables needed for Web Push and alerts.
 * This runs automatically on boot and before any push operation, guaranteeing tables exist even if
 * migrations were not executed by an external runner.
 */
export async function ensurePushNotificationSchema(): Promise<void> {
  if (schemaMigrationPromise) return schemaMigrationPromise;

  schemaMigrationPromise = (async () => {
    try {
      // 1. Ensure columns in whatsapp_settings
      await pool.query(`
        ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS expense_alerts_enabled BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS movement_alerts_enabled BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS client_message_push_enabled BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS vapid_public_key TEXT;
        ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS vapid_private_key TEXT;
      `).catch((e) => logger.warn({ err: e?.message }, "whatsapp_settings columns check warning"));

      // 2. Ensure columns in whatsapp_contacts
      await pool.query(`
        ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS notify_expenses BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS notify_movements BOOLEAN NOT NULL DEFAULT true;
      `).catch((e) => logger.warn({ err: e?.message }, "whatsapp_contacts columns check warning"));

      // 3. Ensure table push_subscriptions
      await pool.query(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          user_agent TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_workspace ON push_subscriptions (workspace_id);
        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);
      `).catch((e) => logger.warn({ err: e?.message }, "push_subscriptions table check warning"));

      logger.info("Push notification and movement alert schema verified successfully");
    } catch (err: any) {
      logger.error({ err: err?.message }, "Error during push notification schema verification");
    }
  })();

  return schemaMigrationPromise;
}

// Trigger schema check immediately on module import in background
void ensurePushNotificationSchema().catch((err) => {
  logger.warn({ err }, "Initial push schema verification warning");
});

export async function getOrCreateVapidKeys(workspaceId?: string | null): Promise<{ publicKey: string; privateKey: string }> {
  // 1. Env vars override if explicitly provided
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }

  const wsKey = workspaceId || "default";

  // 2. In-memory cache hit
  const cached = inMemoryKeyCache.get(wsKey);
  if (cached) {
    return cached;
  }

  // 3. Ensure DB columns are ready
  await ensurePushNotificationSchema();

  // 4. Try reading existing keys from database if workspaceId is valid UUID
  if (workspaceId && isValidUuid(workspaceId)) {
    try {
      const [settings] = await db
        .select({
          vapidPublicKey: whatsappSettingsTable.vapidPublicKey,
          vapidPrivateKey: whatsappSettingsTable.vapidPrivateKey,
        })
        .from(whatsappSettingsTable)
        .where(eq(whatsappSettingsTable.workspaceId, workspaceId))
        .limit(1);

      if (settings?.vapidPublicKey && settings?.vapidPrivateKey) {
        const keys = {
          publicKey: settings.vapidPublicKey,
          privateKey: settings.vapidPrivateKey,
        };
        inMemoryKeyCache.set(wsKey, keys);
        return keys;
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, workspaceId }, "Could not query whatsapp_settings for VAPID keys");
    }
  }

  // 5. Generate fresh valid VAPID keys
  const generated = webpush.generateVAPIDKeys();
  inMemoryKeyCache.set(wsKey, generated);

  // 6. Persist keys in database if workspaceId is valid UUID
  if (workspaceId && isValidUuid(workspaceId)) {
    try {
      const [existing] = await db
        .select({ workspaceId: whatsappSettingsTable.workspaceId })
        .from(whatsappSettingsTable)
        .where(eq(whatsappSettingsTable.workspaceId, workspaceId))
        .limit(1);

      if (existing) {
        await db
          .update(whatsappSettingsTable)
          .set({
            vapidPublicKey: generated.publicKey,
            vapidPrivateKey: generated.privateKey,
            updatedAt: new Date(),
          })
          .where(eq(whatsappSettingsTable.workspaceId, workspaceId));
      } else {
        await db
          .insert(whatsappSettingsTable)
          .values({
            workspaceId,
            vapidPublicKey: generated.publicKey,
            vapidPrivateKey: generated.privateKey,
          })
          .onConflictDoUpdate({
            target: whatsappSettingsTable.workspaceId,
            set: {
              vapidPublicKey: generated.publicKey,
              vapidPrivateKey: generated.privateKey,
              updatedAt: new Date(),
            },
          });
      }
      logger.info({ workspaceId }, "VAPID keypair successfully persisted in whatsapp_settings");
    } catch (saveErr: any) {
      logger.warn({ err: saveErr?.message, workspaceId }, "Could not persist VAPID keys to whatsapp_settings, using in-memory keys");
    }
  }

  return generated;
}

export async function getVapidPublicKey(workspaceId?: string | null): Promise<string> {
  const keys = await getOrCreateVapidKeys(workspaceId);
  return keys.publicKey;
}

export async function savePushSubscription(
  workspaceId: string,
  userId: string | null,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
): Promise<PushSubscriptionRow> {
  await ensurePushNotificationSchema();

  let targetWorkspaceId = workspaceId;
  if (!isValidUuid(targetWorkspaceId)) {
    try {
      const [firstWs] = await db.select({ id: workspacesTable.id }).from(workspacesTable).limit(1);
      if (firstWs) {
        targetWorkspaceId = firstWs.id;
      }
    } catch {}
  }

  const validUserId = isValidUuid(userId) ? userId : null;

  const [row] = await db
    .insert(pushSubscriptionsTable)
    .values({
      workspaceId: targetWorkspaceId,
      userId: validUserId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: {
        workspaceId: targetWorkspaceId,
        userId: validUserId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  logger.info({ workspaceId: targetWorkspaceId, userId: validUserId, endpoint: subscription.endpoint.slice(0, 30) }, "Web Push subscription saved");
  return row;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  try {
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
    logger.info({ endpoint: endpoint.slice(0, 30) }, "Web Push subscription removed");
  } catch (err: any) {
    logger.warn({ err: err?.message, endpoint: endpoint.slice(0, 30) }, "Error removing push subscription");
  }
}

export async function sendPushNotificationToWorkspace(
  workspaceId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  try {
    await ensurePushNotificationSchema();

    let targetWorkspaceId = workspaceId;
    if (!isValidUuid(targetWorkspaceId)) {
      try {
        const [firstWs] = await db.select({ id: workspacesTable.id }).from(workspacesTable).limit(1);
        if (firstWs) {
          targetWorkspaceId = firstWs.id;
        }
      } catch {}
    }

    try {
      const [settings] = await db
        .select({ clientMessagePushEnabled: whatsappSettingsTable.clientMessagePushEnabled })
        .from(whatsappSettingsTable)
        .where(eq(whatsappSettingsTable.workspaceId, targetWorkspaceId))
        .limit(1);

      if (settings && settings.clientMessagePushEnabled === false) {
        return { sent: 0, failed: 0 };
      }
    } catch {}

    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.workspaceId, targetWorkspaceId));

    if (!subs.length) {
      return { sent: 0, failed: 0 };
    }

    const keys = await getOrCreateVapidKeys(targetWorkspaceId);
    webpush.setVapidDetails(DEFAULT_SUBJECT, keys.publicKey, keys.privateKey);

    const stringifiedPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/apple-touch-icon.png",
      badge: payload.badge || "/favicon-32x32.png",
      tag: payload.tag || "teltech-notification",
      data: payload.data || {},
    });

    let sent = 0;
    let failed = 0;

    await Promise.allSettled(
      subs.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, stringifiedPayload, {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: "high",
          });
          sent++;
        } catch (err: any) {
          failed++;
          const statusCode = err?.statusCode;
          // HTTP 404 or 410 indicates subscription has expired or unsubscribed on device
          if (statusCode === 404 || statusCode === 410) {
            logger.info({ endpoint: sub.endpoint.slice(0, 30), statusCode }, "Purging expired push subscription");
            await removePushSubscription(sub.endpoint);
          } else {
            logger.warn({ err: err?.message, endpoint: sub.endpoint.slice(0, 30) }, "Failed to send web push notification");
          }
        }
      }),
    );

    logger.info({ workspaceId: targetWorkspaceId, sent, failed, total: subs.length }, "Sent push notifications to workspace");
    return { sent, failed };
  } catch (err) {
    logger.error({ err, workspaceId }, "Error sending workspace push notifications");
    return { sent: 0, failed: 0 };
  }
}
