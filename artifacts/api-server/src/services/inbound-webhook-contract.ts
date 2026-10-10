import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { parseDay } from "./sales-schedule";

export class WebhookError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const id = z.string().min(1).max(120).regex(/^[A-Za-z0-9_.:-]+$/);
const version = z.number().int().min(1).max(2_147_483_647);
const cents = z.number().int().min(0).max(2_147_483_647);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => parseDay(v) !== null, "Data inválida");
const instant = z.string().datetime({ offset: true });
const nullableText = (max: number) => z.string().trim().max(max).nullable().default(null);

export const webhookClientSchema = z.object({
  externalId: id,
  version,
  name: z.string().trim().min(1).max(200),
  document: nullableText(30),
  email: z.string().email().max(254).nullable().default(null),
  phone: nullableText(40),
  status: z.enum(["active", "inactive"]).default("active"),
  notes: nullableText(2000),
  photo: z.object({
    sourceUrl: z.string().url().max(4096),
    version,
  }).strict().nullable().optional(),
}).strict();

export const webhookBaseSchema = z.object({
  externalId: id,
  version,
  name: z.string().trim().min(1).max(200),
  monthlyAmount: cents,
  billingDay: z.number().int().min(1).max(31),
  startDate: day,
  endDate: day.nullable().default(null),
  effectiveDate: day,
  status: z.enum(["active", "paused", "cancelled"]).default("active"),
}).strict().superRefine((v, ctx) => {
  if (v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Término anterior ao início" });
  if (v.effectiveDate < v.startDate) ctx.addIssue({ code: "custom", path: ["effectiveDate"], message: "Vigência anterior ao início" });
});

export const webhookInvoiceSchema = z.object({
  externalId: id,
  version,
  description: z.string().trim().min(1).max(300),
  amount: cents.refine((v) => v > 0, "Valor deve ser positivo"),
  dueDate: day,
  referenceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  status: z.enum(["pending", "paid", "cancelled"]),
  paidAt: instant.nullable().default(null),
  paymentMethod: z.enum(["pix", "boleto", "credit_card", "bank_transfer", "cash"]).nullable().default(null),
}).strict().superRefine((v, ctx) => {
  if (v.status === "paid" && !v.paidAt) ctx.addIssue({ code: "custom", path: ["paidAt"], message: "Pagamento exige paidAt" });
  if (v.status !== "paid" && v.paidAt) ctx.addIssue({ code: "custom", path: ["paidAt"], message: "paidAt deve ser null se não estiver paga" });
});

const envelope = { schemaVersion: z.literal(1), eventId: id, occurredAt: instant };
export const inboundWebhookSchema = z.discriminatedUnion("eventType", [
  z.object({ ...envelope, eventType: z.literal("client.upsert"), data: webhookClientSchema }).strict(),
  z.object({ ...envelope, eventType: z.literal("base.upsert"), data: z.object({
    client: webhookClientSchema,
    base: webhookBaseSchema,
    invoices: z.array(webhookInvoiceSchema).max(60).default([]),
  }).strict() }).strict(),
  z.object({ ...envelope, eventType: z.literal("invoice.upsert"), data: z.object({
    baseExternalId: id,
    invoice: webhookInvoiceSchema,
  }).strict() }).strict(),
]);

export type InboundWebhook = z.infer<typeof inboundWebhookSchema>;
export type WebhookClient = z.infer<typeof webhookClientSchema>;
export type WebhookBase = z.infer<typeof webhookBaseSchema>;
export type WebhookInvoice = z.infer<typeof webhookInvoiceSchema>;

const integrationSchema = z.object({
  source: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,59}$/),
  name: z.string().trim().min(1).max(100),
  secret: z.string().min(32).max(512),
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid(),
  accountId: z.string().uuid().nullable().default(null),
  photoAllowedHosts: z.array(z.string().max(253).regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/))
    .max(20).optional(),
}).strict();
export type WebhookIntegration = z.infer<typeof integrationSchema>;

export function readWebhookIntegrations(value = process.env.INBOUND_WEBHOOK_INTEGRATIONS): WebhookIntegration[] {
  if (!value?.trim()) return [];
  try {
    const integrations = z.array(integrationSchema).max(50).parse(JSON.parse(value));
    if (new Set(integrations.map((i) => i.source)).size !== integrations.length) throw new Error("Duplicate source");
    return integrations;
  } catch {
    // Do not expose Zod issues: they could include the integration's secret.
    throw new WebhookError(503, "integration_config_invalid", "Configuração das integrações inválida no servidor.");
  }
}

export function hashPayload(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function webhookSignature(secret: string, source: string, timestamp: string, rawBody: Buffer): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${source}.`).update(rawBody).digest("hex")}`;
}

export function verifyWebhookSignature(secret: string, source: string, timestamp: string | undefined,
  signature: string | undefined, rawBody: Buffer, now = Date.now()): boolean {
  if (!timestamp || !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(webhookSignature(secret, source, timestamp, rawBody)), Buffer.from(signature));
}

export function compareEntityVersion(incoming: number, hash: string, existing?: { version: number; payloadHash: string }): "apply" | "unchanged" | "stale" {
  if (!existing || incoming > existing.version) return "apply";
  if (incoming < existing.version) return "stale";
  if (hash !== existing.payloadHash) throw new WebhookError(409, "version_conflict", "Mesma versão enviada com dados diferentes. Incremente version.");
  return "unchanged";
}

export function paidBalanceDelta(before: { status: string; amount: number } | undefined,
  after: { status: string; amount: number }): number {
  return (after.status === "paid" ? after.amount : 0) - (before?.status === "paid" ? before.amount : 0);
}

export interface ExistingWebhookClient {
  id: string; name: string; document: string | null; email: string | null; phone: string | null;
}
export const normalizeClientDocument = (value: string | null) => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const normalizeEmail = (value: string | null) => (value ?? "").trim().toLowerCase();
const normalizeName = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Conservative first-link resolution for clients registered manually. */
export function findExistingWebhookClient(incoming: Pick<WebhookClient, "name" | "document" | "email" | "phone">,
  candidates: ExistingWebhookClient[]): string | undefined {
  const document = normalizeClientDocument(incoming.document);
  const email = normalizeEmail(incoming.email);
  const byDocument = document ? candidates.filter((c) => normalizeClientDocument(c.document) === document) : [];
  const byEmail = email ? candidates.filter((c) => normalizeEmail(c.email) === email) : [];
  if (byDocument.length > 1 || byEmail.length > 1) {
    throw new WebhookError(409, "client_match_ambiguous", "Mais de um cliente corresponde ao CPF/CNPJ ou e-mail. Vincule o cliente correto em Configurações > Integrações.");
  }
  if (byDocument.length === 1) {
    if (byEmail.length && byEmail[0].id !== byDocument[0].id) {
      throw new WebhookError(409, "client_identity_conflict", "CPF/CNPJ e e-mail apontam para clientes diferentes. Faça a vinculação manual.");
    }
    return byDocument[0].id;
  }
  if (byEmail.length === 1) {
    const existingDoc = normalizeClientDocument(byEmail[0].document);
    if (document && existingDoc && document !== existingDoc) {
      throw new WebhookError(409, "client_identity_conflict", "O cliente com esse e-mail tem outro CPF/CNPJ. Confira os dados e faça a vinculação manual.");
    }
    return byEmail[0].id;
  }
  const name = normalizeName(incoming.name);
  const phone = (incoming.phone ?? "").replace(/\D/g, "");
  if (candidates.some((c) => (name && normalizeName(c.name) === name) || (phone.length >= 10 && (c.phone ?? "").replace(/\D/g, "") === phone))) {
    throw new WebhookError(409, "existing_client_requires_link", "Há um cliente com nome ou telefone correspondente. Vincule o ID externo antes de enviar, para evitar duplicação.");
  }
  return undefined;
}
