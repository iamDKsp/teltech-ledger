import { Router, type IRouter } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import {
  db,
  pool,
  clientsTable,
  financialTransactionsTable,
  usersTable,
  workspaceMembersTable,
  whatsappContactsTable,
  whatsappMessagesTable,
  whatsappSettingsTable,
} from "@workspace/db";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireRole, requireWorkspace, type AuthenticatedRequest } from "../middlewares/auth";
import { enqueueManualBilling, requeueMessage, triggerImmediateWorker } from "../services/whatsapp-automation";
import { callName, composePreview, composeReceipt, storedBody } from "../services/whatsapp-compose";
import {
  canonicalBrazilianPhone,
  checkWhatsAppNumber,
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
  normalizeWhatsAppPhone,
  normalizeWhatsAppPhoneList,
  phonesMatch,
  sendManualTextMessage,
  sendManualMediaMessage,
} from "../services/whatsapp-session";
import { sendTestMessage, TestSendError } from "../services/whatsapp-test";
import {
  MAX_TEMPLATE_LENGTH,
  TEMPLATE_KINDS,
  TEMPLATE_META,
  isTemplateKind,
  unknownVariables,
  type TemplateKind,
} from "../services/whatsapp-templates";
import { detectPixKeyType, normalizePixKey, PIX_KEY_TYPE_LABEL } from "../lib/pix";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 }, // 64MB max
});

// Auto-ensure WhatsApp media columns exist in PostgreSQL using raw pool query
void pool.query(`
  ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_type TEXT;
  ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
  ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_mime_type TEXT;
  ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_filename TEXT;
  ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_size INTEGER;
  ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_duration INTEGER;
  CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_media_type ON whatsapp_messages (media_type);
`).catch((err) => logger.warn({ err: err?.message }, "WhatsApp media columns migration check warning"));
const ADMIN_ROLES = ["owner", "admin", "ceo", "cto", "cmo", "member"];
router.use(requireAuth, requireWorkspace, requireRole(ADMIN_ROLES));

const PIX_KEY_TYPES = ["auto", "cpf", "cnpj", "phone", "email", "random"] as const;

const settingsInput = z.object({
  autoBillingEnabled: z.boolean().optional(),
  daysBeforeDue: z.number().int().min(0).max(30).optional(),
  sendOnDueDate: z.boolean().optional(),
  daysAfterDue: z.number().int().min(0).max(30).optional(),
  dailySendHour: z.number().int().min(0).max(23).optional(),
  pixKey: z.string().trim().max(200).nullable().optional(),
  pixKeyType: z.enum(PIX_KEY_TYPES).optional(),
  pixMerchantName: z.string().trim().max(25).nullable().optional(),
  pixMerchantCity: z.string().trim().max(15).nullable().optional(),
  pixDeliveryMode: z.enum(["text", "native"]).optional(),
  withdrawalAlertsEnabled: z.boolean().optional(),
  expenseAlertsEnabled: z.boolean().optional(),
  movementAlertsEnabled: z.boolean().optional(),
  clientMessagePushEnabled: z.boolean().optional(),
  paymentAlertsEnabled: z.boolean().optional(),
  receiptEnabled: z.boolean().optional(),
  optOutHintEnabled: z.boolean().optional(),
  dailyMessageLimit: z.number().int().min(1).max(500).optional(),
  assistantName: z.string().trim().min(1).max(30).optional(),
  companyName: z.string().trim().min(1).max(40).optional(),
  // null or blank restores the default text for that message.
  templates: z.record(z.string(), z.string().max(MAX_TEMPLATE_LENGTH).nullable()).optional(),
}).strict();

type SettingsRow = typeof whatsappSettingsTable.$inferSelect;

const defaultSettings = {
  autoBillingEnabled: false,
  daysBeforeDue: 3,
  sendOnDueDate: true,
  daysAfterDue: 3,
  dailySendHour: 10,
  pixKey: "",
  pixKeyType: "auto" as (typeof PIX_KEY_TYPES)[number],
  pixMerchantName: "",
  pixMerchantCity: "",
  pixDeliveryMode: "text" as "text" | "native",
  withdrawalAlertsEnabled: false,
  expenseAlertsEnabled: true,
  movementAlertsEnabled: true,
  clientMessagePushEnabled: true,
  paymentAlertsEnabled: false,
  receiptEnabled: true,
  optOutHintEnabled: true,
  dailyMessageLimit: 100,
  assistantName: "Nexus",
  companyName: "Teltech",
  templates: {} as Record<string, string>,
};

function publicSettings(row?: SettingsRow) {
  const pixKey = row?.pixKey ?? defaultSettings.pixKey;
  const pixKeyType = (row?.pixKeyType ?? defaultSettings.pixKeyType) as (typeof PIX_KEY_TYPES)[number];
  const detected = pixKey ? normalizePixKey(pixKey, pixKeyType) : null;
  return {
    autoBillingEnabled: row?.autoBillingEnabled ?? defaultSettings.autoBillingEnabled,
    daysBeforeDue: row?.daysBeforeDue ?? defaultSettings.daysBeforeDue,
    sendOnDueDate: row?.sendOnDueDate ?? defaultSettings.sendOnDueDate,
    daysAfterDue: row?.daysAfterDue ?? defaultSettings.daysAfterDue,
    dailySendHour: row?.dailySendHour ?? defaultSettings.dailySendHour,
    pixKey,
    pixKeyType,
    pixMerchantName: row?.pixMerchantName ?? defaultSettings.pixMerchantName,
    pixMerchantCity: row?.pixMerchantCity ?? defaultSettings.pixMerchantCity,
    pixDeliveryMode: (row?.pixDeliveryMode ?? defaultSettings.pixDeliveryMode) as "text" | "native",
    withdrawalAlertsEnabled: row?.withdrawalAlertsEnabled ?? defaultSettings.withdrawalAlertsEnabled,
    expenseAlertsEnabled: row?.expenseAlertsEnabled ?? defaultSettings.expenseAlertsEnabled,
    movementAlertsEnabled: row?.movementAlertsEnabled ?? defaultSettings.movementAlertsEnabled,
    clientMessagePushEnabled: row?.clientMessagePushEnabled ?? defaultSettings.clientMessagePushEnabled,
    paymentAlertsEnabled: row?.paymentAlertsEnabled ?? defaultSettings.paymentAlertsEnabled,
    receiptEnabled: row?.receiptEnabled ?? defaultSettings.receiptEnabled,
    optOutHintEnabled: row?.optOutHintEnabled ?? defaultSettings.optOutHintEnabled,
    dailyMessageLimit: row?.dailyMessageLimit ?? defaultSettings.dailyMessageLimit,
    assistantName: row?.assistantName ?? defaultSettings.assistantName,
    companyName: row?.companyName ?? defaultSettings.companyName,
    templates: row?.templates ?? defaultSettings.templates,
    pixKeyResolved: detected ? { type: detected.type, label: PIX_KEY_TYPE_LABEL[detected.type], key: detected.key } : null,
  };
}

function workspaceId(req: unknown): string {
  return (req as AuthenticatedRequest).user.workspaceId!;
}

async function readSettings(wsId: string): Promise<SettingsRow | undefined> {
  const [stored] = await db.select().from(whatsappSettingsTable)
    .where(eq(whatsappSettingsTable.workspaceId, wsId)).limit(1);
  return stored;
}

/**
 * Numbers saved in the old comma-separated field become contacts the first
 * time the contact list is opened, so the user only has to give them a name.
 */
async function migrateLegacyContacts(wsId: string): Promise<void> {
  const existing = await db.select({ id: whatsappContactsTable.id }).from(whatsappContactsTable)
    .where(eq(whatsappContactsTable.workspaceId, wsId)).limit(1);
  if (existing.length) return;
  const settings = await readSettings(wsId);
  const phones = normalizeWhatsAppPhoneList(settings?.internalAlertPhone)?.split(", ") ?? [];
  if (!phones.length) return;
  await db.insert(whatsappContactsTable).values(phones.map((phone) => ({
    workspaceId: wsId,
    name: `Contato interno (final ${phone.slice(-4)})`,
    phone,
    notifyWithdrawals: true,
    notifyPayments: false,
  }))).onConflictDoNothing();
  await db.update(whatsappSettingsTable).set({ internalAlertPhone: null })
    .where(eq(whatsappSettingsTable.workspaceId, wsId));
}

router.get("/status", async (req, res) => {
  try {
    res.json(await getWhatsAppStatus(workspaceId(req)));
  } catch (error) {
    logger.error({ err: error }, "WhatsApp status failed");
    res.status(500).json({ error: "Não foi possível consultar a conexão" });
  }
});

router.post("/connect", async (req, res) => {
  const wsId = workspaceId(req);
  try {
    await connectWhatsApp(wsId);
    res.json(await getWhatsAppStatus(wsId));
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp connect failed");
    const message = error instanceof Error ? error.message : "Falha ao conectar WhatsApp";
    res.status(message.includes("WHATSAPP_SESSION_KEY") ? 503 : 500).json({ error: message });
  }
});

router.post("/disconnect", async (req, res) => {
  const wsId = workspaceId(req);
  try {
    await disconnectWhatsApp(wsId);
    res.json(await getWhatsAppStatus(wsId));
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp disconnect failed");
    res.status(500).json({ error: "Não foi possível desconectar o WhatsApp" });
  }
});

router.get("/settings", async (req, res) => {
  const wsId = workspaceId(req);
  try {
    res.json({ settings: publicSettings(await readSettings(wsId)) });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp settings read failed");
    res.status(500).json({ error: "Não foi possível consultar as configurações" });
  }
});

router.put("/settings", async (req, res) => {
  const wsId = workspaceId(req);
  const parsed = settingsInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Configurações inválidas", details: parsed.error.flatten() });
    return;
  }
  try {
    const stored = await readSettings(wsId);
    const current = publicSettings(stored);
    const { templates: templatePatch, ...patch } = parsed.data;

    const templates: Record<string, string> = { ...current.templates };
    for (const [kind, body] of Object.entries(templatePatch ?? {})) {
      if (!isTemplateKind(kind)) {
        res.status(400).json({ error: `Tipo de mensagem desconhecido: ${kind}` });
        return;
      }
      if (!body?.trim()) {
        delete templates[kind];
        continue;
      }
      const unknown = unknownVariables(kind, body);
      if (unknown.length) {
        res.status(400).json({
          error: `Variáveis inválidas em "${TEMPLATE_META[kind].label}": ${unknown.map((name) => `{${name}}`).join(", ")}`,
        });
        return;
      }
      templates[kind] = body;
    }

    const pixKey = (patch.pixKey !== undefined ? patch.pixKey : current.pixKey)?.trim() || null;
    const pixKeyType = patch.pixKeyType ?? current.pixKeyType;
    if (pixKey && !normalizePixKey(pixKey, pixKeyType)) {
      res.status(400).json({
        error: pixKeyType === "auto"
          ? "Não reconhecemos essa chave Pix. Confira o valor ou escolha o tipo da chave."
          : `A chave informada não é um(a) ${PIX_KEY_TYPE_LABEL[pixKeyType]} válido(a).`,
      });
      return;
    }

    const next = {
      autoBillingEnabled: patch.autoBillingEnabled ?? current.autoBillingEnabled,
      daysBeforeDue: patch.daysBeforeDue ?? current.daysBeforeDue,
      sendOnDueDate: patch.sendOnDueDate ?? current.sendOnDueDate,
      daysAfterDue: patch.daysAfterDue ?? current.daysAfterDue,
      dailySendHour: patch.dailySendHour ?? current.dailySendHour,
      pixKey,
      pixKeyType,
      pixMerchantName: (patch.pixMerchantName !== undefined ? patch.pixMerchantName : current.pixMerchantName)?.trim() || null,
      pixMerchantCity: (patch.pixMerchantCity !== undefined ? patch.pixMerchantCity : current.pixMerchantCity)?.trim() || null,
      pixDeliveryMode: patch.pixDeliveryMode ?? current.pixDeliveryMode,
      withdrawalAlertsEnabled: patch.withdrawalAlertsEnabled ?? current.withdrawalAlertsEnabled,
      paymentAlertsEnabled: patch.paymentAlertsEnabled ?? current.paymentAlertsEnabled,
      receiptEnabled: patch.receiptEnabled ?? current.receiptEnabled,
      optOutHintEnabled: patch.optOutHintEnabled ?? current.optOutHintEnabled,
      dailyMessageLimit: patch.dailyMessageLimit ?? current.dailyMessageLimit,
      assistantName: patch.assistantName ?? current.assistantName,
      companyName: patch.companyName ?? current.companyName,
      templates,
    };
    if (next.autoBillingEnabled && !next.pixKey) {
      res.status(400).json({ error: "Cadastre a chave Pix antes de ativar cobranças automáticas" });
      return;
    }
    if (next.withdrawalAlertsEnabled || next.paymentAlertsEnabled) {
      await migrateLegacyContacts(wsId);
      const contacts = await db.select().from(whatsappContactsTable).where(eq(whatsappContactsTable.workspaceId, wsId));
      const active = contacts.filter((contact) => contact.active);
      if (next.withdrawalAlertsEnabled && !active.some((contact) => contact.notifyWithdrawals)) {
        res.status(400).json({ error: "Cadastre ao menos um sócio ativo que receba avisos de retirada" });
        return;
      }
      if (next.paymentAlertsEnabled && !active.some((contact) => contact.notifyPayments)) {
        res.status(400).json({ error: "Cadastre ao menos um sócio ativo que receba avisos de pagamento" });
        return;
      }
    }
    const [saved] = await db.insert(whatsappSettingsTable)
      .values({ ...next, workspaceId: wsId, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: whatsappSettingsTable.workspaceId,
        set: { ...next, updatedAt: new Date() },
      }).returning();
    res.json({ settings: publicSettings(saved) });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp settings update failed");
    res.status(500).json({ error: "Não foi possível salvar as configurações" });
  }
});

// ─── Message templates ────────────────────────────────────────────────────────

router.get("/templates", (_req, res) => {
  res.json({
    templates: TEMPLATE_KINDS.map((kind) => {
      const meta = TEMPLATE_META[kind];
      return {
        kind,
        label: meta.label,
        description: meta.description,
        audience: meta.audience,
        supportsPix: meta.supportsPix,
        variables: meta.variables,
        defaultBody: meta.defaultBody,
      };
    }),
  });
});

const previewInput = z.object({
  kind: z.string().refine(isTemplateKind, "Tipo de mensagem desconhecido"),
  template: z.string().max(MAX_TEMPLATE_LENGTH).nullable().optional(),
  // Unsaved edits from the settings screen, so the preview matches what is on screen.
  overrides: z.object({
    assistantName: z.string().trim().max(30).optional(),
    companyName: z.string().trim().max(40).optional(),
    pixKey: z.string().trim().max(200).nullable().optional(),
    pixKeyType: z.enum(PIX_KEY_TYPES).optional(),
    pixMerchantName: z.string().trim().max(25).nullable().optional(),
    pixMerchantCity: z.string().trim().max(15).nullable().optional(),
    pixDeliveryMode: z.enum(["text", "native"]).optional(),
    optOutHintEnabled: z.boolean().optional(),
  }).optional(),
}).strict();

router.post("/preview", async (req, res) => {
  const wsId = workspaceId(req);
  const parsed = previewInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Prévia inválida" });
    return;
  }
  try {
    const kind = parsed.data.kind as TemplateKind;
    const stored = await readSettings(wsId);
    const overrides = parsed.data.overrides ?? {};
    const settings = {
      ...(stored ?? {}),
      ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined && value !== "")),
    } as Partial<SettingsRow>;
    if (overrides.pixKey === "" || overrides.pixKey === null) settings.pixKey = null;
    const template = parsed.data.template ?? undefined;
    const unknown = template ? unknownVariables(kind, template) : [];
    const preview = composePreview(kind, settings, { templateOverride: template });
    res.json({
      text: preview.text,
      fallbackText: preview.fallbackText ?? null,
      footer: preview.footer ?? null,
      pix: preview.pix
        ? { mode: preview.pixMode, key: preview.pix.key, keyType: preview.pix.keyType, code: preview.pix.code, merchantName: preview.pix.merchantName, amountCents: preview.pix.amountCents }
        : null,
      unknownVariables: unknown,
    });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp preview failed");
    res.status(500).json({ error: "Não foi possível gerar a prévia" });
  }
});

// ─── Internal contacts (partners) ─────────────────────────────────────────────

const contactInput = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(80),
  nickname: z.string().trim().max(40).nullable().optional(),
  roleLabel: z.string().trim().max(40).nullable().optional(),
  phone: z.string().trim().min(8, "Informe o WhatsApp").max(30),
  userId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  notifyWithdrawals: z.boolean().optional(),
  notifyPayments: z.boolean().optional(),
  notifyExpenses: z.boolean().optional(),
  notifyMovements: z.boolean().optional(),
}).strict();

function publicContact(row: typeof whatsappContactsTable.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    nickname: row.nickname,
    roleLabel: row.roleLabel,
    phone: row.phone,
    callName: callName(row),
    active: row.active,
    notifyWithdrawals: row.notifyWithdrawals,
    notifyPayments: row.notifyPayments,
    notifyExpenses: row.notifyExpenses,
    notifyMovements: row.notifyMovements,
  };
}

async function validateMember(wsId: string, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return true;
  const [member] = await db.select({ id: workspaceMembersTable.id }).from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, wsId), eq(workspaceMembersTable.userId, userId))).limit(1);
  return Boolean(member);
}

router.get("/members", async (req, res) => {
  const wsId = workspaceId(req);
  try {
    const rows = await db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, role: workspaceMembersTable.role })
      .from(workspaceMembersTable)
      .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
      .where(eq(workspaceMembersTable.workspaceId, wsId))
      .orderBy(asc(usersTable.name));
    res.json({ members: rows });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp members read failed");
    res.status(500).json({ error: "Não foi possível consultar os membros" });
  }
});

router.get("/contacts", async (req, res) => {
  const wsId = workspaceId(req);
  try {
    await migrateLegacyContacts(wsId);
    const rows = await db.select().from(whatsappContactsTable)
      .where(eq(whatsappContactsTable.workspaceId, wsId)).orderBy(asc(whatsappContactsTable.createdAt));
    res.json({ contacts: rows.map(publicContact) });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp contacts read failed");
    res.status(500).json({ error: "Não foi possível consultar os contatos" });
  }
});

router.post("/contacts", async (req, res) => {
  const wsId = workspaceId(req);
  const parsed = contactInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Contato inválido" });
    return;
  }
  const phone = normalizeWhatsAppPhone(parsed.data.phone);
  if (!phone) {
    res.status(400).json({ error: "WhatsApp inválido. Use DDD + número, ex: 14 99836-4338" });
    return;
  }
  try {
    if (!(await validateMember(wsId, parsed.data.userId))) {
      res.status(400).json({ error: "Usuário não pertence a este workspace" });
      return;
    }
    const [created] = await db.insert(whatsappContactsTable).values({
      workspaceId: wsId,
      userId: parsed.data.userId ?? null,
      name: parsed.data.name,
      nickname: parsed.data.nickname?.trim() || null,
      roleLabel: parsed.data.roleLabel?.trim() || null,
      phone,
      active: parsed.data.active ?? true,
      notifyWithdrawals: parsed.data.notifyWithdrawals ?? true,
      notifyPayments: parsed.data.notifyPayments ?? false,
      notifyExpenses: parsed.data.notifyExpenses ?? true,
      notifyMovements: parsed.data.notifyMovements ?? true,
    }).onConflictDoNothing().returning();
    if (!created) {
      res.status(409).json({ error: "Já existe um contato com este número" });
      return;
    }
    res.status(201).json({ contact: publicContact(created) });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp contact create failed");
    res.status(500).json({ error: "Não foi possível salvar o contato" });
  }
});

router.put("/contacts/:id", async (req, res) => {
  const wsId = workspaceId(req);
  const id = z.string().uuid().safeParse(req.params.id);
  const parsed = contactInput.partial().strict().safeParse(req.body);
  if (!id.success || !parsed.success) {
    res.status(400).json({ error: parsed.success ? "Contato inválido" : (parsed.error.issues[0]?.message ?? "Contato inválido") });
    return;
  }
  const data = parsed.data;
  let phone: string | undefined;
  if (data.phone !== undefined) {
    const normalized = normalizeWhatsAppPhone(data.phone);
    if (!normalized) {
      res.status(400).json({ error: "WhatsApp inválido. Use DDD + número, ex: 14 99836-4338" });
      return;
    }
    phone = normalized;
  }
  try {
    if (!(await validateMember(wsId, data.userId))) {
      res.status(400).json({ error: "Usuário não pertence a este workspace" });
      return;
    }
    const [updated] = await db.update(whatsappContactsTable).set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.nickname !== undefined ? { nickname: data.nickname?.trim() || null } : {}),
      ...(data.roleLabel !== undefined ? { roleLabel: data.roleLabel?.trim() || null } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(data.userId !== undefined ? { userId: data.userId } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.notifyWithdrawals !== undefined ? { notifyWithdrawals: data.notifyWithdrawals } : {}),
      ...(data.notifyPayments !== undefined ? { notifyPayments: data.notifyPayments } : {}),
      updatedAt: new Date(),
    }).where(and(eq(whatsappContactsTable.id, id.data), eq(whatsappContactsTable.workspaceId, wsId))).returning();
    if (!updated) {
      res.status(404).json({ error: "Contato não encontrado" });
      return;
    }
    res.json({ contact: publicContact(updated) });
  } catch (error) {
    const duplicate = (error as { code?: string } | undefined)?.code === "23505";
    if (!duplicate) logger.error({ err: error, workspaceId: wsId }, "WhatsApp contact update failed");
    res.status(duplicate ? 409 : 500).json({ error: duplicate ? "Já existe um contato com este número" : "Não foi possível salvar o contato" });
  }
});

router.delete("/contacts/:id", async (req, res) => {
  const wsId = workspaceId(req);
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: "Contato inválido" });
    return;
  }
  try {
    const [removed] = await db.delete(whatsappContactsTable)
      .where(and(eq(whatsappContactsTable.id, id.data), eq(whatsappContactsTable.workspaceId, wsId))).returning({ id: whatsappContactsTable.id });
    if (!removed) {
      res.status(404).json({ error: "Contato não encontrado" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp contact delete failed");
    res.status(500).json({ error: "Não foi possível remover o contato" });
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

router.post("/check-number", async (req, res) => {
  const wsId = workspaceId(req);
  const parsed = z.object({ phone: z.string().trim().min(8).max(30) }).strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe o número" });
    return;
  }
  try {
    const result = await checkWhatsAppNumber(wsId, parsed.data.phone);
    res.json({ phone: result.phone, exists: result.exists });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao verificar o número";
    const known = message === "WhatsApp não conectado" || message === "Telefone de destino inválido";
    if (!known) logger.error({ err: error, workspaceId: wsId }, "WhatsApp number check failed");
    res.status(message === "WhatsApp não conectado" ? 409 : known ? 400 : 500).json({ error: known ? message : "Não foi possível verificar o número" });
  }
});

const testInput = z.object({
  kind: z.enum(["connection", ...TEMPLATE_KINDS] as [string, ...string[]]),
  target: z.enum(["self", "contact", "custom"]),
  contactId: z.string().uuid().optional(),
  phone: z.string().trim().max(30).optional(),
}).strict();

router.post("/test", async (req, res) => {
  const wsId = workspaceId(req);
  const parsed = testInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Teste inválido" });
    return;
  }
  const { kind, target, contactId, phone } = parsed.data;
  try {
    let destination: string | null | undefined;
    let recipientName: string | undefined;
    if (target === "self") {
      destination = (await getWhatsAppStatus(wsId)).phone;
      if (!destination) {
        res.status(409).json({ error: "WhatsApp não conectado" });
        return;
      }
    } else if (target === "contact") {
      const [contact] = contactId
        ? await db.select().from(whatsappContactsTable)
          .where(and(eq(whatsappContactsTable.id, contactId), eq(whatsappContactsTable.workspaceId, wsId))).limit(1)
        : [];
      if (!contact) {
        res.status(404).json({ error: "Contato não encontrado" });
        return;
      }
      destination = contact.phone;
      recipientName = callName(contact);
    } else {
      destination = phone;
    }
    if (!destination) {
      res.status(400).json({ error: "Informe o número de destino" });
      return;
    }
    const result = await sendTestMessage(wsId, {
      kind: kind as Parameters<typeof sendTestMessage>[1]["kind"],
      phone: destination,
      recipientName,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof TestSendError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp test send failed");
    res.status(500).json({ error: "Não foi possível enviar o teste" });
  }
});

// ─── History ──────────────────────────────────────────────────────────────────

router.get("/messages", async (req, res) => {
  const wsId = workspaceId(req);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "50"), 10) || 50));
  try {
    const rows = await db.select({ message: whatsappMessagesTable, clientName: clientsTable.name })
      .from(whatsappMessagesTable)
      .leftJoin(clientsTable, eq(whatsappMessagesTable.clientId, clientsTable.id))
      .where(eq(whatsappMessagesTable.workspaceId, wsId))
      .orderBy(desc(whatsappMessagesTable.createdAt))
      .limit(limit);
    const contacts = await db.select({ phone: whatsappContactsTable.phone, name: whatsappContactsTable.name })
      .from(whatsappContactsTable).where(eq(whatsappContactsTable.workspaceId, wsId));
    const contactNames = new Map(contacts.map((contact) => [contact.phone, contact.name]));
    res.json({
      messages: rows.map(({ message, clientName }) => ({
        ...message,
        clientName: clientName ?? contactNames.get(message.recipient) ?? null,
      })),
    });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp message history failed");
    res.status(500).json({ error: "Não foi possível consultar as mensagens" });
  }
});

router.post("/messages/:id/retry", async (req, res) => {
  const wsId = workspaceId(req);
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: "Mensagem inválida" });
    return;
  }
  try {
    const result = await requeueMessage(wsId, id.data);
    if (!result.ok) {
      res.status(result.reason === "Mensagem não encontrada" ? 404 : 409).json({ error: result.reason });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp message retry failed");
    res.status(500).json({ error: "Não foi possível reenviar a mensagem" });
  }
});

router.post("/messages/manual-billing", async (req, res) => {
  const wsId = workspaceId(req);
  const parsed = z.object({ transactionId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "transactionId inválido" });
    return;
  }
  try {
    const result = await enqueueManualBilling(wsId, parsed.data.transactionId);
    if (!result.ok) {
      res.status(result.reason === "Transação não encontrada" ? 404 : result.conflict ? 409 : 422).json({ error: result.reason });
      return;
    }
    res.status(result.created ? 202 : 200).json({ message: result.message, created: result.created });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp manual billing enqueue failed");
    res.status(500).json({ error: "Não foi possível enfileirar a cobrança" });
  }
});

// Exposed for the settings screen: tells which key type was detected while typing.
router.post("/pix/detect", (req, res) => {
  const parsed = z.object({ key: z.string().max(200) }).strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Chave inválida" });
    return;
  }
  const type = detectPixKeyType(parsed.data.key);
  res.json({ type, label: type ? PIX_KEY_TYPE_LABEL[type] : null });
});

// ─── Monitoring & Cobranças Chat Module ───────────────────────────────────────

router.get("/monitoring/stats", async (req, res) => {
  const wsId = workspaceId(req);
  try {
    const status = await getWhatsAppStatus(wsId);
    const messages = await db.select({
      id: whatsappMessagesTable.id,
      direction: whatsappMessagesTable.direction,
      clientId: whatsappMessagesTable.clientId,
      recipient: whatsappMessagesTable.recipient,
      senderPhone: whatsappMessagesTable.senderPhone,
    }).from(whatsappMessagesTable).where(eq(whatsappMessagesTable.workspaceId, wsId));

    const totalSent = messages.filter(m => m.direction === "outbound").length;
    const totalReceived = messages.filter(m => m.direction === "inbound").length;

    const uniqueClientsOrPhones = new Set<string>();
    const repliedClientsOrPhones = new Set<string>();

    for (const m of messages) {
      const key = m.clientId ?? m.recipient ?? m.senderPhone ?? "unknown";
      uniqueClientsOrPhones.add(key);
      if (m.direction === "inbound") {
        repliedClientsOrPhones.add(key);
      }
    }

    const totalConversations = uniqueClientsOrPhones.size;
    const responseRate = totalConversations > 0
      ? Math.round((repliedClientsOrPhones.size / totalConversations) * 100)
      : 0;

    const now = new Date();
    const pendingTransactions = await db.select({
      id: financialTransactionsTable.id,
      amount: financialTransactionsTable.amount,
      dueDate: financialTransactionsTable.dueDate,
    }).from(financialTransactionsTable)
      .where(and(
        eq(financialTransactionsTable.workspaceId, wsId),
        eq(financialTransactionsTable.type, "inflow"),
        eq(financialTransactionsTable.status, "pending")
      ));

    const overdueList = pendingTransactions.filter(t => new Date(t.dueDate) < now);
    const totalOverdueCents = overdueList.reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalPendingCents = pendingTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

    res.json({
      status,
      totalConversations,
      totalSent,
      totalReceived,
      responseRate,
      overdueCount: overdueList.length,
      totalOverdueCents,
      totalPendingCents,
    });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp monitoring stats failed");
    res.status(500).json({ error: "Falha ao obter estatísticas de monitoramento" });
  }
});

function formatPhoneDisplayServer(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

router.get("/monitoring/conversations", async (req, res) => {
  const wsId = workspaceId(req);
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const filter = typeof req.query.filter === "string" ? req.query.filter : "all"; // 'all' | 'partners' | 'clients' | 'replied' | 'waiting' | 'overdue'

  try {
    // Clean up any historical duplicate messages in the DB that share waMessageId
    try {
      await db.execute(sql`
        DELETE FROM whatsapp_messages a USING whatsapp_messages b
        WHERE a.id > b.id
          AND a.workspace_id = ${wsId}
          AND b.workspace_id = ${wsId}
          AND a.wa_message_id IS NOT NULL
          AND a.wa_message_id = b.wa_message_id;
      `);
    } catch {
      // best-effort cleanup
    }

    // 1. Fetch Clients, Internal Partners/Contacts, and Workspace Members (Founders/Team)
    const [allClients, allContacts, allMembers] = await Promise.all([
      db.select().from(clientsTable).where(eq(clientsTable.workspaceId, wsId)),
      db.select().from(whatsappContactsTable).where(eq(whatsappContactsTable.workspaceId, wsId)),
      db.select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        phone: usersTable.phone,
        avatarUrl: usersTable.avatarUrl,
        role: workspaceMembersTable.role,
      })
      .from(usersTable)
      .innerJoin(workspaceMembersTable, eq(usersTable.id, workspaceMembersTable.userId))
      .where(eq(workspaceMembersTable.workspaceId, wsId)),
    ]);

    const clientMap = new Map(allClients.map(c => [c.id, c]));
    const contactMap = new Map(allContacts.map(c => [c.id, c]));
    const memberMap = new Map(allMembers.map(m => [m.id, m]));

    // Phone matcher helper across partners, team members, and clients
    const resolveContactByPhone = (rawPhone: string | null | undefined) => {
      if (!rawPhone) return null;
      // 1. Partner contacts (WhatsApp settings "Sócios & avisos")
      const matchedContact = allContacts.find(c => phonesMatch(c.phone, rawPhone));
      if (matchedContact) {
        return {
          type: "partner" as const,
          id: matchedContact.id,
          name: matchedContact.name,
          nickname: matchedContact.nickname,
          roleLabel: matchedContact.roleLabel || "Sócio",
          phone: matchedContact.phone,
          isPartner: true,
          userId: matchedContact.userId,
          partnerId: matchedContact.id,
        };
      }
      // 2. Workspace members (Sócios / fundadores cadastrados no sistema)
      const matchedMember = allMembers.find(m => phonesMatch(m.phone, rawPhone));
      if (matchedMember) {
        const isFounder = matchedMember.role === "owner" || matchedMember.email === "tarcisio@teltech.com.br" || matchedMember.email === "lucas@teltech.com.br";
        return {
          type: "partner" as const,
          id: matchedMember.id,
          name: matchedMember.name,
          nickname: matchedMember.name.split(" ")[0],
          roleLabel: isFounder ? "Sócio Co-Founder" : "Membro / Equipe",
          phone: matchedMember.phone || rawPhone,
          isPartner: true,
          userId: matchedMember.id,
          partnerId: matchedMember.id,
        };
      }
      // 3. Clients
      const matchedClient = allClients.find(c => phonesMatch(c.phone, rawPhone));
      if (matchedClient) {
        return {
          type: "client" as const,
          id: matchedClient.id,
          name: matchedClient.name,
          nickname: null,
          roleLabel: "Cliente",
          phone: matchedClient.phone,
          isPartner: false,
          client: matchedClient,
        };
      }
      return null;
    };

    const sessionStatus = await getWhatsAppStatus(wsId);
    const selfPhoneCanon = sessionStatus.phone ? (canonicalBrazilianPhone(sessionStatus.phone) || normalizeWhatsAppPhone(sessionStatus.phone)) : null;

    // Deduplicate messages in memory before grouping
    let rawMessages: any[] = [];
    try {
      rawMessages = await db.select().from(whatsappMessagesTable)
        .where(eq(whatsappMessagesTable.workspaceId, wsId))
        .orderBy(desc(whatsappMessagesTable.createdAt));
    } catch (queryErr: any) {
      logger.warn({ queryErr: queryErr?.message }, "Full whatsappMessagesTable query failed, ensuring columns and retrying");
      try {
        await pool.query(`
          ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_type TEXT;
          ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
          ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_mime_type TEXT;
          ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_filename TEXT;
          ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_size INTEGER;
          ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_duration INTEGER;
        `);
        rawMessages = await db.select().from(whatsappMessagesTable)
          .where(eq(whatsappMessagesTable.workspaceId, wsId))
          .orderBy(desc(whatsappMessagesTable.createdAt));
      } catch (retryErr) {
        logger.error({ retryErr }, "Fallback to query without media columns");
        rawMessages = await db.select({
          id: whatsappMessagesTable.id,
          workspaceId: whatsappMessagesTable.workspaceId,
          clientId: whatsappMessagesTable.clientId,
          transactionId: whatsappMessagesTable.transactionId,
          recipient: whatsappMessagesTable.recipient,
          senderPhone: whatsappMessagesTable.senderPhone,
          senderName: whatsappMessagesTable.senderName,
          body: whatsappMessagesTable.body,
          kind: whatsappMessagesTable.kind,
          direction: whatsappMessagesTable.direction,
          status: whatsappMessagesTable.status,
          dedupeKey: whatsappMessagesTable.dedupeKey,
          waMessageId: whatsappMessagesTable.waMessageId,
          isRead: whatsappMessagesTable.isRead,
          sentAt: whatsappMessagesTable.sentAt,
          createdAt: whatsappMessagesTable.createdAt,
        }).from(whatsappMessagesTable)
          .where(eq(whatsappMessagesTable.workspaceId, wsId))
          .orderBy(desc(whatsappMessagesTable.createdAt));
      }
    }

    const seenMsgKeys = new Set<string>();
    const allMessages: typeof rawMessages = [];
    for (const msg of rawMessages) {
      const waKey = msg.waMessageId ? `wa:${msg.waMessageId}` : null;
      const dedupePrefix = msg.dedupeKey.startsWith("manual:") ? msg.dedupeKey.replace("manual:", "outbound:") : msg.dedupeKey;
      const bodySecKey = `${msg.direction}:${msg.recipient}:${msg.senderPhone}:${msg.body}:${Math.floor(new Date(msg.sentAt || msg.createdAt).getTime() / 1000)}`;
      if (waKey && seenMsgKeys.has(waKey)) continue;
      if (seenMsgKeys.has(dedupePrefix)) continue;
      if (seenMsgKeys.has(bodySecKey)) continue;
      if (waKey) seenMsgKeys.add(waKey);
      seenMsgKeys.add(dedupePrefix);
      seenMsgKeys.add(bodySecKey);
      allMessages.push(msg);
    }

    const allTransactions = await db.select().from(financialTransactionsTable)
      .where(and(
        eq(financialTransactionsTable.workspaceId, wsId),
        eq(financialTransactionsTable.type, "inflow"),
        eq(financialTransactionsTable.status, "pending")
      ));

    const conversationGroups = new Map<string, typeof allMessages>();

    for (const msg of allMessages) {
      const rawTargetPhone = msg.direction === "inbound" ? msg.senderPhone : msg.recipient;
      const targetPhoneNorm = normalizeWhatsAppPhone(rawTargetPhone);
      const targetPhoneCanon = canonicalBrazilianPhone(rawTargetPhone) || targetPhoneNorm;

      // Exclude internal test messages to self if there is no client or partner associated
      if (selfPhoneCanon && targetPhoneCanon === selfPhoneCanon && !msg.clientId) {
        continue;
      }

      let key: string;
      if (msg.clientId && clientMap.has(msg.clientId)) {
        key = `client:${msg.clientId}`;
      } else {
        const contactInfo = resolveContactByPhone(rawTargetPhone);
        if (contactInfo) {
          key = `${contactInfo.type}:${contactInfo.id}`;
        } else if (targetPhoneCanon) {
          key = `phone:${targetPhoneCanon}`;
        } else {
          key = `msg:${msg.id}`;
        }
      }

      const list = conversationGroups.get(key) ?? [];
      list.push(msg);
      conversationGroups.set(key, list);
    }

    // Include clients with open transactions or if searching
    for (const client of allClients) {
      const key = `client:${client.id}`;
      const hasPendingTxs = allTransactions.some(t => t.clientId === client.id);
      if (!conversationGroups.has(key)) {
        if (hasPendingTxs || search) {
          conversationGroups.set(key, []);
        }
      }
    }

    // Include registered partners in the list so they are always visible/accessible
    for (const contact of allContacts) {
      const key = `partner:${contact.id}`;
      if (!conversationGroups.has(key)) {
        conversationGroups.set(key, []);
      }
    }

    const now = new Date();
    const resultList: any[] = [];

    for (const [key, msgs] of conversationGroups.entries()) {
      let client: typeof allClients[0] | null = null;
      let partnerContact: typeof allContacts[0] | null = null;
      let memberUser: typeof allMembers[0] | null = null;
      let targetPhone: string = "";
      let isPartner = false;

      if (key.startsWith("client:")) {
        const cId = key.replace("client:", "");
        client = clientMap.get(cId) ?? null;
        targetPhone = client?.phone ? (canonicalBrazilianPhone(client.phone) || normalizeWhatsAppPhone(client.phone) || client.phone) : "";
      } else if (key.startsWith("partner:")) {
        const pId = key.replace("partner:", "");
        partnerContact = contactMap.get(pId) ?? null;
        if (!partnerContact) {
          memberUser = memberMap.get(pId) ?? null;
        }
        isPartner = true;
        const pPhone = partnerContact?.phone || memberUser?.phone || "";
        targetPhone = pPhone ? (canonicalBrazilianPhone(pPhone) || normalizeWhatsAppPhone(pPhone) || pPhone) : "";
      } else if (key.startsWith("phone:")) {
        targetPhone = key.replace("phone:", "");
        const resolved = resolveContactByPhone(targetPhone);
        if (resolved?.type === "partner") {
          isPartner = true;
          partnerContact = contactMap.get(resolved.id) ?? null;
          if (!partnerContact) memberUser = memberMap.get(resolved.id) ?? null;
        } else if (resolved?.type === "client") {
          client = clientMap.get(resolved.id) ?? null;
        }
      }

      const lastMessage = msgs[0] ?? null;
      const inboundCount = msgs.filter(m => m.direction === "inbound").length;
      const outboundCount = msgs.filter(m => m.direction === "outbound").length;
      const unreadCount = msgs.filter(m => m.direction === "inbound" && !m.isRead).length;
      const hasReplied = inboundCount > 0;

      // Determine display name without ever falsely using "Operador (Celular)" as the client/contact name
      let displayName: string;
      let roleLabel: string;

      if (isPartner) {
        displayName = partnerContact?.name || memberUser?.name || "Sócio";
        roleLabel = partnerContact?.roleLabel || (memberUser?.role === "owner" ? "Sócio Fundador" : "Sócio Co-Founder");
      } else if (client) {
        displayName = client.name;
        roleLabel = "Cliente";
      } else {
        // Unknown contact: only use lastMessage.senderName if INBOUND (sent by client) and NOT Operator or Nexus
        if (
          lastMessage?.direction === "inbound" &&
          lastMessage?.senderName &&
          lastMessage.senderName !== "Nexus" &&
          lastMessage.senderName !== "Cliente" &&
          !lastMessage.senderName.toLowerCase().includes("operador")
        ) {
          displayName = lastMessage.senderName;
        } else if (targetPhone) {
          displayName = formatPhoneDisplayServer(targetPhone);
        } else {
          displayName = "Contato";
        }
        roleLabel = "Contato";
      }

      const clientTransactions = client
        ? allTransactions.filter(t => t.clientId === client.id)
        : [];
      const overdueTransactions = clientTransactions.filter(t => new Date(t.dueDate) < now);
      const totalPendingCents = clientTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
      const totalOverdueCents = overdueTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

      const sortedTxs = [...clientTransactions].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      const nextDueDate = sortedTxs[0]?.dueDate ? sortedTxs[0].dueDate.toISOString() : null;

      const conversationItem = {
        id: client?.id ?? partnerContact?.id ?? memberUser?.id ?? targetPhone,
        clientId: client?.id ?? null,
        partnerId: partnerContact?.id ?? memberUser?.id ?? null,
        contactType: isPartner ? ("partner" as const) : (client ? ("client" as const) : ("unknown" as const)),
        clientName: displayName,
        nickname: partnerContact?.nickname ?? (isPartner && displayName ? displayName.split(" ")[0] : null),
        roleLabel,
        isPartner,
        phone: targetPhone || client?.phone || partnerContact?.phone || memberUser?.phone || lastMessage?.recipient || lastMessage?.senderPhone || "",
        document: client?.document ?? null,
        optIn: isPartner ? true : (client?.whatsappOptIn ?? false),
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          body: lastMessage.body,
          sentAt: lastMessage.sentAt ?? lastMessage.createdAt,
          direction: lastMessage.direction,
          kind: lastMessage.kind,
          status: lastMessage.status,
          senderName: lastMessage.senderName,
          mediaType: lastMessage.mediaType,
          mediaUrl: lastMessage.mediaUrl,
          mediaFilename: lastMessage.mediaFilename,
          mediaDuration: lastMessage.mediaDuration,
        } : null,
        totalMessages: msgs.length,
        inboundCount,
        outboundCount,
        unreadCount,
        hasReplied,
        financialInfo: {
          pendingCount: isPartner ? 0 : clientTransactions.length,
          overdueCount: isPartner ? 0 : overdueTransactions.length,
          totalPendingCents: isPartner ? 0 : totalPendingCents,
          totalOverdueCents: isPartner ? 0 : totalOverdueCents,
          nextDueDate: isPartner ? null : nextDueDate,
          status: isPartner ? ("partner" as const) : (overdueTransactions.length > 0 ? ("overdue" as const) : (clientTransactions.length > 0 ? ("pending" as const) : ("paid_up" as const))),
        },
      };

      if (search) {
        const matchName = conversationItem.clientName.toLowerCase().includes(search);
        const matchPhone = conversationItem.phone.toLowerCase().includes(search);
        const matchDoc = conversationItem.document?.toLowerCase().includes(search) ?? false;
        const matchMsg = lastMessage?.body.toLowerCase().includes(search) ?? false;
        if (!matchName && !matchPhone && !matchDoc && !matchMsg) {
          continue;
        }
      }

      if (filter === "partners" && !isPartner) continue;
      if (filter === "clients" && isPartner) continue;
      if (filter === "replied" && !hasReplied) continue;
      if (filter === "waiting" && (hasReplied || msgs.length === 0)) continue;
      if (filter === "overdue" && overdueTransactions.length === 0) continue;

      resultList.push(conversationItem);
    }

    resultList.sort((a, b) => {
      const timeA = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt).getTime() : 0;
      const timeB = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      if (a.financialInfo.overdueCount !== b.financialInfo.overdueCount) {
        return b.financialInfo.overdueCount - a.financialInfo.overdueCount;
      }
      return a.clientName.localeCompare(b.clientName);
    });

    res.json({ conversations: resultList });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp monitoring conversations failed");
    res.status(500).json({ error: "Falha ao listar conversas de monitoramento" });
  }
});

router.get("/monitoring/conversations/:target/messages", async (req, res) => {
  const wsId = workspaceId(req);
  const target = req.params.target;

  try {
    const cleanTarget = target.startsWith("client:") ? target.replace("client:", "")
      : target.startsWith("partner:") ? target.replace("partner:", "")
      : target.startsWith("phone:") ? target.replace("phone:", "")
      : target;

    const isUuid = z.string().uuid().safeParse(cleanTarget).success;
    let client: any = null;
    let partner: any = null;
    let phone = normalizeWhatsAppPhone(cleanTarget);
    const targetCanon = canonicalBrazilianPhone(cleanTarget);

    const [allClients, allContacts, allMembers] = await Promise.all([
      db.select().from(clientsTable).where(eq(clientsTable.workspaceId, wsId)),
      db.select().from(whatsappContactsTable).where(eq(whatsappContactsTable.workspaceId, wsId)),
      db.select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        phone: usersTable.phone,
        role: workspaceMembersTable.role,
      })
      .from(usersTable)
      .innerJoin(workspaceMembersTable, eq(usersTable.id, workspaceMembersTable.userId))
      .where(eq(workspaceMembersTable.workspaceId, wsId)),
    ]);

    if (isUuid) {
      client = allClients.find(c => c.id === cleanTarget) ?? null;
      if (!client) {
        const foundContact = allContacts.find(c => c.id === cleanTarget);
        if (foundContact) {
          partner = {
            id: foundContact.id,
            name: foundContact.name,
            nickname: foundContact.nickname,
            roleLabel: foundContact.roleLabel || "Sócio",
            phone: foundContact.phone,
            userId: foundContact.userId,
            isPartner: true,
          };
        } else {
          const foundMember = allMembers.find(m => m.id === cleanTarget);
          if (foundMember) {
            partner = {
              id: foundMember.id,
              name: foundMember.name,
              nickname: foundMember.name.split(" ")[0],
              roleLabel: foundMember.role === "owner" ? "Sócio Fundador" : "Sócio Co-Founder",
              phone: foundMember.phone,
              userId: foundMember.id,
              email: foundMember.email,
              isPartner: true,
            };
          }
        }
      }
    }

    if (!client && !partner) {
      // Try matching by phone
      const foundContact = allContacts.find(c => phonesMatch(c.phone, cleanTarget));
      if (foundContact) {
        partner = {
          id: foundContact.id,
          name: foundContact.name,
          nickname: foundContact.nickname,
          roleLabel: foundContact.roleLabel || "Sócio",
          phone: foundContact.phone,
          userId: foundContact.userId,
          isPartner: true,
        };
      } else {
        const foundMember = allMembers.find(m => phonesMatch(m.phone, cleanTarget));
        if (foundMember) {
          partner = {
            id: foundMember.id,
            name: foundMember.name,
            nickname: foundMember.name.split(" ")[0],
            roleLabel: foundMember.role === "owner" ? "Sócio Fundador" : "Sócio Co-Founder",
            phone: foundMember.phone,
            userId: foundMember.id,
            email: foundMember.email,
            isPartner: true,
          };
        } else {
          client = allClients.find(c => phonesMatch(c.phone, cleanTarget)) ?? null;
        }
      }
    }

    const contactPhone = partner?.phone || client?.phone || cleanTarget;
    if (contactPhone) {
      phone = normalizeWhatsAppPhone(contactPhone);
    }

    const phoneSet = new Set<string>();
    if (phone) phoneSet.add(phone);
    if (targetCanon) phoneSet.add(targetCanon);
    if (contactPhone) {
      const cNorm = normalizeWhatsAppPhone(contactPhone);
      const cCanon = canonicalBrazilianPhone(contactPhone);
      if (cNorm) phoneSet.add(cNorm);
      if (cCanon) phoneSet.add(cCanon);
      if (cCanon && cCanon.startsWith("55") && cCanon.length === 13) {
        phoneSet.add(`55${cCanon.slice(2, 4)}${cCanon.slice(5)}`);
      }
    }

    const conditions = [];
    if (client) {
      conditions.push(eq(whatsappMessagesTable.clientId, client.id));
    }
    for (const p of phoneSet) {
      conditions.push(eq(whatsappMessagesTable.recipient, p));
      conditions.push(eq(whatsappMessagesTable.senderPhone, p));
    }

    if (conditions.length === 0) {
      res.json({ messages: [], client: null, partner: null, openTransactions: [], allTransactions: [] });
      return;
    }

    let messages: any[] = [];
    try {
      messages = await db.select({
        message: whatsappMessagesTable,
        txAmount: financialTransactionsTable.amount,
        txDueDate: financialTransactionsTable.dueDate,
        txDescription: financialTransactionsTable.description,
        txStatus: financialTransactionsTable.status,
      }).from(whatsappMessagesTable)
        .leftJoin(financialTransactionsTable, eq(whatsappMessagesTable.transactionId, financialTransactionsTable.id))
        .where(and(
          eq(whatsappMessagesTable.workspaceId, wsId),
          or(...conditions)
        ))
        .orderBy(asc(whatsappMessagesTable.createdAt));
    } catch (queryErr: any) {
      logger.warn({ queryErr: queryErr?.message }, "Failed to query messages with full table, ensuring columns");
      try {
        await pool.query(`
          ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_type TEXT;
          ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
          ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_mime_type TEXT;
          ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_filename TEXT;
          ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_size INTEGER;
          ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_duration INTEGER;
        `);
        messages = await db.select({
          message: whatsappMessagesTable,
          txAmount: financialTransactionsTable.amount,
          txDueDate: financialTransactionsTable.dueDate,
          txDescription: financialTransactionsTable.description,
          txStatus: financialTransactionsTable.status,
        }).from(whatsappMessagesTable)
          .leftJoin(financialTransactionsTable, eq(whatsappMessagesTable.transactionId, financialTransactionsTable.id))
          .where(and(
            eq(whatsappMessagesTable.workspaceId, wsId),
            or(...conditions)
          ))
          .orderBy(asc(whatsappMessagesTable.createdAt));
      } catch (retryErr) {
        logger.error({ retryErr }, "Fallback for messages query without full table select");
        const fallbackMsgs = await db.select({
          id: whatsappMessagesTable.id,
          workspaceId: whatsappMessagesTable.workspaceId,
          clientId: whatsappMessagesTable.clientId,
          transactionId: whatsappMessagesTable.transactionId,
          recipient: whatsappMessagesTable.recipient,
          senderPhone: whatsappMessagesTable.senderPhone,
          senderName: whatsappMessagesTable.senderName,
          body: whatsappMessagesTable.body,
          kind: whatsappMessagesTable.kind,
          direction: whatsappMessagesTable.direction,
          status: whatsappMessagesTable.status,
          dedupeKey: whatsappMessagesTable.dedupeKey,
          waMessageId: whatsappMessagesTable.waMessageId,
          isRead: whatsappMessagesTable.isRead,
          sentAt: whatsappMessagesTable.sentAt,
          createdAt: whatsappMessagesTable.createdAt,
          txAmount: financialTransactionsTable.amount,
          txDueDate: financialTransactionsTable.dueDate,
          txDescription: financialTransactionsTable.description,
          txStatus: financialTransactionsTable.status,
        }).from(whatsappMessagesTable)
          .leftJoin(financialTransactionsTable, eq(whatsappMessagesTable.transactionId, financialTransactionsTable.id))
          .where(and(
            eq(whatsappMessagesTable.workspaceId, wsId),
            or(...conditions)
          ))
          .orderBy(asc(whatsappMessagesTable.createdAt));

        messages = fallbackMsgs.map(row => ({
          message: {
            id: row.id,
            workspaceId: row.workspaceId,
            clientId: row.clientId,
            transactionId: row.transactionId,
            recipient: row.recipient,
            senderPhone: row.senderPhone,
            senderName: row.senderName,
            body: row.body,
            kind: row.kind,
            direction: row.direction,
            status: row.status,
            dedupeKey: row.dedupeKey,
            waMessageId: row.waMessageId,
            isRead: row.isRead,
            sentAt: row.sentAt,
            createdAt: row.createdAt,
            mediaType: null,
            mediaUrl: null,
            mediaMimeType: null,
            mediaFilename: null,
            mediaSize: null,
            mediaDuration: null,
          },
          txAmount: row.txAmount,
          txDueDate: row.txDueDate,
          txDescription: row.txDescription,
          txStatus: row.txStatus,
        }));
      }
    }

    const unreadIds = messages
      .filter(({ message }) => message.direction === "inbound" && !message.isRead)
      .map(({ message }) => message.id);

    if (unreadIds.length > 0) {
      void db.update(whatsappMessagesTable)
        .set({ isRead: true, updatedAt: new Date() })
        .where(and(eq(whatsappMessagesTable.workspaceId, wsId), inArray(whatsappMessagesTable.id, unreadIds)))
        .catch(err => logger.warn({ err }, "Failed to mark messages as read"));
    }

    let allTransactions: any[] = [];
    if (client) {
      allTransactions = await db.select().from(financialTransactionsTable)
        .where(and(
          eq(financialTransactionsTable.workspaceId, wsId),
          eq(financialTransactionsTable.clientId, client.id),
          eq(financialTransactionsTable.type, "inflow")
        ))
        .orderBy(asc(financialTransactionsTable.dueDate));
    } else if (partner) {
      const pUserId = partner.userId || partner.id;
      allTransactions = await db.select().from(financialTransactionsTable)
        .where(and(
          eq(financialTransactionsTable.workspaceId, wsId),
          or(
            eq(financialTransactionsTable.partnerId, pUserId),
            ilike(financialTransactionsTable.description, `%${partner.name}%`)
          )
        ))
        .orderBy(desc(financialTransactionsTable.dueDate));
    }

    const openTransactions = allTransactions.filter(t => t.status === "pending");

    // Deduplicate messages by waMessageId / timestamp to avoid duplicate bubbles
    const seenMsg = new Set<string>();
    const deduplicatedMessages = messages
      .filter(({ message }) => {
        const k = message.waMessageId ? `wa:${message.waMessageId}` : (message.id ? `id:${message.id}` : `${message.direction}:${message.body}:${message.sentAt}`);
        if (seenMsg.has(k)) return false;
        seenMsg.add(k);
        return true;
      })
      .map(({ message, txAmount, txDueDate, txDescription, txStatus }) => ({
        ...message,
        transaction: message.transactionId ? {
          id: message.transactionId,
          amount: txAmount,
          dueDate: txDueDate,
          description: txDescription,
          status: txStatus,
        } : null,
      }));

    res.json({
      client,
      partner,
      isPartner: Boolean(partner),
      contactType: partner ? "partner" : (client ? "client" : "unknown"),
      phone: targetCanon || phone || contactPhone || "",
      messages: deduplicatedMessages,
      openTransactions,
      allTransactions,
    });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId, target }, "WhatsApp monitoring messages failed");
    res.status(500).json({ error: "Falha ao carregar mensagens da conversa" });
  }
});

async function resolveTargetDestination(wsId: string, target: string): Promise<{ clientId: string | null; destinationPhone: string | null }> {
  const cleanTarget = target.startsWith("client:") ? target.replace("client:", "")
    : target.startsWith("partner:") ? target.replace("partner:", "")
    : target.startsWith("phone:") ? target.replace("phone:", "")
    : target;

  const isUuid = z.string().uuid().safeParse(cleanTarget).success;
  let clientId: string | null = null;
  let destinationPhone: string | null = null;

  if (isUuid) {
    const [client] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, cleanTarget), eq(clientsTable.workspaceId, wsId))).limit(1);
    if (client) {
      clientId = client.id;
      destinationPhone = canonicalBrazilianPhone(client.phone) || normalizeWhatsAppPhone(client.phone);
    } else {
      const [contact] = await db.select().from(whatsappContactsTable)
        .where(and(eq(whatsappContactsTable.id, cleanTarget), eq(whatsappContactsTable.workspaceId, wsId))).limit(1);
      if (contact) {
        destinationPhone = canonicalBrazilianPhone(contact.phone) || normalizeWhatsAppPhone(contact.phone);
      } else {
        const [member] = await db.select().from(usersTable)
          .where(eq(usersTable.id, cleanTarget)).limit(1);
        if (member?.phone) {
          destinationPhone = canonicalBrazilianPhone(member.phone) || normalizeWhatsAppPhone(member.phone);
        }
      }
    }
  } else {
    destinationPhone = canonicalBrazilianPhone(cleanTarget) || normalizeWhatsAppPhone(cleanTarget);
    if (destinationPhone) {
      const allClients = await db.select().from(clientsTable).where(eq(clientsTable.workspaceId, wsId));
      const matched = allClients.find(c => phonesMatch(c.phone, destinationPhone));
      if (matched) {
        clientId = matched.id;
      }
    }
  }

  return { clientId, destinationPhone };
}

router.post("/monitoring/conversations/:target/messages", async (req, res) => {
  const wsId = workspaceId(req);
  const target = req.params.target;
  const parsed = z.object({
    text: z.string().trim().min(1).max(4000),
    transactionId: z.string().uuid().optional().nullable(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Texto da mensagem é obrigatório" });
    return;
  }

  try {
    const { clientId, destinationPhone } = await resolveTargetDestination(wsId, target);

    if (!destinationPhone) {
      res.status(400).json({ error: "Número de telefone de destino inválido ou contato sem telefone cadastrado" });
      return;
    }

    const settings = await readSettings(wsId);
    const senderName = "Operador (Celular)";

    const created = await sendManualTextMessage(wsId, destinationPhone, parsed.data.text, {
      clientId,
      transactionId: parsed.data.transactionId ?? null,
      senderName,
    });

    res.status(201).json({ message: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar mensagem";
    const status = message === "WhatsApp não conectado" ? 409 : 500;
    if (status === 500) logger.error({ err: error, workspaceId: wsId }, "Send manual WhatsApp message failed");
    res.status(status).json({ error: message });
  }
});

router.post("/monitoring/conversations/:target/send-media", mediaUpload.single("file"), async (req, res) => {
  const wsId = workspaceId(req);
  const target = String(req.params.target);
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: "Arquivo de mídia não informado" });
    return;
  }

  const caption = typeof req.body.caption === "string" ? req.body.caption.trim() : undefined;
  const transactionId = typeof req.body.transactionId === "string" && z.string().uuid().safeParse(req.body.transactionId).success
    ? req.body.transactionId
    : null;

  try {
    const { clientId, destinationPhone } = await resolveTargetDestination(wsId, target);

    if (!destinationPhone) {
      res.status(400).json({ error: "Número de telefone de destino inválido ou contato sem telefone cadastrado" });
      return;
    }

    let mediaType: "image" | "audio" | "video" | "document" = "document";
    if (file.mimetype.startsWith("image/")) {
      mediaType = "image";
    } else if (file.mimetype.startsWith("audio/")) {
      mediaType = "audio";
    } else if (file.mimetype.startsWith("video/")) {
      mediaType = "video";
    }

    const senderName = "Operador (Celular)";

    const created = await sendManualMediaMessage(wsId, destinationPhone, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      filename: file.originalname,
      caption,
      mediaType,
    }, {
      clientId,
      transactionId,
      senderName,
    });

    res.status(201).json({ ok: true, message: created });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Falha ao enviar arquivo pelo WhatsApp";
    const status = message === "WhatsApp não conectado" ? 409 : 500;
    if (status === 500) logger.error({ err: error, workspaceId: wsId, target }, "Send WhatsApp media message failed");
    res.status(status).json({ error: message });
  }
});

router.get("/monitoring/media/:messageId", async (req, res) => {
  const wsId = workspaceId(req);
  const messageId = String(req.params.messageId);

  try {
    const [msg] = await db.select().from(whatsappMessagesTable)
      .where(and(eq(whatsappMessagesTable.workspaceId, wsId), eq(whatsappMessagesTable.id, messageId)))
      .limit(1);

    if (!msg || !msg.mediaUrl) {
      res.status(404).json({ error: "Mídia não encontrada para esta mensagem" });
      return;
    }

    const relPath = msg.mediaUrl.replace(/^\/uploads\//, "");
    const absPath = path.join(process.cwd(), "public", "uploads", relPath);

    try {
      await fs.access(absPath);
      if (msg.mediaMimeType) {
        res.setHeader("Content-Type", msg.mediaMimeType);
      }
      res.sendFile(absPath);
    } catch {
      res.status(404).json({ error: "Arquivo de mídia não encontrado no disco" });
    }
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId, messageId }, "Serve WhatsApp media failed");
    res.status(500).json({ error: "Falha ao carregar mídia" });
  }
});

router.post("/monitoring/conversations/:target/send-pix", async (req, res) => {
  const wsId = workspaceId(req);
  const parsed = z.object({
    transactionId: z.string().uuid(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "transactionId é obrigatório" });
    return;
  }

  try {
    const result = await enqueueManualBilling(wsId, parsed.data.transactionId);
    if (!result.ok) {
      res.status(result.conflict ? 409 : 422).json({ error: result.reason });
      return;
    }
    triggerImmediateWorker();
    res.json({ ok: true, message: result.message });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "Monitoring send Pix failed");
    res.status(500).json({ error: "Falha ao enviar Pix para o cliente" });
  }
});

router.post("/monitoring/conversations/:target/mark-paid", async (req, res) => {
  const wsId = workspaceId(req);
  const parsed = z.object({
    transactionId: z.string().uuid(),
    sendReceipt: z.boolean().optional().default(true),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "transactionId é obrigatório" });
    return;
  }

  try {
    const { transactionId, sendReceipt } = parsed.data;
    const [tx] = await db.select().from(financialTransactionsTable)
      .where(and(eq(financialTransactionsTable.id, transactionId), eq(financialTransactionsTable.workspaceId, wsId))).limit(1);

    if (!tx) {
      res.status(404).json({ error: "Transação não encontrada" });
      return;
    }

    const updated = await db.update(financialTransactionsTable)
      .set({
        status: "paid",
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(financialTransactionsTable.id, transactionId), eq(financialTransactionsTable.workspaceId, wsId)))
      .returning();

    // Optionally enqueue receipt message via Nexus
    if (sendReceipt && tx.clientId) {
      const [client] = await db.select().from(clientsTable)
        .where(and(eq(clientsTable.id, tx.clientId), eq(clientsTable.workspaceId, wsId))).limit(1);
      const settings = await readSettings(wsId);
      if (client?.whatsappOptIn && client.phone && settings?.receiptEnabled !== false) {
        const phone = normalizeWhatsAppPhone(client.phone);
        if (phone) {
          const receipt = composeReceipt({ ...tx, status: "paid" }, client, settings);
          await db.insert(whatsappMessagesTable).values({
            workspaceId: wsId,
            clientId: client.id,
            transactionId: tx.id,
            dedupeKey: `${wsId}:receipt:${tx.id}:${Date.now()}`,
            kind: "payment_receipt",
            recipient: phone,
            body: storedBody(receipt),
            status: "queued",
          }).onConflictDoNothing();
          triggerImmediateWorker();
        }
      }
    }

    res.json({ ok: true, transaction: updated[0] });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "Failed to mark transaction as paid from monitoring");
    res.status(500).json({ error: "Falha ao registrar quitação da fatura" });
  }
});

router.post("/monitoring/conversations/:target/toggle-optin", async (req, res) => {
  const wsId = workspaceId(req);
  const target = req.params.target;
  const parsed = z.object({
    optIn: z.boolean(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "optIn é obrigatório" });
    return;
  }

  try {
    const isUuid = z.string().uuid().safeParse(target).success;
    let clientId: string | null = null;

    if (isUuid) {
      clientId = target;
    } else {
      const allClients = await db.select().from(clientsTable).where(eq(clientsTable.workspaceId, wsId));
      const found = allClients.find(c => phonesMatch(c.phone, target));
      if (found) clientId = found.id;
    }

    if (!clientId) {
      res.status(404).json({ error: "Cliente não encontrado para alterar opt-in" });
      return;
    }

    const [updated] = await db.update(clientsTable)
      .set({
        whatsappOptIn: parsed.data.optIn,
        whatsappOptInAt: parsed.data.optIn ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.workspaceId, wsId)))
      .returning();

    res.json({ ok: true, client: updated });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "Failed to toggle WhatsApp opt-in");
    res.status(500).json({ error: "Falha ao atualizar consentimento" });
  }
});

router.post("/monitoring/reconnect", async (req, res) => {
  const wsId = workspaceId(req);
  try {
    await connectWhatsApp(wsId);
    const status = await getWhatsAppStatus(wsId);
    res.json({ ok: true, status });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "Failed to reconnect WhatsApp from monitoring");
    res.status(500).json({ error: "Falha ao iniciar reconexão do WhatsApp" });
  }
});

export default router;
