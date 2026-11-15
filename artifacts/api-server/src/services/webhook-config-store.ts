import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db, projectsTable } from "@workspace/db";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  readWebhookIntegrations,
  WebhookError,
  type WebhookIntegration,
} from "./inbound-webhook-contract";

let schemaReadyPromise: Promise<void> | null = null;

function deriveKey(): Buffer {
  const raw =
    process.env.WHATSAPP_SESSION_KEY ||
    process.env.JWT_SECRET ||
    "teltech-webhook-config-encryption-key";
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptWebhookSecret(plainSecret: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainSecret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptWebhookSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato inválido de segredo criptografado.");
  }
  const [ivHex, tagHex, encHex] = parts;
  const key = deriveKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export async function ensureWebhookConfigsSchema(): Promise<void> {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS inbound_webhook_configs (
          source VARCHAR(60) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          secret_encrypted TEXT NOT NULL,
          workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,
          photo_allowed_hosts JSONB,
          enabled BOOLEAN NOT NULL DEFAULT true,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    } catch (err) {
      schemaReadyPromise = null;
      throw err;
    }
  })();
  return schemaReadyPromise;
}

export async function loadActiveWebhookIntegrations(): Promise<WebhookIntegration[]> {
  let envConfigs: WebhookIntegration[] = [];
  try {
    envConfigs = readWebhookIntegrations();
  } catch (err) {
    if (process.env.INBOUND_WEBHOOK_INTEGRATIONS?.trim()) {
      throw err;
    }
  }

  const bySource = new Map<string, WebhookIntegration>();
  for (const cfg of envConfigs) {
    bySource.set(cfg.source, cfg);
  }

  try {
    await ensureWebhookConfigsSchema();
    const res: any = await db.execute(sql`
      SELECT source, name, secret_encrypted, workspace_id, project_id, account_id, photo_allowed_hosts
      FROM inbound_webhook_configs
      WHERE enabled = true
    `);
    const rows: any[] = Array.isArray(res) ? res : (res?.rows ?? []);
    for (const row of rows) {
      const source = String(row.source || "").trim();
      if (!source || bySource.has(source)) continue;
      try {
        const secret = decryptWebhookSecret(String(row.secret_encrypted || ""));
        if (secret.length < 32) continue;
        bySource.set(source, {
          source,
          name: String(row.name || source),
          secret,
          workspaceId: String(row.workspace_id),
          projectId: String(row.project_id),
          accountId: row.account_id ? String(row.account_id) : null,
          photoAllowedHosts: Array.isArray(row.photo_allowed_hosts)
            ? row.photo_allowed_hosts
            : undefined,
        });
      } catch {
        // Ignore row if encryption key changed; operator can re-save secret in UI.
      }
    }
  } catch {
    // Fallback gracefully to env integrations if DB table is not reachable yet.
  }

  return Array.from(bySource.values());
}

export async function upsertDbWebhookIntegration(params: {
  workspaceId: string;
  userId: string;
  source: string;
  name: string;
  secret: string;
  projectId?: string | null;
  accountId?: string | null;
}) {
  const source = params.source.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(source)) {
    throw new WebhookError(
      422,
      "invalid_source",
      "Identificador source inválido (use apenas letras minúsculas, números, _ ou -).",
    );
  }
  const name = params.name.trim().slice(0, 100);
  if (!name) {
    throw new WebhookError(422, "invalid_name", "Informe o nome do produto/sistema.");
  }
  const secret = params.secret.trim();
  if (secret.length < 32 || secret.length > 512) {
    throw new WebhookError(
      422,
      "invalid_secret",
      "O segredo HMAC deve ter no mínimo 32 caracteres.",
    );
  }

  await ensureWebhookConfigsSchema();

  let projectId = params.projectId?.trim() || "";
  if (!projectId) {
    const workspaceProjects = await db
      .select({ id: projectsTable.id, name: projectsTable.name })
      .from(projectsTable)
      .where(eq(projectsTable.workspaceId, params.workspaceId))
      .orderBy(asc(projectsTable.createdAt));

    const matchByName = workspaceProjects.find(
      (p) => p.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (matchByName) {
      projectId = matchByName.id;
    } else if (workspaceProjects.length > 0) {
      projectId = workspaceProjects[0].id;
    } else {
      const [created] = await db
        .insert(projectsTable)
        .values({
          workspaceId: params.workspaceId,
          name,
          color: "#7C5AC2",
          status: "Em andamento",
          createdBy: params.userId,
        })
        .returning({ id: projectsTable.id });
      projectId = created.id;
    }
  } else {
    const [existingProj] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.id, projectId),
          eq(projectsTable.workspaceId, params.workspaceId),
        ),
      )
      .limit(1);
    if (!existingProj) {
      throw new WebhookError(404, "project_not_found", "Projeto não encontrado neste workspace.");
    }
  }

  const encrypted = encryptWebhookSecret(secret);
  const accountId = params.accountId?.trim() || null;

  await db.execute(sql`
    INSERT INTO inbound_webhook_configs (
      source, name, secret_encrypted, workspace_id, project_id, account_id, enabled, updated_at
    ) VALUES (
      ${source}, ${name}, ${encrypted}, ${params.workspaceId}::uuid, ${projectId}::uuid, ${accountId}::uuid, true, NOW()
    )
    ON CONFLICT (source) DO UPDATE SET
      name = EXCLUDED.name,
      secret_encrypted = EXCLUDED.secret_encrypted,
      workspace_id = EXCLUDED.workspace_id,
      project_id = EXCLUDED.project_id,
      account_id = COALESCE(EXCLUDED.account_id, inbound_webhook_configs.account_id),
      enabled = true,
      updated_at = NOW();
  `);

  return {
    source,
    name,
    workspaceId: params.workspaceId,
    projectId,
    accountId,
    secretPreview: `${secret.slice(0, 4)}••••••${secret.slice(-4)}`,
  };
}
