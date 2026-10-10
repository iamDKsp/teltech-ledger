import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import makeWASocket, {
  DisconnectReason,
  generateWAMessageFromContent,
  proto,
  type WASocket,
  downloadMediaMessage,
  downloadContentFromMessage,
} from "@whiskeysockets/baileys";
import { db, clientsTable, financialTransactionsTable, whatsappConnectionsTable, whatsappMessagesTable, whatsappContactsTable, usersTable, workspaceMembersTable } from "@workspace/db";
import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import pino from "pino";
import QRCode from "qrcode";
import { logger } from "../lib/logger";
import {
  clearWhatsAppAuth,
  isWhatsAppEncryptionConfigured,
  useEncryptedDbAuthState,
} from "./whatsapp-auth";
import { sendPushNotificationToWorkspace } from "./push-notification";

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
  const beforeAt = raw.split("@")[0].split(":")[0];
  const trimmed = beforeAt.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+") && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }
  if (digits.length < 10 || digits.length > 15 || digits.startsWith("0")) return null;
  return digits;
}

/**
 * Canonical Brazilian phone representation:
 * Handles 8-digit vs 9-digit Brazilian mobile numbers.
 * E.g., '551497603870' (12 digits) and '5514997603870' (13 digits)
 * both resolve canonically to '5514997603870'.
 */
export function canonicalBrazilianPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = normalizeWhatsAppPhone(raw);
  if (!normalized) return null;

  if (normalized.startsWith("55") && normalized.length === 12) {
    const ddd = normalized.slice(2, 4);
    const localNumber = normalized.slice(4);
    // If local number starts with 6, 7, 8, or 9, it's a mobile missing the 9 digit
    if (/^[6-9]/.test(localNumber)) {
      return `55${ddd}9${localNumber}`;
    }
  }
  return normalized;
}

/**
 * Checks whether two phone numbers refer to the exact same WhatsApp contact,
 * factoring in Brazilian 9th digit variations and country codes.
 */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const canA = canonicalBrazilianPhone(a);
  const canB = canonicalBrazilianPhone(b);
  if (canA && canB && canA === canB) return true;

  const normA = normalizeWhatsAppPhone(a);
  const normB = normalizeWhatsAppPhone(b);
  if (normA && normB && normA === normB) return true;

  const digA = a.replace(/\D/g, "");
  const digB = b.replace(/\D/g, "");
  if (digA && digB && (digA === digB || digA.endsWith(digB) || digB.endsWith(digA))) {
    return true;
  }
  return false;
}

/**
 * Resolves the destination JID by consulting WhatsApp servers through onWhatsApp.
 * Checks the exact number and automatically tests the 8-digit / 9-digit variation for Brazil.
 */
export async function resolveDestinationJid(session: Session, phone: string): Promise<string> {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) throw new Error("Telefone de destino inválido");

  try {
    const [result] = (await session.socket.onWhatsApp(normalized).catch(() => [])) ?? [];
    if (result?.exists && result.jid) {
      return result.jid;
    }

    // If Brazilian 13 digits (with 9), try 12 digits (without 9)
    if (normalized.startsWith("55") && normalized.length === 13) {
      const without9 = `55${normalized.slice(2, 4)}${normalized.slice(5)}`;
      const [alt] = (await session.socket.onWhatsApp(without9).catch(() => [])) ?? [];
      if (alt?.exists && alt.jid) {
        return alt.jid;
      }
    }

    // If Brazilian 12 digits (without 9), try 13 digits (with 9)
    if (normalized.startsWith("55") && normalized.length === 12) {
      const with9 = `55${normalized.slice(2, 4)}9${normalized.slice(4)}`;
      const [alt] = (await session.socket.onWhatsApp(with9).catch(() => [])) ?? [];
      if (alt?.exists && alt.jid) {
        return alt.jid;
      }
    }
  } catch (err) {
    logger.warn({ err, phone: normalized }, "Falha ao verificar onWhatsApp; usando JID padrão");
  }

  return `${normalized}@s.whatsapp.net`;
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
    const ids = clients.filter((client) => phonesMatch(client.phone, sender)).map((client) => client.id);
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

export function unwrapMessage(msg: any): any {
  if (!msg) return msg;
  if (msg.ephemeralMessage?.message) return unwrapMessage(msg.ephemeralMessage.message);
  if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);
  if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);
  if (msg.viewOnceMessageV2Extension?.message) return unwrapMessage(msg.viewOnceMessageV2Extension.message);
  if (msg.documentWithCaptionMessage?.message) return unwrapMessage(msg.documentWithCaptionMessage.message);
  return msg;
}

export function extractMessageMediaInfo(rawMessage: any): {
  type: "image" | "audio" | "video" | "document" | null;
  mimetype: string | null;
  filename: string | null;
  caption: string | null;
  seconds: number | null;
  fileLength: number | null;
} {
  if (!rawMessage) return { type: null, mimetype: null, filename: null, caption: null, seconds: null, fileLength: null };
  const message = unwrapMessage(rawMessage);
  if (!message) return { type: null, mimetype: null, filename: null, caption: null, seconds: null, fileLength: null };

  if (message.imageMessage) {
    return {
      type: "image",
      mimetype: message.imageMessage.mimetype || "image/jpeg",
      filename: null,
      caption: message.imageMessage.caption?.trim() || null,
      seconds: null,
      fileLength: message.imageMessage.fileLength ? Number(message.imageMessage.fileLength) : null,
    };
  }
  if (message.audioMessage) {
    return {
      type: "audio",
      mimetype: message.audioMessage.mimetype || "audio/ogg; codecs=opus",
      filename: null,
      caption: null,
      seconds: message.audioMessage.seconds ? Number(message.audioMessage.seconds) : null,
      fileLength: message.audioMessage.fileLength ? Number(message.audioMessage.fileLength) : null,
    };
  }
  if (message.videoMessage) {
    return {
      type: "video",
      mimetype: message.videoMessage.mimetype || "video/mp4",
      filename: null,
      caption: message.videoMessage.caption?.trim() || null,
      seconds: message.videoMessage.seconds ? Number(message.videoMessage.seconds) : null,
      fileLength: message.videoMessage.fileLength ? Number(message.videoMessage.fileLength) : null,
    };
  }
  if (message.documentMessage) {
    const fn = message.documentMessage.fileName || "documento";
    return {
      type: "document",
      mimetype: message.documentMessage.mimetype || "application/octet-stream",
      filename: fn,
      caption: message.documentMessage.caption?.trim() || null,
      seconds: null,
      fileLength: message.documentMessage.fileLength ? Number(message.documentMessage.fileLength) : null,
    };
  }
  return { type: null, mimetype: null, filename: null, caption: null, seconds: null, fileLength: null };
}

export function extractMessageText(rawMessage: any): string | null {
  if (!rawMessage) return null;
  const message = unwrapMessage(rawMessage);
  if (!message) return null;

  if (typeof message.conversation === "string" && message.conversation.trim()) {
    return message.conversation.trim();
  }
  if (typeof message.extendedTextMessage?.text === "string" && message.extendedTextMessage.text.trim()) {
    return message.extendedTextMessage.text.trim();
  }
  if (typeof message.buttonsResponseMessage?.selectedDisplayText === "string") {
    return message.buttonsResponseMessage.selectedDisplayText.trim();
  }
  if (typeof message.templateButtonReplyMessage?.selectedDisplayText === "string") {
    return message.templateButtonReplyMessage.selectedDisplayText.trim();
  }
  if (typeof message.listResponseMessage?.title === "string") {
    return message.listResponseMessage.title.trim();
  }
  if (typeof message.imageMessage?.caption === "string" && message.imageMessage.caption.trim()) {
    return `📷 [Imagem]: ${message.imageMessage.caption.trim()}`;
  }
  if (message.imageMessage) {
    return "📷 [Imagem / Foto]";
  }
  if (typeof message.documentMessage?.caption === "string" && message.documentMessage.caption.trim()) {
    const fn = message.documentMessage.fileName || "Documento";
    return `📄 [Documento: ${fn}] ${message.documentMessage.caption.trim()}`;
  }
  if (message.documentMessage) {
    const filename = message.documentMessage.fileName || "Documento";
    return `📄 [Documento: ${filename}]`;
  }
  if (message.audioMessage) {
    const sec = message.audioMessage.seconds ? ` (${message.audioMessage.seconds}s)` : "";
    return `🎵 [Mensagem de Áudio${sec}]`;
  }
  if (message.videoMessage) {
    const caption = message.videoMessage.caption ? `: ${message.videoMessage.caption.trim()}` : "";
    return `🎥 [Vídeo${caption}]`;
  }
  if (message.stickerMessage) {
    return "💟 [Figurinha]";
  }
  if (message.contactMessage) {
    return "👤 [Contato]";
  }
  if (message.locationMessage) {
    return "📍 [Localização]";
  }
  return null;
}

export async function downloadAndStoreMedia(
  workspaceId: string,
  session: Session,
  item: any,
  mediaInfo: ReturnType<typeof extractMessageMediaInfo>
): Promise<{
  mediaUrl: string | null;
  mediaType: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  mediaSize: number | null;
  mediaDuration: number | null;
}> {
  if (!mediaInfo.type) {
    return {
      mediaUrl: null,
      mediaType: null,
      mediaMimeType: null,
      mediaFilename: null,
      mediaSize: null,
      mediaDuration: null,
    };
  }

  const message = unwrapMessage(item.message);
  let ext = "bin";
  if (mediaInfo.type === "image") {
    ext = mediaInfo.mimetype?.includes("png") ? "png" : (mediaInfo.mimetype?.includes("webp") ? "webp" : "jpg");
  } else if (mediaInfo.type === "audio") {
    ext = mediaInfo.mimetype?.includes("mp4") ? "m4a" : "ogg";
  } else if (mediaInfo.type === "video") {
    ext = "mp4";
  } else if (mediaInfo.type === "document") {
    if (mediaInfo.filename && mediaInfo.filename.includes(".")) {
      ext = mediaInfo.filename.split(".").pop() || "bin";
    } else if (mediaInfo.mimetype?.includes("pdf")) {
      ext = "pdf";
    }
  }

  const waId = item.key?.id || randomUUID();
  const safeFilename = mediaInfo.filename || `${mediaInfo.type}_${waId.slice(0, 8)}.${ext}`;
  const diskFilename = `${waId}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "whatsapp-media", workspaceId);
  const diskPath = path.join(uploadDir, diskFilename);

  let buffer: Buffer | null = null;

  try {
    await fs.mkdir(uploadDir, { recursive: true });

    // Try downloading via Baileys downloadMediaMessage
    try {
      buffer = (await downloadMediaMessage(
        item,
        "buffer",
        {},
        {
          logger: baileysLogger,
          reuploadRequest: session.socket.updateMediaMessage,
        }
      )) as Buffer;
    } catch {
      // Fallback via downloadContentFromMessage
      const mediaMsg = message?.imageMessage || message?.audioMessage || message?.videoMessage || message?.documentMessage;
      if (mediaMsg) {
        const stream = await downloadContentFromMessage(mediaMsg, mediaInfo.type as any);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(chunk);
        buffer = Buffer.concat(chunks);
      }
    }

    if (buffer && buffer.length > 0) {
      await fs.writeFile(diskPath, buffer);
      return {
        mediaUrl: `/uploads/whatsapp-media/${workspaceId}/${diskFilename}`,
        mediaType: mediaInfo.type,
        mediaMimeType: mediaInfo.mimetype,
        mediaFilename: safeFilename,
        mediaSize: buffer.length,
        mediaDuration: mediaInfo.seconds,
      };
    }
  } catch (err) {
    logger.warn({ err, workspaceId, waId }, "Could not download WhatsApp media buffer");
  }

  return {
    mediaUrl: null,
    mediaType: mediaInfo.type,
    mediaMimeType: mediaInfo.mimetype,
    mediaFilename: safeFilename,
    mediaSize: mediaInfo.fileLength,
    mediaDuration: mediaInfo.seconds,
  };
}

async function processIncomingMessages(workspaceId: string, session: Session, messages: any[]): Promise<void> {
  for (const item of messages) {
    // Determine counterparty JID from all available Baileys key fields
    const rawJid = item.key?.remoteJidAlt || item.key?.participantPn || item.key?.remoteJid || item.key?.participant;
    if (!rawJid) continue;

    // Ignore group chats and status broadcasts
    if (rawJid.endsWith("@g.us") || rawJid.includes("status@broadcast")) continue;

    const jidClean = rawJid.split("@")[0].split(":")[0];
    const normalizedSender = normalizeWhatsAppPhone(jidClean);
    const canonicalSender = canonicalBrazilianPhone(jidClean) || normalizedSender;
    if (!normalizedSender && !canonicalSender) continue;

    const text = extractMessageText(item.message);
    if (!text) continue;

    const isFromMe = Boolean(item.key?.fromMe);

    // If outbound, check if already recorded by sendManualTextMessage or queue to prevent duplicates
    if (isFromMe && item.key?.id) {
      try {
        const [existing] = await db.select({ id: whatsappMessagesTable.id })
          .from(whatsappMessagesTable)
          .where(and(
            eq(whatsappMessagesTable.workspaceId, workspaceId),
            or(
              eq(whatsappMessagesTable.waMessageId, item.key.id),
              eq(whatsappMessagesTable.dedupeKey, `outbound:${workspaceId}:${item.key.id}`),
              eq(whatsappMessagesTable.dedupeKey, `manual:${workspaceId}:${item.key.id}`)
            )
          ))
          .limit(1);

        if (existing) {
          // Message already persisted when sent from web cockpit
          continue;
        }
      } catch (err) {
        logger.warn({ err, workspaceId, waId: item.key.id }, "Error checking existing message deduplication");
      }
    }

    try {
      const [clients, contacts, members] = await Promise.all([
        db.select({
          id: clientsTable.id,
          name: clientsTable.name,
          phone: clientsTable.phone,
          photoUrl: clientsTable.photoUrl,
        }).from(clientsTable).where(eq(clientsTable.workspaceId, workspaceId)),
        db.select({
          id: whatsappContactsTable.id,
          name: whatsappContactsTable.name,
          nickname: whatsappContactsTable.nickname,
          roleLabel: whatsappContactsTable.roleLabel,
          phone: whatsappContactsTable.phone,
          userId: whatsappContactsTable.userId,
        }).from(whatsappContactsTable).where(eq(whatsappContactsTable.workspaceId, workspaceId)),
        db.select({
          id: usersTable.id,
          name: usersTable.name,
          phone: usersTable.phone,
          avatarUrl: usersTable.avatarUrl,
          role: workspaceMembersTable.role,
        }).from(usersTable)
          .innerJoin(workspaceMembersTable, eq(usersTable.id, workspaceMembersTable.userId))
          .where(eq(workspaceMembersTable.workspaceId, workspaceId)),
      ]);

      const matchingContact = contacts.find(
        (c) => phonesMatch(c.phone, jidClean) || phonesMatch(c.phone, canonicalSender) || phonesMatch(c.phone, normalizedSender)
      );

      const matchingMember = !matchingContact ? members.find(
        (m) => phonesMatch(m.phone, jidClean) || phonesMatch(m.phone, canonicalSender) || phonesMatch(m.phone, normalizedSender)
      ) : null;

      const matchingClient = (!matchingContact && !matchingMember) ? clients.find(
        (c) => phonesMatch(c.phone, jidClean) || phonesMatch(c.phone, canonicalSender) || phonesMatch(c.phone, normalizedSender)
      ) : null;

      const isPartner = Boolean(matchingContact || matchingMember);
      const partnerName = matchingContact?.name || matchingMember?.name || null;

      let transactionId: string | null = null;
      if (matchingClient) {
        const [latestTx] = await db.select({ id: financialTransactionsTable.id })
          .from(financialTransactionsTable)
          .where(and(eq(financialTransactionsTable.workspaceId, workspaceId), eq(financialTransactionsTable.clientId, matchingClient.id)))
          .orderBy(desc(financialTransactionsTable.dueDate))
          .limit(1);
        transactionId = latestTx?.id ?? null;
      } else if (matchingContact?.userId || matchingMember?.id) {
        const partnerUserId = matchingContact?.userId || matchingMember?.id;
        if (partnerUserId) {
          const [latestTx] = await db.select({ id: financialTransactionsTable.id })
            .from(financialTransactionsTable)
            .where(and(eq(financialTransactionsTable.workspaceId, workspaceId), eq(financialTransactionsTable.partnerId, partnerUserId)))
            .orderBy(desc(financialTransactionsTable.dueDate))
            .limit(1);
          transactionId = latestTx?.id ?? null;
        }
      }

      const dedupeKey = `${isFromMe ? "outbound" : "inbound"}:${workspaceId}:${item.key?.id || `${jidClean}_${Date.now()}`}`;
      const sentAt = item.messageTimestamp
        ? new Date(Number(item.messageTimestamp) * 1000)
        : new Date();

      const mediaInfo = extractMessageMediaInfo(item.message);
      const mediaResult = await downloadAndStoreMedia(workspaceId, session, item, mediaInfo);

      if (isFromMe) {
        // Record outbound messages sent from physical mobile phone
        await db.insert(whatsappMessagesTable).values({
          workspaceId,
          clientId: matchingClient?.id ?? null,
          transactionId,
          dedupeKey,
          kind: "manual_chat",
          recipient: canonicalSender || normalizedSender || jidClean,
          senderPhone: session.phone ?? null,
          senderName: "Operador (Celular)",
          direction: "outbound",
          body: text,
          mediaType: mediaResult.mediaType,
          mediaUrl: mediaResult.mediaUrl,
          mediaMimeType: mediaResult.mediaMimeType,
          mediaFilename: mediaResult.mediaFilename,
          mediaSize: mediaResult.mediaSize,
          mediaDuration: mediaResult.mediaDuration,
          status: "sent",
          isRead: true,
          sentAt,
          waMessageId: item.key?.id ?? null,
        }).onConflictDoNothing();
      } else {
        // Record inbound messages from client or partner
        const resolvedSenderName = partnerName ?? matchingClient?.name ?? item.pushName ?? (isPartner ? "Sócio" : "Cliente");
        await db.insert(whatsappMessagesTable).values({
          workspaceId,
          clientId: matchingClient?.id ?? null,
          transactionId,
          dedupeKey,
          kind: isPartner ? "partner_reply" : "client_reply",
          recipient: session.phone ?? "Nexus",
          senderPhone: canonicalSender || normalizedSender || jidClean,
          senderName: resolvedSenderName,
          direction: "inbound",
          body: text,
          mediaType: mediaResult.mediaType,
          mediaUrl: mediaResult.mediaUrl,
          mediaMimeType: mediaResult.mediaMimeType,
          mediaFilename: mediaResult.mediaFilename,
          mediaSize: mediaResult.mediaSize,
          mediaDuration: mediaResult.mediaDuration,
          status: "received",
          isRead: false,
          sentAt,
          waMessageId: item.key?.id ?? null,
        }).onConflictDoNothing();

        logger.info({
          workspaceId,
          sender: canonicalSender || jidClean,
          contactName: resolvedSenderName,
          isPartner,
          mediaType: mediaResult.mediaType,
          body: text.slice(0, 50),
        }, "WhatsApp incoming message recorded");

        const cleanSender = canonicalSender || normalizedSender || jidClean;
        let previewText = text?.trim() || "";
        if (!previewText && mediaResult.mediaType) {
          const mediaNames: Record<string, string> = {
            audio: "Mensagem de áudio 🎙️",
            image: "Foto enviada 📷",
            video: "Vídeo enviado 🎥",
            document: mediaResult.mediaFilename ? `Documento: ${mediaResult.mediaFilename} 📄` : "Documento / PDF 📄",
          };
          previewText = mediaNames[mediaResult.mediaType] || "Arquivo de mídia recebido";
        }
        if (previewText.length > 120) {
          previewText = previewText.slice(0, 117) + "...";
        }

        // Selecionar foto do contato/cliente caso cadastrado, ou fallback para ícone do sistema
        const contactPhoto = matchingClient?.photoUrl || matchingMember?.avatarUrl || "/apple-touch-icon.png";

        // Enviar notificação push imediata para os celulares (iPhone/Android) e navegadores inscritos
        void sendPushNotificationToWorkspace(workspaceId, {
          title: resolvedSenderName,
          body: previewText,
          icon: contactPhoto,
          badge: "/favicon-32x32.png",
          tag: `wa-${cleanSender}`,
          data: {
            url: `/monitoramento?phone=${encodeURIComponent(cleanSender)}`,
            senderPhone: cleanSender,
            senderName: resolvedSenderName,
            isPartner,
            type: "whatsapp_incoming",
          },
        }).catch((pushErr) => {
          logger.warn({ pushErr, workspaceId }, "Falha ao disparar push notification de mensagem recebida");
        });
      }
    } catch (err) {
      logger.error({ err, workspaceId, jidClean }, "Failed to persist WhatsApp message from messages.upsert");
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
  const target = jid ?? (await resolveDestinationJid(session, phone));
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
  const target = await resolveDestinationJid(session, phone);

  const sent = await session.socket.sendMessage(target, { text }, { messageId: id });
  const waMessageId = sent?.key?.id ?? id;

  const dedupeKey = `outbound:${workspaceId}:${waMessageId}`;

  const [created] = await db.insert(whatsappMessagesTable).values({
    id: messageId,
    workspaceId,
    clientId: options?.clientId ?? null,
    transactionId: options?.transactionId ?? null,
    dedupeKey,
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
  }).onConflictDoNothing().returning();

  if (!created) {
    const [existing] = await db.select().from(whatsappMessagesTable)
      .where(and(eq(whatsappMessagesTable.workspaceId, workspaceId), eq(whatsappMessagesTable.waMessageId, waMessageId)))
      .limit(1);
    if (existing) return existing;
  }

  return created;
}

export async function sendManualMediaMessage(
  workspaceId: string,
  recipient: string,
  media: {
    buffer: Buffer;
    mimetype: string;
    filename?: string;
    caption?: string;
    mediaType: "image" | "audio" | "video" | "document";
  },
  options?: { clientId?: string | null; transactionId?: string | null; senderName?: string }
): Promise<typeof whatsappMessagesTable.$inferSelect> {
  const session = connectedSession(workspaceId);
  const phone = normalizeWhatsAppPhone(recipient);
  if (!phone) throw new Error("Telefone de destino inválido");

  const messageId = randomUUID();
  const id = stableMessageId(messageId);
  const target = await resolveDestinationJid(session, phone);

  // Save to public/uploads/whatsapp-media/${workspaceId}
  const uploadDir = path.join(process.cwd(), "public", "uploads", "whatsapp-media", workspaceId);
  await fs.mkdir(uploadDir, { recursive: true });

  let ext = "bin";
  if (media.mediaType === "image") {
    ext = media.mimetype.includes("png") ? "png" : (media.mimetype.includes("webp") ? "webp" : "jpg");
  } else if (media.mediaType === "audio") {
    ext = media.mimetype.includes("mp4") ? "m4a" : "ogg";
  } else if (media.mediaType === "video") {
    ext = "mp4";
  } else if (media.mediaType === "document") {
    if (media.filename && media.filename.includes(".")) {
      ext = media.filename.split(".").pop() || "bin";
    } else if (media.mimetype.includes("pdf")) {
      ext = "pdf";
    }
  }

  const diskFilename = `${id}.${ext}`;
  const diskPath = path.join(uploadDir, diskFilename);
  await fs.writeFile(diskPath, media.buffer);
  const mediaUrl = `/uploads/whatsapp-media/${workspaceId}/${diskFilename}`;

  let sent: any;
  if (media.mediaType === "image") {
    sent = await session.socket.sendMessage(target, {
      image: media.buffer,
      caption: media.caption || undefined,
      mimetype: media.mimetype,
    }, { messageId: id });
  } else if (media.mediaType === "audio") {
    sent = await session.socket.sendMessage(target, {
      audio: media.buffer,
      mimetype: media.mimetype || "audio/mp4",
      ptt: true,
    }, { messageId: id });
  } else if (media.mediaType === "video") {
    sent = await session.socket.sendMessage(target, {
      video: media.buffer,
      caption: media.caption || undefined,
      mimetype: media.mimetype || "video/mp4",
    }, { messageId: id });
  } else {
    sent = await session.socket.sendMessage(target, {
      document: media.buffer,
      mimetype: media.mimetype,
      fileName: media.filename || "documento.pdf",
      caption: media.caption || undefined,
    }, { messageId: id });
  }

  const waMessageId = sent?.key?.id ?? id;
  const dedupeKey = `outbound:${workspaceId}:${waMessageId}`;

  let body = media.caption || "";
  if (!body) {
    if (media.mediaType === "image") body = "📷 [Imagem / Foto]";
    else if (media.mediaType === "audio") body = "🎵 [Mensagem de Áudio]";
    else if (media.mediaType === "video") body = "🎥 [Vídeo]";
    else body = `📄 [Documento: ${media.filename || "arquivo"}]`;
  }

  const [created] = await db.insert(whatsappMessagesTable).values({
    id: messageId,
    workspaceId,
    clientId: options?.clientId ?? null,
    transactionId: options?.transactionId ?? null,
    dedupeKey,
    kind: "manual_chat",
    recipient: phone,
    senderPhone: session.phone ?? null,
    senderName: options?.senderName ?? "Operador (Celular)",
    direction: "outbound",
    body,
    mediaType: media.mediaType,
    mediaUrl,
    mediaMimeType: media.mimetype,
    mediaFilename: media.filename || diskFilename,
    mediaSize: media.buffer.length,
    status: "sent",
    isRead: true,
    sentAt: new Date(),
    waMessageId,
  }).onConflictDoNothing().returning();

  if (!created) {
    const [existing] = await db.select().from(whatsappMessagesTable)
      .where(and(eq(whatsappMessagesTable.workspaceId, workspaceId), eq(whatsappMessagesTable.waMessageId, waMessageId)))
      .limit(1);
    if (existing) return existing;
  }

  return created!;
}

