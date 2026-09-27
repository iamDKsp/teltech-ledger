import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import { db, whatsappAuthKeysTable, whatsappConnectionsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

function sessionKey(): Buffer {
  const configured = process.env.WHATSAPP_SESSION_KEY?.trim();
  if (!configured) throw new Error("WHATSAPP_SESSION_KEY não configurada");
  const key = /^[\da-fA-F]{64}$/.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (key.length !== 32) {
    throw new Error("WHATSAPP_SESSION_KEY deve conter 32 bytes (64 caracteres hex ou base64)");
  }
  return key;
}

export function isWhatsAppEncryptionConfigured(): boolean {
  try {
    sessionKey();
    return true;
  } catch {
    return false;
  }
}

function encrypt(workspaceId: string, label: string, value: unknown): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), nonce);
  cipher.setAAD(Buffer.from(`${workspaceId}:${label}`));
  const plaintext = Buffer.from(JSON.stringify(value, BufferJSON.replacer));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return `v1:${nonce.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decrypt(workspaceId: string, label: string, ciphertext: string): any {
  const [version, nonce, tag, encrypted] = ciphertext.split(":");
  if (version !== "v1" || !nonce || !tag || !encrypted) throw new Error("Formato de sessão inválido");
  const decipher = createDecipheriv("aes-256-gcm", sessionKey(), Buffer.from(nonce, "base64url"));
  decipher.setAAD(Buffer.from(`${workspaceId}:${label}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"), BufferJSON.reviver);
}

// Baileys updates Signal keys during sends and receives. Each set call is fully
// committed before it resolves, so a process restart can restore the session.
export async function useEncryptedDbAuthState(workspaceId: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  sessionKey();
  const [saved] = await db.select({ credsCiphertext: whatsappConnectionsTable.credsCiphertext })
    .from(whatsappConnectionsTable)
    .where(eq(whatsappConnectionsTable.workspaceId, workspaceId))
    .limit(1);
  const creds = saved?.credsCiphertext
    ? decrypt(workspaceId, "creds", saved.credsCiphertext)
    : initAuthCreds();

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const result: { [id: string]: SignalDataTypeMap[T] } = {};
        if (!ids.length) return result;
        const rows = await db.select({ keyId: whatsappAuthKeysTable.keyId, value: whatsappAuthKeysTable.valueCiphertext })
          .from(whatsappAuthKeysTable)
          .where(and(
            eq(whatsappAuthKeysTable.workspaceId, workspaceId),
            eq(whatsappAuthKeysTable.keyType, type),
            inArray(whatsappAuthKeysTable.keyId, ids),
          ));
        for (const row of rows) {
          let value = decrypt(workspaceId, `${type}:${row.keyId}`, row.value);
          if (type === "app-state-sync-key") {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          result[row.keyId] = value;
        }
        return result;
      },
      set: async (data: SignalDataSet) => {
        await db.transaction(async (tx) => {
          for (const [keyType, entries] of Object.entries(data)) {
            for (const [keyId, value] of Object.entries(entries ?? {})) {
              const where = and(
                eq(whatsappAuthKeysTable.workspaceId, workspaceId),
                eq(whatsappAuthKeysTable.keyType, keyType),
                eq(whatsappAuthKeysTable.keyId, keyId),
              );
              if (value == null) {
                await tx.delete(whatsappAuthKeysTable).where(where);
              } else {
                const valueCiphertext = encrypt(workspaceId, `${keyType}:${keyId}`, value);
                await tx.insert(whatsappAuthKeysTable).values({ workspaceId, keyType, keyId, valueCiphertext })
                  .onConflictDoUpdate({
                    target: [whatsappAuthKeysTable.workspaceId, whatsappAuthKeysTable.keyType, whatsappAuthKeysTable.keyId],
                    set: { valueCiphertext },
                  });
              }
            }
          }
        });
      },
    },
  };

  let saveInFlight = Promise.resolve();
  const saveCreds = () => {
    saveInFlight = saveInFlight.catch(() => undefined).then(async () => {
      const credsCiphertext = encrypt(workspaceId, "creds", creds);
      await db.insert(whatsappConnectionsTable)
        .values({ workspaceId, credsCiphertext, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: whatsappConnectionsTable.workspaceId,
          set: { credsCiphertext, updatedAt: new Date() },
        });
    });
    return saveInFlight;
  };
  return { state, saveCreds };
}

export async function clearWhatsAppAuth(workspaceId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(whatsappAuthKeysTable).where(eq(whatsappAuthKeysTable.workspaceId, workspaceId));
    await tx.delete(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.workspaceId, workspaceId));
  });
}
