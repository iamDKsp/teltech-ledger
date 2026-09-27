import {
  db,
  clientsTable,
  financialAccountsTable,
  financialTransactionsTable,
  usersTable,
  workspaceMembersTable,
  whatsappMessagesTable,
  whatsappSettingsTable,
  type FinancialTransaction,
  type Client,
} from "@workspace/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  normalizeWhatsAppPhone,
  restoreWhatsAppSessions,
  sendWhatsAppText,
  stopWhatsAppSessions,
} from "./whatsapp-session";
import { generatePixPayload } from "../lib/pix";

const TIMEZONE = "America/Sao_Paulo";
const MAX_DAILY_MESSAGES_PER_WORKSPACE = 100;
const MAX_ATTEMPTS = 5;
const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

export type BillingKind = "billing_before" | "billing_due" | "billing_overdue" | "manual_billing" | "payment_receipt";

function saoPauloNow(now = new Date()): { date: string; hour: number } {
  const parts = Object.fromEntries(clock.formatToParts(now).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function dueDay(dueDate: Date): string {
  // Finance treats dueDate as a calendar date; ISO's UTC day preserves a date-only
  // value entered at 00:00Z instead of shifting it to the previous Brazil day.
  return dueDate.toISOString().slice(0, 10);
}

function dayDifference(left: string, right: string): number {
  return Math.round((Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000);
}

function readableDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function describeInstallment(transaction: FinancialTransaction): string {
  if (!transaction.installmentNumber || !transaction.installmentsTotal) return transaction.description;
  return `${transaction.description} (parcela ${transaction.installmentNumber}/${transaction.installmentsTotal})`;
}

function billingBody(
  kind: BillingKind,
  transaction: FinancialTransaction,
  client: Pick<Client, "name">,
  pixKey: string | null,
): string {
  const date = dueDay(transaction.dueDate);
  const intro = kind === "billing_before"
    ? "Lembramos que a parcela abaixo vence em breve:"
    : kind === "billing_overdue"
      ? "Identificamos uma parcela em aberto:"
      : "Segue o lembrete da parcela em aberto:";
  const lines = [
    `Olá, ${client.name}. ${intro}`,
    `${describeInstallment(transaction)}`,
    `Valor: ${formatter.format(transaction.amount / 100)}`,
    `Vencimento: ${readableDate(date)}`,
  ];
  if (pixKey?.trim()) {
    lines.push(`Chave Pix: ${pixKey.trim()}`);
    const pixPayload = generatePixPayload({
      pixKey: pixKey.trim(),
      amountCents: transaction.amount,
      txId: transaction.id.replace(/-/g, "").slice(0, 20),
    });
    if (pixPayload) {
      lines.push("", "*Pix Copia e Cola:*", pixPayload);
    }
  }
  lines.push("", "Se já efetuou o pagamento, favor desconsiderar este lembrete.");
  return lines.join("\n");
}

function receiptBody(
  transaction: FinancialTransaction,
  client: Pick<Client, "name">,
): string {
  const paidDate = readableDate(saoPauloNow(transaction.paidAt ?? new Date()).date);
  return [
    `Olá, ${client.name}!`,
    "Confirmamos com sucesso o recebimento do seu pagamento:",
    `${describeInstallment(transaction)}`,
    `Valor: ${formatter.format(transaction.amount / 100)}`,
    `Data do recebimento: ${paidDate}`,
    "",
    "Agradecemos pela pontualidade e pela parceria com a Teltech! 🤝",
  ].join("\n");
}

function withdrawalBody(
  transaction: FinancialTransaction,
  partnerName: string | null,
  account: { name: string; currentBalance: number } | null,
): string {
  return [
    "Teltech Ledger: retirada de sócio registrada no caixa.",
    `Valor: ${formatter.format(transaction.amount / 100)}`,
    `Descrição: ${transaction.description}`,
    partnerName ? `Sócio: ${partnerName}` : null,
    account ? `Conta de origem: ${account.name}` : null,
    account ? `Saldo após retirada: ${formatter.format(account.currentBalance / 100)}` : null,
    `Data: ${readableDate(saoPauloNow(transaction.paidAt ?? new Date()).date)}`,
  ].filter(Boolean).join("\n");
}

async function getBillingData(workspaceId: string, transactionId: string) {
  const [record] = await db.select({ transaction: financialTransactionsTable, client: clientsTable })
    .from(financialTransactionsTable)
    .leftJoin(clientsTable, eq(financialTransactionsTable.clientId, clientsTable.id))
    .where(and(eq(financialTransactionsTable.workspaceId, workspaceId), eq(financialTransactionsTable.id, transactionId)))
    .limit(1);
  return record ?? null;
}

export async function enqueueManualBilling(workspaceId: string, transactionId: string): Promise<{
  ok: boolean;
  reason?: string;
  conflict?: boolean;
  message?: typeof whatsappMessagesTable.$inferSelect;
  created?: boolean;
}> {
  const record = await getBillingData(workspaceId, transactionId);
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
  const [settings] = await db.select().from(whatsappSettingsTable)
    .where(eq(whatsappSettingsTable.workspaceId, workspaceId)).limit(1);
  if (!settings?.pixKey?.trim()) return { ok: false, reason: "Configure a chave Pix antes de enviar cobranças" };
  const dedupeKey = `${workspaceId}:manual:${transactionId}:${saoPauloNow().date}`;
  const [inserted] = await db.insert(whatsappMessagesTable).values({
    workspaceId,
    transactionId,
    clientId: client.id,
    dedupeKey,
    kind: "manual_billing",
    recipient,
    body: billingBody("manual_billing", transaction, client, settings?.pixKey ?? null),
  }).onConflictDoNothing().returning();
  const message = inserted ?? (await db.select().from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.dedupeKey, dedupeKey)).limit(1))[0];
  if (!inserted && message && ["failed", "skipped", "sent"].includes(message.status)) {
    const reason = message.status === "sent"
      ? "Cobrança já enviada hoje para esta parcela"
      : "Tentativa anterior não foi enviada; revise o histórico e tente novamente amanhã";
    return { ok: false, reason, conflict: true, message };
  }
  return { ok: true, message, created: Boolean(inserted) };
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
  const [settings] = await tx.select().from(whatsappSettingsTable)
    .where(eq(whatsappSettingsTable.workspaceId, workspaceId)).limit(1);
  if (!settings?.withdrawalAlertsEnabled || !settings.internalAlertPhone) return;

  const rawList = settings.internalAlertPhone.split(/[,;\n\r\t]+/).map((p: string) => p.trim()).filter(Boolean);
  const recipients = Array.from(new Set(rawList.map((p: string) => normalizeWhatsAppPhone(p)).filter((p: string | null): p is string => Boolean(p))));
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

  const body = [
    withdrawalBody(transaction, partner?.name ?? null, account ?? null),
    actor ? `Registrado por: ${actor.name}` : null,
  ].filter(Boolean).join("\n");

  for (const recipient of recipients) {
    await tx.insert(whatsappMessagesTable).values({
      workspaceId,
      transactionId: transaction.id,
      clientId: null,
      dedupeKey: `${workspaceId}:withdrawal:${transaction.id}:${recipient}:paid`,
      kind: "withdrawal_alert",
      recipient,
      body,
    }).onConflictDoNothing();
  }
}

export async function enqueuePaymentReceipt(
  tx: any,
  workspaceId: string,
  transaction: FinancialTransaction,
): Promise<void> {
  if (transaction.type !== "inflow" || transaction.status !== "paid" || !transaction.clientId) return;
  const [client] = await tx.select().from(clientsTable)
    .where(and(eq(clientsTable.id, transaction.clientId), eq(clientsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!client || client.status !== "active" || !client.whatsappOptIn) return;
  const recipient = normalizeWhatsAppPhone(client.phone);
  if (!recipient) return;

  const dedupeKey = `${workspaceId}:receipt:${transaction.id}`;
  await tx.insert(whatsappMessagesTable).values({
    workspaceId,
    transactionId: transaction.id,
    clientId: client.id,
    dedupeKey,
    kind: "payment_receipt",
    recipient,
    body: receiptBody(transaction, client),
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
        body: billingBody(kind, transaction, client, settings.pixKey),
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

async function revalidate(message: typeof whatsappMessagesTable.$inferSelect): Promise<{
  recipient: string;
  body: string;
} | { skip: string }> {
  if (message.kind === "withdrawal_alert") {
    if (!message.transactionId) return { skip: "Retirada removida" };
    const [settings] = await db.select().from(whatsappSettingsTable)
      .where(eq(whatsappSettingsTable.workspaceId, message.workspaceId)).limit(1);
    if (!settings?.withdrawalAlertsEnabled) return { skip: "Alertas de retirada desativados" };
    const recipient = normalizeWhatsAppPhone(settings.internalAlertPhone);
    if (!recipient) return { skip: "Telefone interno inválido" };
    const [transaction] = await db.select().from(financialTransactionsTable)
      .where(and(eq(financialTransactionsTable.id, message.transactionId), eq(financialTransactionsTable.workspaceId, message.workspaceId)))
      .limit(1);
    if (!transaction || transaction.type !== "outflow" || transaction.status !== "paid" || transaction.costType !== "partner_withdrawal") {
      return { skip: "Retirada não está mais paga" };
    }
    if (transaction.updatedAt > message.createdAt) return { skip: "Retirada alterada após o registro do alerta" };
    // Keep the amount, account and balance snapshot captured in the ledger
    // transaction; only revalidate eligibility and current alert destination.
    return { recipient, body: message.body };
  }
  if (!["billing_before", "billing_due", "billing_overdue", "manual_billing"].includes(message.kind)) {
    return { skip: "Tipo de mensagem desconhecido" };
  }
  if (!message.transactionId || !message.clientId) return { skip: "Parcela ou cliente removido" };
  const record = await getBillingData(message.workspaceId, message.transactionId);
  if (!record) return { skip: "Parcela removida" };
  const { transaction, client } = record;
  if (transaction.type !== "inflow" || transaction.status !== "pending") return { skip: "Parcela já paga ou cancelada" };
  if (!client || client.id !== message.clientId || client.workspaceId !== message.workspaceId ||
    client.status !== "active" || !client.whatsappOptIn) {
    return { skip: "Cliente sem consentimento ativo" };
  }
  const recipient = normalizeWhatsAppPhone(client.phone);
  if (!recipient) return { skip: "Telefone do cliente inválido" };
  const [settings] = await db.select().from(whatsappSettingsTable)
    .where(eq(whatsappSettingsTable.workspaceId, message.workspaceId)).limit(1);
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
  return { recipient, body: billingBody(message.kind as BillingKind, transaction, client, settings?.pixKey ?? null) };
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
    const [daily] = await db.select({ total: sql<number>`count(*)::int` })
      .from(whatsappMessagesTable)
      .where(and(eq(whatsappMessagesTable.workspaceId, message.workspaceId), eq(whatsappMessagesTable.status, "sent"),
        gte(whatsappMessagesTable.sentAt, new Date(Date.now() - 24 * 60 * 60_000))));
    if ((daily?.total ?? 0) >= MAX_DAILY_MESSAGES_PER_WORKSPACE) {
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
      const waMessageId = await sendWhatsAppText(message.workspaceId, finalCheck.recipient, finalCheck.body, message.id);
      await db.update(whatsappMessagesTable).set({
        recipient: finalCheck.recipient,
        body: finalCheck.body,
        status: "sent",
        attempts: message.attempts + 1,
        sentAt: new Date(),
        waMessageId,
        lastError: null,
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
