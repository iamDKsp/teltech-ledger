import {
  db,
  clientsTable,
  financialAccountsTable,
  financialTransactionsTable,
  usersTable,
  workspaceMembersTable,
  whatsappContactsTable,
  whatsappMessagesTable,
  whatsappSettingsTable,
  type FinancialTransaction,
  type WhatsappSettings,
} from "@workspace/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  normalizeWhatsAppPhone,
  restoreWhatsAppSessions,
  sendWhatsAppMessage,
  stopWhatsAppSessions,
  type OutboundMessage,
} from "./whatsapp-session";
import {
  composeBilling,
  composePaymentAlert,
  composeReceipt,
  composeWithdrawal,
  dayDifference,
  dueDay,
  saoPauloNow,
  storedBody,
  type BillingKind,
  type InternalRecipient,
} from "./whatsapp-compose";

const MAX_DAILY_MESSAGES_PER_WORKSPACE = 100;
const MAX_ATTEMPTS = 5;

export type { BillingKind };

async function loadBillingData(workspaceId: string, transactionId: string) {
  const [record] = await db.select({ transaction: financialTransactionsTable, client: clientsTable })
    .from(financialTransactionsTable)
    .leftJoin(clientsTable, eq(financialTransactionsTable.clientId, clientsTable.id))
    .where(and(eq(financialTransactionsTable.workspaceId, workspaceId), eq(financialTransactionsTable.id, transactionId)))
    .limit(1);
  return record ?? null;
}

async function loadSettings(exec: any, workspaceId: string): Promise<WhatsappSettings | undefined> {
  const [settings] = await exec.select().from(whatsappSettingsTable)
    .where(eq(whatsappSettingsTable.workspaceId, workspaceId)).limit(1);
  return settings;
}

type Topic = "withdrawals" | "payments";

/**
 * Internal people who should hear about a topic. Reads whatsapp_contacts; the
 * legacy comma-separated list is only used while no contact was registered yet.
 */
export async function internalRecipients(
  exec: any,
  workspaceId: string,
  settings: WhatsappSettings | undefined,
  topic: Topic,
): Promise<InternalRecipient[]> {
  const contacts: (typeof whatsappContactsTable.$inferSelect)[] = await exec.select().from(whatsappContactsTable)
    .where(eq(whatsappContactsTable.workspaceId, workspaceId));
  if (contacts.length === 0) {
    if (topic !== "withdrawals" || !settings?.internalAlertPhone) return [];
    const legacy = settings.internalAlertPhone.split(/[,;\n\r\t]+/)
      .map((value: string) => normalizeWhatsAppPhone(value.trim()))
      .filter((phone: string | null): phone is string => Boolean(phone));
    return Array.from(new Set(legacy)).map((phone) => ({ phone, name: "equipe", nickname: null, userId: null }));
  }
  const seen = new Set<string>();
  const recipients: InternalRecipient[] = [];
  for (const contact of contacts) {
    if (!contact.active) continue;
    if (topic === "withdrawals" ? !contact.notifyWithdrawals : !contact.notifyPayments) continue;
    const phone = normalizeWhatsAppPhone(contact.phone);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    recipients.push({ phone, name: contact.name, nickname: contact.nickname, userId: contact.userId });
  }
  return recipients;
}

export async function enqueueManualBilling(workspaceId: string, transactionId: string): Promise<{
  ok: boolean;
  reason?: string;
  conflict?: boolean;
  message?: typeof whatsappMessagesTable.$inferSelect;
  created?: boolean;
}> {
  const record = await loadBillingData(workspaceId, transactionId);
  if (!record) return { ok: false, reason: "Transação não encontrada" };
  const { transaction, client } = record;
  if (transaction.type !== "inflow" || transaction.status !== "pending") {
    return { ok: false, reason: "Somente parcelas a receber e pendentes podem ser cobradas" };
  }
  if (!client || client.workspaceId !== workspaceId || client.status !== "active" || !client.whatsappOptIn) {
    return { ok: false, reason: "Cliente sem consentimento ativo para WhatsApp" };
  }
  const recipient = normalizeWhatsAppPhone(client.phone);
  if (!recipient) return { ok: false, reason: "Telefone do cliente inválido" };
  const settings = await loadSettings(db, workspaceId);
  if (!settings?.pixKey?.trim()) return { ok: false, reason: "Configure a chave Pix antes de enviar cobranças" };
  const dedupeKey = `${workspaceId}:manual:${transactionId}:${saoPauloNow().date}`;
  const [inserted] = await db.insert(whatsappMessagesTable).values({
    workspaceId,
    transactionId,
    clientId: client.id,
    dedupeKey,
    kind: "manual_billing",
    recipient,
    body: storedBody(composeBilling("manual_billing", transaction, client, settings)),
  }).onConflictDoNothing().returning();
  const message = inserted ?? (await db.select().from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.dedupeKey, dedupeKey)).limit(1))[0];
  if (!inserted && message && ["failed", "skipped", "sent"].includes(message.status)) {
    const reason = message.status === "sent"
      ? "Cobrança já enviada hoje para esta parcela"
      : "Tentativa anterior não foi enviada; revise o histórico e tente novamente amanhã";
    return { ok: false, reason, conflict: true, message };
  }
  if (inserted) {
    triggerImmediateWorker();
  }
  return { ok: true, message, created: Boolean(inserted) };
}

/** Puts a failed or skipped message back in the outbox (it is revalidated before sending). */
export async function requeueMessage(workspaceId: string, messageId: string): Promise<{ ok: boolean; reason?: string }> {
  const [message] = await db.select().from(whatsappMessagesTable)
    .where(and(eq(whatsappMessagesTable.id, messageId), eq(whatsappMessagesTable.workspaceId, workspaceId))).limit(1);
  if (!message) return { ok: false, reason: "Mensagem não encontrada" };
  if (!["failed", "skipped"].includes(message.status)) {
    return { ok: false, reason: "Somente mensagens com falha ou ignoradas podem ser reenviadas" };
  }
  await db.update(whatsappMessagesTable).set({
    status: "queued",
    attempts: 0,
    nextAttemptAt: new Date(),
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(whatsappMessagesTable.id, message.id));
  return { ok: true };
}

// The caller invokes this inside the same financial DB transaction that records
// the paid withdrawal, ensuring the alert row cannot exist without the ledger row.
export async function enqueueWithdrawalAlert(
  tx: any,
  workspaceId: string,
  transaction: FinancialTransaction,
  actorUserId: string | null,
): Promise<void> {
  if (transaction.type !== "outflow" || transaction.costType !== "partner_withdrawal" || transaction.status !== "paid") return;
  const settings = await loadSettings(tx, workspaceId);
  if (!settings?.withdrawalAlertsEnabled) return;
  const recipients = await internalRecipients(tx, workspaceId, settings, "withdrawals");
  if (!recipients.length) return;

  const [partner] = transaction.partnerId
    ? await tx.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, transaction.partnerId)).limit(1)
    : [];
  const [account] = transaction.accountId
    ? await tx.select({ name: financialAccountsTable.name, currentBalance: financialAccountsTable.currentBalance })
      .from(financialAccountsTable)
      .where(and(eq(financialAccountsTable.id, transaction.accountId), eq(financialAccountsTable.workspaceId, workspaceId)))
      .limit(1)
    : [];
  const [actor] = actorUserId
    ? await tx.select({ name: usersTable.name }).from(workspaceMembersTable)
      .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
      .where(and(eq(workspaceMembersTable.workspaceId, workspaceId), eq(workspaceMembersTable.userId, actorUserId)))
      .limit(1)
    : [];

  for (const recipient of recipients) {
    const composed = composeWithdrawal(transaction, {
      recipient,
      partnerName: partner?.name ?? null,
      partnerUserId: transaction.partnerId ?? null,
      account: account ?? null,
      actorName: actor?.name ?? null,
    }, settings);
    await tx.insert(whatsappMessagesTable).values({
      workspaceId,
      transactionId: transaction.id,
      clientId: null,
      dedupeKey: `${workspaceId}:withdrawal:${transaction.id}:${recipient.phone}:paid`,
      kind: "withdrawal_alert",
      recipient: recipient.phone,
      body: composed.text,
    }).onConflictDoNothing();
  }
}

/**
 * Called when a client payment is confirmed. Queues the receipt for the client
 * and, when enabled, a "payment received" notice for the internal contacts.
 */
export async function enqueuePaymentReceipt(
  tx: any,
  workspaceId: string,
  transaction: FinancialTransaction,
): Promise<void> {
  if (transaction.type !== "inflow" || transaction.status !== "paid" || !transaction.clientId) return;
  const [client] = await tx.select().from(clientsTable)
    .where(and(eq(clientsTable.id, transaction.clientId), eq(clientsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!client) return;
  const settings = await loadSettings(tx, workspaceId);

  if (settings?.paymentAlertsEnabled) {
    const recipients = await internalRecipients(tx, workspaceId, settings, "payments");
    if (recipients.length) {
      const [account] = transaction.accountId
        ? await tx.select({ name: financialAccountsTable.name }).from(financialAccountsTable)
          .where(and(eq(financialAccountsTable.id, transaction.accountId), eq(financialAccountsTable.workspaceId, workspaceId)))
          .limit(1)
        : [];
      for (const recipient of recipients) {
        const composed = composePaymentAlert(transaction, { recipient, clientName: client.name, account: account ?? null }, settings);
        await tx.insert(whatsappMessagesTable).values({
          workspaceId,
          transactionId: transaction.id,
          clientId: client.id,
          dedupeKey: `${workspaceId}:payalert:${transaction.id}:${recipient.phone}`,
          kind: "payment_alert",
          recipient: recipient.phone,
          body: composed.text,
        }).onConflictDoNothing();
      }
    }
  }

  if (settings?.receiptEnabled === false) return;
  if (client.status !== "active" || !client.whatsappOptIn) return;
  const recipient = normalizeWhatsAppPhone(client.phone);
  if (!recipient) return;
  await tx.insert(whatsappMessagesTable).values({
    workspaceId,
    transactionId: transaction.id,
    clientId: client.id,
    dedupeKey: `${workspaceId}:receipt:${transaction.id}`,
    kind: "payment_receipt",
    recipient,
    body: composeReceipt(transaction, client, settings).text,
  }).onConflictDoNothing();
}

async function enqueueDailyBilling(): Promise<void> {
  const { date: today, hour } = saoPauloNow();
  const settingsRows = await db.select().from(whatsappSettingsTable)
    .where(eq(whatsappSettingsTable.autoBillingEnabled, true));
  for (const settings of settingsRows) {
    if (hour < settings.dailySendHour) continue;
    const earliestDue = new Date(`${today}T00:00:00Z`);
    earliestDue.setUTCDate(earliestDue.getUTCDate() - settings.daysAfterDue);
    const latestDue = new Date(`${today}T00:00:00Z`);
    latestDue.setUTCDate(latestDue.getUTCDate() + settings.daysBeforeDue + 1);
    const rows = await db.select({ transaction: financialTransactionsTable, client: clientsTable })
      .from(financialTransactionsTable)
      .innerJoin(clientsTable, eq(financialTransactionsTable.clientId, clientsTable.id))
      .where(and(
        eq(financialTransactionsTable.workspaceId, settings.workspaceId),
        eq(financialTransactionsTable.type, "inflow"),
        eq(financialTransactionsTable.status, "pending"),
        eq(financialTransactionsTable.pauseBilling, false),
        gte(financialTransactionsTable.dueDate, earliestDue),
        lte(financialTransactionsTable.dueDate, latestDue),
        eq(clientsTable.workspaceId, settings.workspaceId),
        eq(clientsTable.status, "active"),
        eq(clientsTable.whatsappOptIn, true),
      ));
    for (const { transaction, client } of rows) {
      const recipient = normalizeWhatsAppPhone(client.phone);
      if (!recipient) continue;
      const due = dueDay(transaction.dueDate);
      const daysUntilDue = dayDifference(due, today);
      let kind: BillingKind | null = null;
      if (settings.daysBeforeDue > 0 && daysUntilDue === settings.daysBeforeDue) kind = "billing_before";
      else if (settings.sendOnDueDate && daysUntilDue === 0) kind = "billing_due";
      else if (settings.daysAfterDue > 0 && daysUntilDue === -settings.daysAfterDue) kind = "billing_overdue";
      if (!kind) continue;
      await db.insert(whatsappMessagesTable).values({
        workspaceId: settings.workspaceId,
        transactionId: transaction.id,
        clientId: client.id,
        dedupeKey: `${settings.workspaceId}:${kind}:${transaction.id}:${due}`,
        kind,
        recipient,
        body: storedBody(composeBilling(kind, transaction, client, settings)),
      }).onConflictDoNothing();
    }
  }
}

async function claimNextMessage(): Promise<typeof whatsappMessagesTable.$inferSelect | null> {
  // The row lock allows multiple API replicas to share the same outbox safely.
  const claimed = await db.execute(sql`
    UPDATE whatsapp_messages SET status = 'processing', updated_at = NOW()
    WHERE id = (
      SELECT id FROM whatsapp_messages
      WHERE status IN ('queued', 'retry') AND next_attempt_at <= NOW()
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED LIMIT 1
    ) RETURNING id
  `);
  const id = claimed.rows[0]?.id as string | undefined;
  if (!id) return null;
  const [message] = await db.select().from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.id, id)).limit(1);
  return message ?? null;
}

async function markSkipped(messageId: string, reason: string): Promise<void> {
  await db.update(whatsappMessagesTable)
    .set({ status: "skipped", lastError: reason, updatedAt: new Date() })
    .where(eq(whatsappMessagesTable.id, messageId));
}

type Validated = { recipient: string; body: string; message: OutboundMessage } | { skip: string };

function plain(recipient: string, body: string): Validated {
  return { recipient, body, message: { text: body } };
}

async function revalidate(message: typeof whatsappMessagesTable.$inferSelect): Promise<Validated> {
  if (message.kind === "withdrawal_alert" || message.kind === "payment_alert") {
    const isWithdrawal = message.kind === "withdrawal_alert";
    if (!message.transactionId) return { skip: isWithdrawal ? "Retirada removida" : "Pagamento removido" };
    const settings = await loadSettings(db, message.workspaceId);
    if (isWithdrawal ? !settings?.withdrawalAlertsEnabled : !settings?.paymentAlertsEnabled) {
      return { skip: isWithdrawal ? "Alertas de retirada desativados" : "Alertas de pagamento desativados" };
    }
    const recipients = await internalRecipients(db, message.workspaceId, settings, isWithdrawal ? "withdrawals" : "payments");
    if (!recipients.some((recipient) => recipient.phone === message.recipient)) {
      return { skip: "Contato interno removido, inativo ou sem este aviso ativado" };
    }
    const [transaction] = await db.select().from(financialTransactionsTable)
      .where(and(eq(financialTransactionsTable.id, message.transactionId), eq(financialTransactionsTable.workspaceId, message.workspaceId)))
      .limit(1);
    if (isWithdrawal) {
      if (!transaction || transaction.type !== "outflow" || transaction.status !== "paid" || transaction.costType !== "partner_withdrawal") {
        return { skip: "Retirada não está mais paga" };
      }
      if (transaction.updatedAt > message.createdAt) return { skip: "Retirada alterada após o registro do alerta" };
    } else if (!transaction || transaction.type !== "inflow" || transaction.status !== "paid") {
      return { skip: "Pagamento não está mais confirmado" };
    }
    // Keep the amount, account and balance snapshot captured in the ledger
    // transaction; only revalidate eligibility and current alert destination.
    return plain(message.recipient, message.body);
  }
  if (message.kind === "payment_receipt") {
    if (!message.transactionId || !message.clientId) return { skip: "Pagamento ou cliente removido" };
    const record = await loadBillingData(message.workspaceId, message.transactionId);
    if (!record) return { skip: "Pagamento removido" };
    const { transaction, client } = record;
    if (transaction.type !== "inflow" || transaction.status !== "paid") return { skip: "Pagamento não está mais confirmado" };
    if (!client || client.id !== message.clientId || client.workspaceId !== message.workspaceId ||
      client.status !== "active" || !client.whatsappOptIn) {
      return { skip: "Cliente sem consentimento ativo" };
    }
    const settings = await loadSettings(db, message.workspaceId);
    if (settings?.receiptEnabled === false) return { skip: "Confirmações de pagamento desativadas" };
    const recipient = normalizeWhatsAppPhone(client.phone);
    if (!recipient) return { skip: "Telefone do cliente inválido" };
    const body = composeReceipt(transaction, client, settings).text;
    return plain(recipient, body);
  }
  if (!["billing_before", "billing_due", "billing_overdue", "manual_billing"].includes(message.kind)) {
    return { skip: "Tipo de mensagem desconhecido" };
  }
  if (!message.transactionId || !message.clientId) return { skip: "Parcela ou cliente removido" };
  const record = await loadBillingData(message.workspaceId, message.transactionId);
  if (!record) return { skip: "Parcela removida" };
  const { transaction, client } = record;
  if (transaction.type !== "inflow" || transaction.status !== "pending") return { skip: "Parcela já paga ou cancelada" };
  if (!client || client.id !== message.clientId || client.workspaceId !== message.workspaceId ||
    client.status !== "active" || !client.whatsappOptIn) {
    return { skip: "Cliente sem consentimento ativo" };
  }
  const recipient = normalizeWhatsAppPhone(client.phone);
  if (!recipient) return { skip: "Telefone do cliente inválido" };
  const settings = await loadSettings(db, message.workspaceId);
  if (message.kind !== "manual_billing") {
    if (!settings?.autoBillingEnabled) return { skip: "Cobrança automática desativada" };
    if (!settings.pixKey?.trim()) return { skip: "Chave Pix não configurada" };
    if (!message.dedupeKey.endsWith(`:${dueDay(transaction.dueDate)}`)) {
      return { skip: "Vencimento alterado após enfileiramento" };
    }
    const delta = dayDifference(dueDay(transaction.dueDate), saoPauloNow().date);
    if ((message.kind === "billing_before" && (settings.daysBeforeDue <= 0 || delta !== settings.daysBeforeDue)) ||
      (message.kind === "billing_due" && (!settings.sendOnDueDate || delta !== 0)) ||
      (message.kind === "billing_overdue" && (settings.daysAfterDue <= 0 || delta !== -settings.daysAfterDue))) {
      return { skip: "Vencimento alterado ou janela de envio encerrada" };
    }
  } else if (!settings?.pixKey?.trim()) {
    return { skip: "Chave Pix não configurada" };
  }
  const composed = composeBilling(message.kind as BillingKind, transaction, client, settings);
  return { recipient, body: storedBody(composed), message: composed };
}

async function deferMessage(message: typeof whatsappMessagesTable.$inferSelect, error: string, delayMs: number, countAttempt: boolean): Promise<void> {
  const attempts = message.attempts + (countAttempt ? 1 : 0);
  await db.update(whatsappMessagesTable).set({
    status: attempts >= MAX_ATTEMPTS ? "failed" : "retry",
    attempts,
    nextAttemptAt: new Date(Date.now() + delayMs),
    lastError: error.slice(0, 500),
    updatedAt: new Date(),
  }).where(eq(whatsappMessagesTable.id, message.id));
}

let workerBusy = false;
async function processNextMessage(): Promise<void> {
  if (workerBusy) return;
  workerBusy = true;
  try {
    // Recover claims left by a terminated process. Repeated sends use the same
    // stable WhatsApp message ID to reduce duplicate delivery after a crash.
    await db.update(whatsappMessagesTable)
      .set({ status: "retry", nextAttemptAt: new Date(), updatedAt: new Date() })
      .where(and(eq(whatsappMessagesTable.status, "processing"), lte(whatsappMessagesTable.updatedAt, new Date(Date.now() - 5 * 60_000))));
    const message = await claimNextMessage();
    if (!message) return;
    const valid = await revalidate(message);
    if ("skip" in valid) {
      await markSkipped(message.id, valid.skip);
      return;
    }
    const workspaceSettings = await loadSettings(db, message.workspaceId);
    const dailyLimit = workspaceSettings?.dailyMessageLimit ?? MAX_DAILY_MESSAGES_PER_WORKSPACE;
    const [daily] = await db.select({ total: sql<number>`count(*)::int` })
      .from(whatsappMessagesTable)
      .where(and(eq(whatsappMessagesTable.workspaceId, message.workspaceId), eq(whatsappMessagesTable.status, "sent"),
        gte(whatsappMessagesTable.sentAt, new Date(Date.now() - 24 * 60 * 60_000))));
    if ((daily?.total ?? 0) >= dailyLimit) {
      await deferMessage(message, "Limite diário de mensagens atingido", 60 * 60_000, false);
      return;
    }
    // An inbound PARAR or a payment can arrive while the rate-limit query runs.
    // Refresh consent and transaction state at the last point before send.
    const finalCheck = await revalidate(message);
    if ("skip" in finalCheck) {
      await markSkipped(message.id, finalCheck.skip);
      return;
    }
    try {
      const outcome = await sendWhatsAppMessage(message.workspaceId, finalCheck.recipient, finalCheck.message, message.id);
      await db.update(whatsappMessagesTable).set({
        recipient: finalCheck.recipient,
        body: finalCheck.body,
        status: "sent",
        attempts: message.attempts + 1,
        sentAt: new Date(),
        waMessageId: outcome.waMessageId,
        lastError: outcome.fallbackReason ? `Botão de Pix indisponível; enviado como texto (${outcome.fallbackReason})`.slice(0, 500) : null,
        updatedAt: new Date(),
      }).where(eq(whatsappMessagesTable.id, message.id));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Falha desconhecida";
      const disconnected = reason === "WhatsApp não conectado";
      const backoff = disconnected ? 60_000 : Math.min(60 * 60_000, 60_000 * 2 ** message.attempts);
      await deferMessage(message, reason, backoff, !disconnected);
      logger.warn({ workspaceId: message.workspaceId, messageId: message.id, reason }, "WhatsApp send deferred");
    }
  } finally {
    workerBusy = false;
  }
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let workerTimer: ReturnType<typeof setInterval> | null = null;
let schedulerBusy = false;
async function scheduleTick(): Promise<void> {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    await enqueueDailyBilling();
  } finally {
    schedulerBusy = false;
  }
}

export function triggerImmediateWorker(): void {
  void processNextMessage().catch((error) => logger.error({ err: error }, "WhatsApp immediate outbox worker failed"));
}

export async function startWhatsAppAutomation(): Promise<void> {
  if (schedulerTimer || workerTimer) return;
  await restoreWhatsAppSessions();
  schedulerTimer = setInterval(() => {
    void scheduleTick().catch((error) => logger.error({ err: error }, "WhatsApp scheduler failed"));
  }, 60_000);
  workerTimer = setInterval(() => {
    void processNextMessage().catch((error) => logger.error({ err: error }, "WhatsApp outbox worker failed"));
  }, 5_000);
  schedulerTimer.unref?.();
  workerTimer.unref?.();
  void scheduleTick().catch((error) => logger.error({ err: error }, "WhatsApp initial scheduler failed"));
  void processNextMessage().catch((error) => logger.error({ err: error }, "WhatsApp initial worker failed"));
}

export async function stopWhatsAppAutomation(): Promise<void> {
  if (schedulerTimer) clearInterval(schedulerTimer);
  if (workerTimer) clearInterval(workerTimer);
  schedulerTimer = null;
  workerTimer = null;
  await stopWhatsAppSessions();
}
