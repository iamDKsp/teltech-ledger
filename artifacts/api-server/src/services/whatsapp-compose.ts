import type { Client, FinancialTransaction, WhatsappSettings } from "@workspace/db";
import { generatePixPayload, normalizePixKey, PIX_KEY_TYPE_LABEL, PIX_KEY_TYPE_WHATSAPP, type PixKeyType } from "../lib/pix";
import type { OutboundMessage, PixAttachment } from "./whatsapp-session";
import {
  OPT_OUT_FOOTER,
  deadlinePhrase,
  firstName,
  greeting,
  overduePhrase,
  pixInstructions,
  renderTemplate,
  resolveTemplate,
  sampleVariables,
  type TemplateKind,
} from "./whatsapp-templates";

const TIMEZONE = "America/Sao_Paulo";
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

export type BillingKind = "billing_before" | "billing_due" | "billing_overdue" | "manual_billing";

export interface ComposedMessage extends OutboundMessage {
  templateKind: TemplateKind;
}

export function money(cents: number): string {
  return currency.format(cents / 100);
}

export function saoPauloNow(now = new Date()): { date: string; hour: number } {
  const parts = Object.fromEntries(clock.formatToParts(now).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function dueDay(dueDate: Date): string {
  // Finance treats dueDate as a calendar date; ISO's UTC day preserves a date-only
  // value entered at 00:00Z instead of shifting it to the previous Brazil day.
  return dueDate.toISOString().slice(0, 10);
}

export function dayDifference(left: string, right: string): number {
  return Math.round((Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000);
}

export function readableDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export function describeInstallment(transaction: Pick<FinancialTransaction, "description" | "installmentNumber" | "installmentsTotal">): string {
  if (!transaction.installmentNumber || !transaction.installmentsTotal) return transaction.description;
  return `${transaction.description} (parcela ${transaction.installmentNumber}/${transaction.installmentsTotal})`;
}

type SettingsLike = Partial<WhatsappSettings> | null | undefined;

export function persona(settings: SettingsLike): { assistant: string; company: string } {
  return {
    assistant: settings?.assistantName?.trim() || "Nexus",
    company: settings?.companyName?.trim() || "Teltech",
  };
}

function baseVariables(settings: SettingsLike, now = new Date()): Record<string, string> {
  const { assistant, company } = persona(settings);
  return { assistente: assistant, empresa: company, saudacao: greeting(saoPauloNow(now).hour) };
}

export interface PixSetup {
  /** Chave como digitada pelo usuário (exibida na mensagem). */
  keyDisplay: string;
  /** Chave no formato do BR Code. */
  key: string;
  type: PixKeyType;
  typeLabel: string;
  merchantName: string;
  merchantCity: string;
  /** false quando a chave não foi reconhecida (nesse caso o botão nativo não é usado). */
  valid: boolean;
}

export function pixSetup(settings: SettingsLike): PixSetup | null {
  const raw = settings?.pixKey?.trim();
  if (!raw) return null;
  const requested = (settings?.pixKeyType ?? "auto") as PixKeyType | "auto";
  const normalized = normalizePixKey(raw, requested);
  const { company } = persona(settings);
  return {
    keyDisplay: raw,
    key: normalized?.key ?? raw,
    type: normalized?.type ?? "random",
    typeLabel: normalized ? PIX_KEY_TYPE_LABEL[normalized.type] : "Chave",
    merchantName: settings?.pixMerchantName?.trim() || company,
    merchantCity: settings?.pixMerchantCity?.trim() || "SAO PAULO",
    valid: Boolean(normalized),
  };
}

function pixAttachment(setup: PixSetup, amountCents: number, reference: string, description: string): PixAttachment {
  const txId = reference.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20) || "***";
  return {
    code: generatePixPayload({
      pixKey: setup.key,
      pixKeyType: setup.valid ? setup.type : "auto",
      amountCents,
      merchantName: setup.merchantName,
      merchantCity: setup.merchantCity,
      txId,
    }),
    key: setup.key,
    keyType: PIX_KEY_TYPE_WHATSAPP[setup.type],
    merchantName: setup.merchantName,
    amountCents,
    reference: txId,
    description,
  };
}

function billingTemplateKind(kind: BillingKind, daysUntilDue: number): Extract<TemplateKind, "billing_before" | "billing_due" | "billing_overdue"> {
  if (kind !== "manual_billing") return kind;
  if (daysUntilDue > 0) return "billing_before";
  return daysUntilDue === 0 ? "billing_due" : "billing_overdue";
}

interface BillingInput {
  templateKind: Extract<TemplateKind, "billing_before" | "billing_due" | "billing_overdue">;
  vars: Record<string, string>;
  settings: SettingsLike;
  amountCents: number;
  reference: string;
  description: string;
  templateOverride?: string;
}

function assembleBilling(input: BillingInput): ComposedMessage {
  const { settings } = input;
  const body = input.templateOverride?.trim() ? input.templateOverride : resolveTemplate(input.templateKind, settings?.templates);
  const setup = pixSetup(settings);
  const footer = settings?.optOutHintEnabled === false ? undefined : OPT_OUT_FOOTER;
  if (!setup) {
    return { templateKind: input.templateKind, text: renderTemplate(body, { ...input.vars, pix: "" }), footer };
  }
  const mode = settings?.pixDeliveryMode === "native" && setup.valid ? "native" : "text";
  const textVersion = renderTemplate(body, {
    ...input.vars,
    pix: pixInstructions({ mode: "text", key: setup.keyDisplay, typeLabel: setup.typeLabel }),
  });
  const text = mode === "native"
    ? renderTemplate(body, { ...input.vars, pix: pixInstructions({ mode: "native", key: setup.keyDisplay, typeLabel: setup.typeLabel }) })
    : textVersion;
  return {
    templateKind: input.templateKind,
    text,
    fallbackText: mode === "native" ? textVersion : undefined,
    footer,
    pix: pixAttachment(setup, input.amountCents, input.reference, input.description),
    pixMode: mode,
  };
}

export function composeBilling(
  kind: BillingKind,
  transaction: FinancialTransaction,
  client: Pick<Client, "name">,
  settings: SettingsLike,
  now = new Date(),
): ComposedMessage {
  const date = dueDay(transaction.dueDate);
  const delta = dayDifference(date, saoPauloNow(now).date);
  const description = describeInstallment(transaction);
  return assembleBilling({
    templateKind: billingTemplateKind(kind, delta),
    vars: {
      ...baseVariables(settings, now),
      cliente: client.name,
      nome: firstName(client.name),
      descricao: description,
      valor: money(transaction.amount),
      vencimento: readableDate(date),
      prazo: deadlinePhrase(delta),
      atraso: overduePhrase(delta),
    },
    settings,
    amountCents: transaction.amount,
    reference: transaction.id,
    description,
  });
}

export function composeReceipt(
  transaction: FinancialTransaction,
  client: Pick<Client, "name">,
  settings: SettingsLike,
  now = new Date(),
): ComposedMessage {
  const paidDate = readableDate(saoPauloNow(transaction.paidAt ?? now).date);
  const vars = {
    ...baseVariables(settings, now),
    cliente: client.name,
    nome: firstName(client.name),
    descricao: describeInstallment(transaction),
    valor: money(transaction.amount),
    data_pagamento: paidDate,
  };
  return { templateKind: "payment_receipt", text: renderTemplate(resolveTemplate("payment_receipt", settings?.templates), vars) };
}

export interface InternalRecipient {
  phone: string;
  name: string;
  nickname: string | null;
  userId: string | null;
}

/** Como o assistente chama a pessoa: apelido, ou primeiro nome. */
export function callName(recipient: Pick<InternalRecipient, "name" | "nickname">): string {
  return recipient.nickname?.trim() || firstName(recipient.name);
}

export function composeWithdrawal(
  transaction: FinancialTransaction,
  context: {
    recipient: InternalRecipient;
    partnerName: string | null;
    partnerUserId: string | null;
    account: { name: string; currentBalance: number } | null;
    actorName: string | null;
  },
  settings: SettingsLike,
  now = new Date(),
): ComposedMessage {
  const isOwnWithdrawal = Boolean(context.recipient.userId && context.recipient.userId === context.partnerUserId);
  const vars = {
    ...baseVariables(settings, now),
    contato: callName(context.recipient),
    socio: context.partnerName ? (isOwnWithdrawal ? `${context.partnerName} (você)` : context.partnerName) : "",
    valor: money(transaction.amount),
    descricao: transaction.description,
    conta: context.account?.name ?? "",
    saldo: context.account ? money(context.account.currentBalance) : "",
    data: readableDate(saoPauloNow(transaction.paidAt ?? now).date),
    registrado_por: context.actorName ?? "",
  };
  return { templateKind: "withdrawal_alert", text: renderTemplate(resolveTemplate("withdrawal_alert", settings?.templates), vars) };
}

export function composePaymentAlert(
  transaction: FinancialTransaction,
  context: { recipient: InternalRecipient; clientName: string; account: { name: string } | null },
  settings: SettingsLike,
  now = new Date(),
): ComposedMessage {
  const vars = {
    ...baseVariables(settings, now),
    contato: callName(context.recipient),
    cliente: context.clientName,
    descricao: describeInstallment(transaction),
    valor: money(transaction.amount),
    data_pagamento: readableDate(saoPauloNow(transaction.paidAt ?? now).date),
    conta: context.account?.name ?? "",
  };
  return { templateKind: "payment_alert", text: renderTemplate(resolveTemplate("payment_alert", settings?.templates), vars) };
}

export function composeExpenseRegistered(
  transaction: FinancialTransaction,
  context: {
    recipient: InternalRecipient;
    categoryName: string | null;
    account: { name: string } | null;
    actorName: string | null;
  },
  settings: SettingsLike,
  now = new Date(),
): ComposedMessage {
  const vars = {
    ...baseVariables(settings, now),
    contato: callName(context.recipient),
    descricao: describeInstallment(transaction),
    valor: money(transaction.amount),
    vencimento: readableDate(dueDay(transaction.dueDate)),
    categoria: context.categoryName ?? "Geral",
    conta: context.account?.name ?? "",
    registrado_por: context.actorName ?? "",
  };
  return { templateKind: "expense_registered", text: renderTemplate(resolveTemplate("expense_registered", settings?.templates), vars) };
}

export function composeExpensePaid(
  transaction: FinancialTransaction,
  context: {
    recipient: InternalRecipient;
    categoryName: string | null;
    account: { name: string; currentBalance: number } | null;
    actorName: string | null;
  },
  settings: SettingsLike,
  now = new Date(),
): ComposedMessage {
  const vars = {
    ...baseVariables(settings, now),
    contato: callName(context.recipient),
    descricao: describeInstallment(transaction),
    valor: money(transaction.amount),
    data_pagamento: readableDate(saoPauloNow(transaction.paidAt ?? now).date),
    categoria: context.categoryName ?? "Geral",
    conta: context.account?.name ?? "",
    saldo: context.account ? money(context.account.currentBalance) : "",
    liquidado_por: context.actorName ?? "",
  };
  return { templateKind: "expense_paid", text: renderTemplate(resolveTemplate("expense_paid", settings?.templates), vars) };
}

export function composeIncomeRegistered(
  transaction: FinancialTransaction,
  context: {
    recipient: InternalRecipient;
    clientName: string | null;
    account: { name: string } | null;
    actorName: string | null;
  },
  settings: SettingsLike,
  now = new Date(),
): ComposedMessage {
  const vars = {
    ...baseVariables(settings, now),
    contato: callName(context.recipient),
    cliente: context.clientName ?? "Avulso",
    descricao: describeInstallment(transaction),
    valor: money(transaction.amount),
    vencimento: readableDate(dueDay(transaction.dueDate)),
    conta: context.account?.name ?? "",
    registrado_por: context.actorName ?? "",
  };
  return { templateKind: "income_registered", text: renderTemplate(resolveTemplate("income_registered", settings?.templates), vars) };
}

/** Texto que fica salvo no histórico: a versão em texto, rodapé e código Pix. */
export function storedBody(message: ComposedMessage): string {
  const parts = [message.pix && message.pixMode === "native" ? (message.fallbackText ?? message.text) : message.text];
  if (message.footer) parts.push(`_${message.footer}_`);
  if (message.pix) parts.push(`Pix Copia e Cola:\n${message.pix.code}`);
  return parts.join("\n\n");
}

/** Mensagem de exemplo (prévia e envio de teste) com dados fictícios. */
export function composePreview(
  kind: TemplateKind,
  settings: SettingsLike,
  options: { templateOverride?: string; recipientName?: string; now?: Date } = {},
): ComposedMessage {
  const now = options.now ?? new Date();
  const vars = sampleVariables(kind, baseVariables(settings, now));
  if (options.recipientName) vars.contato = options.recipientName;
  const sampleDue = new Date(now.getTime() + 3 * 86_400_000);
  const dueText = readableDate(sampleDue.toISOString().slice(0, 10));
  vars.vencimento = dueText;
  vars.data_pagamento = readableDate(saoPauloNow(now).date);
  vars.data = vars.data_pagamento;

  if (kind === "billing_before" || kind === "billing_due" || kind === "billing_overdue") {
    const delta = kind === "billing_before" ? 3 : kind === "billing_due" ? 0 : -3;
    const due = new Date(now.getTime() + delta * 86_400_000);
    vars.vencimento = readableDate(due.toISOString().slice(0, 10));
    vars.prazo = deadlinePhrase(delta);
    vars.atraso = overduePhrase(delta);
    return assembleBilling({
      templateKind: kind,
      vars,
      settings,
      amountCents: 125_000,
      reference: "TESTE",
      description: vars.descricao,
      templateOverride: options.templateOverride,
    });
  }
  const body = options.templateOverride?.trim() ? options.templateOverride : resolveTemplate(kind, settings?.templates);
  return { templateKind: kind, text: renderTemplate(body, vars) };
}
