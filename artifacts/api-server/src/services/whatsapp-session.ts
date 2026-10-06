import { randomUUID } from "node:crypto";
import makeWASocket, { DisconnectReason, generateWAMessageFromContent, proto, type WASocket } from "@whiskeysockets/baileys";
import { db, clientsTable, financialTransactionsTable, whatsappConnectionsTable, whatsappMessagesTable } from "@workspace/db";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
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
  connectedAt: number | null;
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

export function extractMessageText(message: any): string | null {
  if (!message) return null;
  if (typeof message.conversation === "string" && message.conversation.trim()) return message.conversation.trim();
  if (typeof message.extendedTextMessage?.text === "string" && message.extendedTextMessage.text.trim()) return message.extendedTextMessage.text.trim();
  if (typeof message.buttonsResponseMessage?.selectedDisplayText === "string") return message.buttonsResponseMessage.selectedDisplayText.trim();
  if (typeof message.templateButtonReplyMessage?.selectedDisplayText === "string") return message.templateButtonReplyMessage.selectedDisplayText.trim();
  if (typeof message.listResponseMessage?.title === "string") return message.listResponseMessage.title.trim();
  if (typeof message.imageMessage?.caption === "string") return message.imageMessage.caption.trim();
  if (typeof message.documentMessage?.caption === "string") return message.documentMessage.caption.trim();
  return null;
}

async function processIncomingMessages(workspaceId: string, session: Session, messages: any[]): Promise<void> {
  for (const item of messages) {
    if (item.key?.fromMe) continue;
    const jid: string | undefined = item.key?.remoteJidAlt?.endsWith("@s.whatsapp.net")
      ? item.key.remoteJidAlt
      : item.key?.remoteJid;
    if (!jid?.endsWith("@s.whatsapp.net")) continue;
    const text = extractMessageText(item.message);
    if (!text) continue;
    const sender = normalizeWhatsAppPhone(jid.split("@")[0]);
    if (!sender) continue;

    try {
      const clients = await db.select({
        id: clientsTable.id,
        name: clientsTable.name,
        phone: clientsTable.phone,
      }).from(clientsTable).where(eq(clientsTable.workspaceId, workspaceId));

      const matchingClient = clients.find((c) => normalizeWhatsAppPhone(c.phone) === sender);

      let transactionId: string | null = null;
      if (matchingClient) {
        const [latestTx] = await db.select({ id: financialTransactionsTable.id })
          .from(financialTransactionsTable)
          .where(and(eq(financialTransactionsTable.workspaceId, workspaceId), eq(financialTransactionsTable.clientId, matchingClient.id)))
          .orderBy(desc(financialTransactionsTable.dueDate))
          .limit(1);
        transactionId = latestTx?.id ?? null;
      }

      const dedupeKey = `inbound:${workspaceId}:${item.key?.id || `${sender}_${Date.now()}`}`;
      const sentAt = item.messageTimestamp
        ? new Date(Number(item.messageTimestamp) * 1000)
        : new Date();

      await db.insert(whatsappMessagesTable).values({
        workspaceId,
        clientId: matchingClient?.id ?? null,
        transactionId,
        dedupeKey,
        kind: "client_reply",
        recipient: session.phone ?? "Nexus",
        senderPhone: sender,
        senderName: matchingClient?.name ?? item.pushName ?? "Cliente",
        direction: "inbound",
        body: text,
        status: "received",
        isRead: false,
        sentAt,
        waMessageId: item.key?.id ?? null,
      }).onConflictDoNothing();

      logger.info({ workspaceId, sender, clientName: matchingClient?.name }, "WhatsApp incoming message recorded from client");
    } catch (err) {
      logger.error({ err, workspaceId, sender }, "Failed to persist WhatsApp incoming message");
    }
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
    connectedAt: null,
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
    void processIncomingMessages(workspaceId, session, messages).catch((error) => {
      logger.error({ err: error, workspaceId }, "WhatsApp incoming message processing failed");
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
      session.connectedAt = Date.now();
      session.lastError = null;
      session.reconnectAttempt = 0;
      logger.info({ workspaceId }, "WhatsApp connected");
    } else if (update.connection === "close") {
      session.status = "disconnected";
      session.qr = null;
      session.connectedAt = null;
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
  connectedAt: string | null;
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
    connectedAt: session?.connectedAt ? new Date(session.connectedAt).toISOString() : null,
    lastError: session?.lastError ?? null,
  };
}

function connectedSession(workspaceId: string): Session {
  const session = sessions.get(workspaceId);
  if (!session || session.status !== "connected") throw new Error("WhatsApp não conectado");
  return session;
}

function stableMessageId(messageId: string): string {
  return messageId.replace(/-/g, "").toUpperCase();
}

export async function sendWhatsAppText(workspaceId: string, recipient: string, body: string, messageId: string): Promise<string | null> {
  const session = connectedSession(workspaceId);
  const phone = normalizeWhatsAppPhone(recipient);
  if (!phone) throw new Error("Telefone de destino inválido");
  const result = await session.socket.sendMessage(`${phone}@s.whatsapp.net`, { text: body }, {
    messageId: stableMessageId(messageId),
  });
  return result?.key?.id ?? null;
}

/** Confirma se o número tem WhatsApp e devolve o JID real (trata o 9º dígito brasileiro). */
export async function checkWhatsAppNumber(workspaceId: string, recipient: string): Promise<{
  phone: string;
  exists: boolean;
  jid: string | null;
}> {
  const session = connectedSession(workspaceId);
  const phone = normalizeWhatsAppPhone(recipient);
  if (!phone) throw new Error("Telefone de destino inválido");
  const [result] = (await session.socket.onWhatsApp(phone)) ?? [];
  return { phone, exists: Boolean(result?.exists), jid: result?.exists ? result.jid : null };
}

export interface PixAttachment {
  /** Pix Copia e Cola (BR Code). */
  code: string;
  /** Chave no formato aceito pelo BR Code (celular com +55). */
  key: string;
  /** CPF | CNPJ | EMAIL | PHONE | EVP */
  keyType: string;
  merchantName: string;
  amountCents: number;
  reference: string;
  description: string;
}

export interface OutboundMessage {
  text: string;
  footer?: string;
  /** Texto usado quando o botão nativo falha ou o modo é "texto". */
  fallbackText?: string;
  pix?: PixAttachment;
  pixMode?: "native" | "text";
}

export interface SendOutcome {
  waMessageId: string | null;
  /** plain = só texto; native = botão de Pix; text_with_code = texto + código Copia e Cola. */
  mode: "plain" | "native" | "text_with_code";
  fallbackReason?: string;
}

function withFooter(text: string, footer?: string): string {
  return footer ? `${text}\n\n_${footer}_` : text;
}

async function sendNativePix(session: Session, jid: string, message: OutboundMessage & { pix: PixAttachment }, messageId: string): Promise<string | null> {
  const { pix } = message;
  const money = (value: number) => ({ value, offset: 100 });
  const buttonParams = {
    reference_id: pix.reference.slice(0, 35),
    type: "digital-goods",
    payment_configuration: "",
    payment_type: "br",
    currency: "BRL",
    total_amount: money(pix.amountCents),
    order: {
      status: "pending",
      subtotal: money(pix.amountCents),
      tax: money(0),
      items: [{
        retailer_id: pix.reference.slice(0, 35),
        name: pix.description.slice(0, 60) || "Pagamento",
        amount: money(pix.amountCents),
        quantity: 1,
      }],
    },
    payment_settings: [{
      type: "pix_dynamic_code",
      pix_dynamic_code: {
        code: pix.code,
        merchant_name: pix.merchantName,
        key: pix.key,
        key_type: pix.keyType,
      },
    }],
  };
  const content = proto.Message.create({
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: proto.Message.InteractiveMessage.create({
          body: { text: message.text },
          ...(message.footer ? { footer: { text: message.footer } } : {}),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: [{ name: "review_and_pay", buttonParamsJson: JSON.stringify(buttonParams) }],
            messageParamsJson: "",
          }),
        }),
      },
    },
  });
  const userJid = session.socket.user?.id;
  if (!userJid) throw new Error("Sessão sem usuário");
  const generated = generateWAMessageFromContent(jid, content, { userJid, messageId });
  await session.socket.relayMessage(jid, generated.message!, {
    messageId: generated.key.id!,
    additionalNodes: [
      {
        tag: "biz",
        attrs: {},
        content: [{
          tag: "interactive",
          attrs: { type: "native_flow", v: "1" },
          content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }],
        }],
      },
      { tag: "bot", attrs: { biz_bot: "1" } },
    ],
  });
  return generated.key.id ?? null;
}

/**
 * Envia uma mensagem completa. Com Pix:
 *  - modo "native": tenta o botão de Pix do WhatsApp e, se falhar, cai para texto + código;
 *  - modo "text": envia o texto e, logo depois, só o código Copia e Cola (fácil de copiar).
 * `jid` opcional permite usar o JID já confirmado por checkWhatsAppNumber.
 */
export async function sendWhatsAppMessage(
  workspaceId: string,
  recipient: string,
  message: OutboundMessage,
  messageId: string,
  jid?: string | null,
): Promise<SendOutcome> {
  const session = connectedSession(workspaceId);
  const phone = normalizeWhatsAppPhone(recipient);
  if (!phone) throw new Error("Telefone de destino inválido");
  const target = jid ?? `${phone}@s.whatsapp.net`;
  const id = stableMessageId(messageId);

  let fallbackReason: string | undefined;
  if (message.pix && message.pixMode === "native") {
    try {
      const waMessageId = await sendNativePix(session, target, { ...message, pix: message.pix }, id);
      return { waMessageId, mode: "native" };
    } catch (error) {
      fallbackReason = error instanceof Error ? error.message : "Falha no botão de Pix";
      logger.warn({ workspaceId, reason: fallbackReason }, "WhatsApp native Pix failed; falling back to text");
    }
  }

  const text = withFooter(message.pix && message.pixMode === "native" ? (message.fallbackText ?? message.text) : message.text, message.footer);
  const sent = await session.socket.sendMessage(target, { text }, { messageId: id });
  if (!message.pix) return { waMessageId: sent?.key?.id ?? null, mode: "plain" };
  await session.socket.sendMessage(target, { text: message.pix.code }, { messageId: `${id.slice(0, 28)}C0DE` });
  return { waMessageId: sent?.key?.id ?? null, mode: "text_with_code", fallbackReason };
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

export async function sendManualTextMessage(
  workspaceId: string,
  recipient: string,
  text: string,
  options?: { clientId?: string | null; transactionId?: string | null; senderName?: string }
): Promise<typeof whatsappMessagesTable.$inferSelect> {
  const session = connectedSession(workspaceId);
  const phone = normalizeWhatsAppPhone(recipient);
  if (!phone) throw new Error("Telefone de destino inválido");

  const messageId = randomUUID();
  const id = stableMessageId(messageId);
  const target = `${phone}@s.whatsapp.net`;

  const sent = await session.socket.sendMessage(target, { text }, { messageId: id });
  const waMessageId = sent?.key?.id ?? null;

  const [created] = await db.insert(whatsappMessagesTable).values({
    id: messageId,
    workspaceId,
    clientId: options?.clientId ?? null,
    transactionId: options?.transactionId ?? null,
    dedupeKey: `manual:${workspaceId}:${messageId}`,
    kind: "manual_chat",
    recipient: phone,
    senderPhone: session.phone ?? null,
    senderName: options?.senderName ?? "Nexus",
    direction: "outbound",
    body: text,
    status: "sent",
    isRead: true,
    sentAt: new Date(),
    waMessageId,
  }).returning();

  return created;
}

