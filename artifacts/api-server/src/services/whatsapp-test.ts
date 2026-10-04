import { randomUUID } from "node:crypto";
import { db, whatsappMessagesTable, whatsappSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { composePreview, persona, saoPauloNow, storedBody, type ComposedMessage } from "./whatsapp-compose";
import { checkWhatsAppNumber, sendWhatsAppMessage, type SendOutcome } from "./whatsapp-session";
import { greeting, type TemplateKind } from "./whatsapp-templates";

export type TestKind = TemplateKind | "connection";

export class TestSendError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const COOLDOWN_MS = 4_000;
const lastTestAt = new Map<string, number>();

export interface TestSendResult {
  phone: string;
  mode: SendOutcome["mode"];
  fallbackReason?: string;
  latencyMs: number;
  waMessageId: string | null;
  messageId: string;
}

/**
 * Sends a real message immediately (no queue) so the user can confirm the
 * connected number works and see how a template looks on a phone.
 */
export async function sendTestMessage(
  workspaceId: string,
  input: { kind: TestKind; phone: string; recipientName?: string },
): Promise<TestSendResult> {
  const previous = lastTestAt.get(workspaceId) ?? 0;
  if (Date.now() - previous < COOLDOWN_MS) {
    throw new TestSendError("Aguarde alguns segundos antes de enviar outro teste", 429);
  }
  lastTestAt.set(workspaceId, Date.now());

  const [settings] = await db.select().from(whatsappSettingsTable)
    .where(eq(whatsappSettingsTable.workspaceId, workspaceId)).limit(1);

  let target;
  try {
    target = await checkWhatsAppNumber(workspaceId, input.phone);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Falha ao verificar o número";
    throw new TestSendError(reason, reason === "WhatsApp não conectado" ? 409 : 400);
  }
  if (!target.exists) throw new TestSendError("Este número não possui WhatsApp", 422);

  const { assistant, company } = persona(settings);
  const composed: ComposedMessage = input.kind === "connection"
    ? {
      templateKind: "payment_receipt",
      text: [
        `${greeting(saoPauloNow().hour)}! Aqui é o *${assistant}*, assistente da *${company}* 🤖`,
        "",
        "✅ *Teste de conexão concluído!*",
        "Se você está lendo esta mensagem, o WhatsApp da empresa está conectado e pronto para enviar cobranças e avisos.",
      ].join("\n"),
    }
    : (() => {
      const preview = composePreview(input.kind, settings, { recipientName: input.recipientName });
      return { ...preview, text: `🧪 _Mensagem de teste, com dados fictícios._\n\n${preview.text}` };
    })();

  const messageId = randomUUID();
  const started = Date.now();
  let outcome: SendOutcome;
  try {
    outcome = await sendWhatsAppMessage(workspaceId, target.phone, composed, messageId, target.jid);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Falha no envio";
    throw new TestSendError(reason, reason === "WhatsApp não conectado" ? 409 : 502);
  }
  const latencyMs = Date.now() - started;

  await db.insert(whatsappMessagesTable).values({
    workspaceId,
    transactionId: null,
    clientId: null,
    dedupeKey: `${workspaceId}:test:${messageId}`,
    kind: "test_message",
    recipient: target.phone,
    body: storedBody(composed),
    status: "sent",
    attempts: 1,
    sentAt: new Date(),
    waMessageId: outcome.waMessageId,
    lastError: outcome.fallbackReason ? `Botão de Pix indisponível; enviado como texto (${outcome.fallbackReason})`.slice(0, 500) : null,
  });

  return {
    phone: target.phone,
    mode: outcome.mode,
    fallbackReason: outcome.fallbackReason,
    latencyMs,
    waMessageId: outcome.waMessageId,
    messageId,
  };
}
