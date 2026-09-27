import makeWASocket, { DisconnectReason, type WASocket } from "@whiskeysockets/baileys";
import { db, clientsTable, whatsappConnectionsTable, whatsappMessagesTable } from "@workspace/db";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import pino from "pino";
import QRCode from "qrcode";
import { logger } from "../lib/logger";
import {
  clearWhatsAppAuth,
  isWhatsAppEncryptionConfigured,
  useEncryptedDbAuthState,
} from "./whatsapp-auth";

type SessionStatus = "connecting" | "qr" | "connected" | "disconnected" | "logged_out" | "error";
type Session = {
  socket: WASocket;
  status: SessionStatus;
  qr: string | null;
  phone: string | null;
  lastError: string | null;
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  stopped: boolean;
  flushCreds: () => Promise<void>;
};

const sessions = new Map<string, Session>();
const connecting = new Map<string, Promise<void>>();
const finalizing = new Map<string, Promise<void>>();
const baileysLogger = pino({ level: "error" });

/** Returns a normalized E.164 number without +. Brazilian local numbers get 55. */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+") && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }
  if (digits.length < 12 || digits.length > 15 || digits.startsWith("0")) return null;
  return digits;
}

/** Parses and normalizes a list of phone numbers separated by comma, semicolon, space or line break */
export function normalizeWhatsAppPhoneList(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = raw.split(/[,;\n\r\t]+/).map(p => p.trim()).filter(Boolean);
  const normalized = parts.map(p => normalizeWhatsAppPhone(p)).filter((p): p is string => Boolean(p));
  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique.join(", ") : null;
}

function isStopMessage(text: string): boolean {
  const command = text.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.!?]+$/g, "").toUpperCase();
  return ["PARAR", "SAIR", "STOP", "CANCELAR"].includes(command);
}

async function processOptOut(workspaceId: string, messages: any[]): Promise<void> {
  for (const item of messages) {
    if (item.key?.fromMe) continue;
    const jid: string | undefined = item.key?.remoteJidAlt?.endsWith("@s.whatsapp.net")
      ? item.key.remoteJidAlt
      : item.key?.remoteJid;
    if (!jid?.endsWith("@s.whatsapp.net")) continue;
    const text = item.message?.conversation ?? item.message?.extendedTextMessage?.text;
    if (typeof text !== "string" || !isStopMessage(text)) continue;
    const sender = normalizeWhatsAppPhone(jid.split("@")[0]);
    if (!sender) continue;
    const clients = await db.select({ id: clientsTable.id, phone: clientsTable.phone })
      .from(clientsTable)
      .where(and(eq(clientsTable.workspaceId, workspaceId), eq(clientsTable.whatsappOptIn, true)));
    const ids = clients.filter((client) => normalizeWhatsAppPhone(client.phone) === sender).map((client) => client.id);
    if (!ids.length) continue;
    await db.transaction(async (tx) => {
      await tx.update(clientsTable)
        .set({ whatsappOptIn: false, whatsappOptInAt: null, updatedAt: new Date() })
        .where(and(eq(clientsTable.workspaceId, workspaceId), inArray(clientsTable.id, ids)));
      await tx.update(whatsappMessagesTable)
        .set({ status: "skipped", lastError: "Cliente solicitou parar mensagens", updatedAt: new Date() })
        .where(and(eq(whatsappMessagesTable.workspaceId, workspaceId), inArray(whatsappMessagesTable.clientId, ids),
          inArray(whatsappMessagesTable.status, ["queued", "retry"])));
    });
    logger.info({ workspaceId, clients: ids.length }, "WhatsApp opt-out recorded");
  }
}

function disconnectedReason(error: unknown): number | undefined {
  return (error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
}

function scheduleReconnect(workspaceId: string, session: Session): void {
  if (session.stopped || sessions.get(workspaceId) !== session) return;
  const delay = Math.min(300_000, 5_000 * 2 ** Math.min(session.reconnectAttempt, 6));
  session.reconnectAttempt += 1;
  session.reconnectTimer = setTimeout(() => {
    if (sessions.get(workspaceId) !== session || session.stopped) return;
    sessions.delete(workspaceId);
    void connectWhatsApp(workspaceId).catch((error) => {
      logger.error({ err: error, workspaceId }, "WhatsApp reconnect failed");
    });
  }, delay);
  session.reconnectTimer.unref?.();
}

async function createSocket(workspaceId: string): Promise<void> {
  await finalizing.get(workspaceId);
  if (!isWhatsAppEncryptionConfigured()) throw new Error("WHATSAPP_SESSION_KEY não configurada ou inválida");
  const existing = sessions.get(workspaceId);
  if (existing && ["connecting", "qr", "connected"].includes(existing.status)) return;
  if (existing?.reconnectTimer) clearTimeout(existing.reconnectTimer);
  await existing?.socket.end(undefined).catch(() => undefined);

  const { state, saveCreds } = await useEncryptedDbAuthState(workspaceId);
  const socket = makeWASocket({
    auth: state,
    logger: baileysLogger,
    browser: ["Teltech Ledger", "Chrome", "1.0.0"],
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  const session: Session = {
    socket,
    status: "connecting",
    qr: null,
    phone: null,
    lastError: null,
    reconnectAttempt: existing?.reconnectAttempt ?? 0,
    reconnectTimer: null,
    stopped: false,
    flushCreds: saveCreds,
  };
  sessions.set(workspaceId, session);

  socket.ev.on("creds.update", () => {
    if (sessions.get(workspaceId) !== session || session.stopped) return;
    void saveCreds().catch((error) => {
      session.lastError = "Falha ao persistir sessão";
      logger.error({ err: error, workspaceId }, "WhatsApp credentials persistence failed");
    });
  });

  socket.ev.on("messages.upsert", ({ messages }) => {
    if (sessions.get(workspaceId) !== session || session.stopped) return;
    void processOptOut(workspaceId, messages).catch((error) => {
      logger.error({ err: error, workspaceId }, "WhatsApp opt-out processing failed");
    });
  });

  socket.ev.on("connection.update", (update) => {
    if (sessions.get(workspaceId) !== session || session.stopped) return;
    if (update.qr) {
      session.status = "qr";
      const qr = update.qr;
      void QRCode.toDataURL(qr, { margin: 1, width: 320 }).then((dataUrl) => {
        if (sessions.get(workspaceId) === session && session.status === "qr") session.qr = dataUrl;
      }).catch((error) => {
        session.lastError = "Falha ao gerar QR";
        logger.error({ err: error, workspaceId }, "WhatsApp QR rendering failed");
      });
    }
    if (update.connection === "open") {
      session.status = "connected";
      session.qr = null;
      session.phone = socket.user?.id?.split(":")[0]?.split("@")[0] ?? null;
      session.lastError = null;
      session.reconnectAttempt = 0;
      logger.info({ workspaceId }, "WhatsApp connected");
    } else if (update.connection === "close") {
      session.status = "disconnected";
      session.qr = null;
      const reason = disconnectedReason(update.lastDisconnect?.error);
      session.lastError = reason ? `Conexão encerrada (${reason})` : "Conexão encerrada";
      if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
        session.status = "logged_out";
        session.stopped = true;
        const cleanup = (async () => {
          await session.flushCreds().catch((error) => {
            logger.error({ err: error, workspaceId }, "WhatsApp credential flush failed");
          });
          await clearWhatsAppAuth(workspaceId);
        })();
        finalizing.set(workspaceId, cleanup);
        void cleanup.catch((error) => {
          logger.error({ err: error, workspaceId }, "WhatsApp revoked session cleanup failed");
        }).finally(() => {
          if (finalizing.get(workspaceId) === cleanup) finalizing.delete(workspaceId);
        });
      } else {
        scheduleReconnect(workspaceId, session);
      }
      logger.warn({ workspaceId, reason }, "WhatsApp disconnected");
    }
  });
}

export function connectWhatsApp(workspaceId: string): Promise<void> {
  const inFlight = connecting.get(workspaceId);
  if (inFlight) return inFlight;
  const promise = createSocket(workspaceId).finally(() => {
    if (connecting.get(workspaceId) === promise) connecting.delete(workspaceId);
  });
  connecting.set(workspaceId, promise);
  return promise;
}

export async function disconnectWhatsApp(workspaceId: string): Promise<void> {
  await connecting.get(workspaceId)?.catch(() => undefined);
  await finalizing.get(workspaceId)?.catch(() => undefined);
  const session = sessions.get(workspaceId);
  if (session) {
    session.stopped = true;
    if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
    sessions.delete(workspaceId);
    try {
      await Promise.race([
        session.socket.logout(),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch (error) {
      logger.warn({ err: error, workspaceId }, "WhatsApp logout request failed");
    }
    await session.socket.end(undefined).catch(() => undefined);
    await session.flushCreds().catch((error) => {
      logger.error({ err: error, workspaceId }, "WhatsApp credential flush failed");
    });
  }
  await clearWhatsAppAuth(workspaceId);
}

export async function getWhatsAppStatus(workspaceId: string): Promise<{
  status: "connecting" | "qr" | "connected" | "disconnected";
  connected: boolean;
  configured: boolean;
  paired: boolean;
  qr: string | null;
  phone: string | null;
  lastError: string | null;
}> {
  const configured = isWhatsAppEncryptionConfigured();
  const session = sessions.get(workspaceId);
  const [stored] = await db.select({ credsCiphertext: whatsappConnectionsTable.credsCiphertext })
    .from(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.workspaceId, workspaceId)).limit(1);
  return {
    status: session && ["connecting", "qr", "connected"].includes(session.status)
      ? session.status as "connecting" | "qr" | "connected"
      : "disconnected",
    connected: session?.status === "connected",
    configured,
    paired: Boolean(stored?.credsCiphertext),
    qr: session?.qr ?? null,
    phone: session?.phone ?? null,
    lastError: session?.lastError ?? null,
  };
}

export async function sendWhatsAppText(workspaceId: string, recipient: string, body: string, messageId: string): Promise<string | null> {
  const session = sessions.get(workspaceId);
  if (!session || session.status !== "connected") throw new Error("WhatsApp não conectado");
  const phone = normalizeWhatsAppPhone(recipient);
  if (!phone) throw new Error("Telefone de destino inválido");
  const result = await session.socket.sendMessage(`${phone}@s.whatsapp.net`, { text: body }, {
    messageId: messageId.replace(/-/g, "").toUpperCase(),
  });
  return result?.key?.id ?? null;
}

export async function restoreWhatsAppSessions(): Promise<void> {
  if (!isWhatsAppEncryptionConfigured()) {
    logger.warn("WHATSAPP_SESSION_KEY missing; WhatsApp integration disabled");
    return;
  }
  const rows = await db.select({ workspaceId: whatsappConnectionsTable.workspaceId })
    .from(whatsappConnectionsTable)
    .where(isNotNull(whatsappConnectionsTable.credsCiphertext));
  for (const row of rows) {
    void connectWhatsApp(row.workspaceId).catch((error) => {
      logger.error({ err: error, workspaceId: row.workspaceId }, "WhatsApp session restore failed");
    });
  }
}

export async function stopWhatsAppSessions(): Promise<void> {
  const pending: Promise<unknown>[] = [];
  for (const session of sessions.values()) {
    session.stopped = true;
    if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
    pending.push(session.socket.end(undefined)
      .catch(() => undefined)
      .then(() => session.flushCreds().catch(() => undefined)));
  }
  sessions.clear();
  await Promise.all(pending);
}
