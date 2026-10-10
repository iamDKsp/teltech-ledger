import webpush from "web-push";
import { and, eq } from "drizzle-orm";
import {
  db,
  pushSubscriptionsTable,
  whatsappSettingsTable,
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

export async function getOrCreateVapidKeys(workspaceId: string): Promise<{ publicKey: string; privateKey: string }> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }

  const [settings] = await db
    .select({
      vapidPublicKey: whatsappSettingsTable.vapidPublicKey,
      vapidPrivateKey: whatsappSettingsTable.vapidPrivateKey,
    })
    .from(whatsappSettingsTable)
    .where(eq(whatsappSettingsTable.workspaceId, workspaceId))
    .limit(1);

  if (settings?.vapidPublicKey && settings?.vapidPrivateKey) {
    return {
      publicKey: settings.vapidPublicKey,
      privateKey: settings.vapidPrivateKey,
    };
  }

  // Generate a fresh, valid VAPID keypair
  const generated = webpush.generateVAPIDKeys();

  if (settings) {
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

  return generated;
}

export async function getVapidPublicKey(workspaceId: string): Promise<string> {
  const keys = await getOrCreateVapidKeys(workspaceId);
  return keys.publicKey;
}

export async function savePushSubscription(
  workspaceId: string,
  userId: string | null,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
): Promise<PushSubscriptionRow> {
  const [row] = await db
    .insert(pushSubscriptionsTable)
    .values({
      workspaceId,
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: {
        workspaceId,
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  logger.info({ workspaceId, userId, endpoint: subscription.endpoint.slice(0, 30) }, "Web Push subscription saved");
  return row;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
  logger.info({ endpoint: endpoint.slice(0, 30) }, "Web Push subscription removed");
}

export async function sendPushNotificationToWorkspace(
  workspaceId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  try {
    const [settings] = await db
      .select({ clientMessagePushEnabled: whatsappSettingsTable.clientMessagePushEnabled })
      .from(whatsappSettingsTable)
      .where(eq(whatsappSettingsTable.workspaceId, workspaceId))
      .limit(1);

    if (settings && settings.clientMessagePushEnabled === false) {
      return { sent: 0, failed: 0 };
    }

    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.workspaceId, workspaceId));

    if (!subs.length) {
      return { sent: 0, failed: 0 };
    }

    const keys = await getOrCreateVapidKeys(workspaceId);
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

    const results = await Promise.allSettled(
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

    logger.info({ workspaceId, sent, failed, total: subs.length }, "Sent push notifications to workspace");
    return { sent, failed };
  } catch (err) {
    logger.error({ err, workspaceId }, "Error sending workspace push notifications");
    return { sent: 0, failed: 0 };
  }
}
