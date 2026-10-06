import { Router, type IRouter } from "express";
import {
  db,
  clientsTable,
  financialTransactionsTable,
  usersTable,
  workspaceMembersTable,
  whatsappContactsTable,
  whatsappMessagesTable,
  whatsappSettingsTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireRole, requireWorkspace, type AuthenticatedRequest } from "../middlewares/auth";
import { enqueueManualBilling, requeueMessage } from "../services/whatsapp-automation";
import { callName, composePreview } from "../services/whatsapp-compose";
import {
  checkWhatsAppNumber,
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
  normalizeWhatsAppPhone,
  normalizeWhatsAppPhoneList,
  sendManualTextMessage,
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

router.get("/monitoring/conversations", async (req, res) => {
  const wsId = workspaceId(req);
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const filter = typeof req.query.filter === "string" ? req.query.filter : "all"; // 'all' | 'replied' | 'waiting' | 'overdue'

  try {
    const allClients = await db.select().from(clientsTable).where(eq(clientsTable.workspaceId, wsId));
    const clientMap = new Map(allClients.map(c => [c.id, c]));
    const phoneToClientMap = new Map<string, typeof allClients[0]>();
    for (const c of allClients) {
      const norm = normalizeWhatsAppPhone(c.phone);
      if (norm) phoneToClientMap.set(norm, c);
    }

    const allMessages = await db.select().from(whatsappMessagesTable)
      .where(eq(whatsappMessagesTable.workspaceId, wsId))
      .orderBy(desc(whatsappMessagesTable.createdAt));

    const allTransactions = await db.select().from(financialTransactionsTable)
      .where(and(
        eq(financialTransactionsTable.workspaceId, wsId),
        eq(financialTransactionsTable.type, "inflow"),
        eq(financialTransactionsTable.status, "pending")
      ));

    const conversationGroups = new Map<string, typeof allMessages>();

    for (const msg of allMessages) {
      let key: string;
      if (msg.clientId) {
        key = `client:${msg.clientId}`;
      } else {
        const phone = normalizeWhatsAppPhone(msg.direction === "inbound" ? msg.senderPhone : msg.recipient);
        const matchedClient = phone ? phoneToClientMap.get(phone) : null;
        if (matchedClient) {
          key = `client:${matchedClient.id}`;
        } else if (phone) {
          key = `phone:${phone}`;
        } else {
          key = `msg:${msg.id}`;
        }
      }

      const list = conversationGroups.get(key) ?? [];
      list.push(msg);
      conversationGroups.set(key, list);
    }

    // Include clients with registered phone or pending transaction so they appear for charging
    for (const client of allClients) {
      const key = `client:${client.id}`;
      if (!conversationGroups.has(key)) {
        conversationGroups.set(key, []);
      }
    }

    const now = new Date();
    const resultList: any[] = [];

    for (const [key, msgs] of conversationGroups.entries()) {
      let client: typeof allClients[0] | null = null;
      let targetPhone: string = "";

      if (key.startsWith("client:")) {
        const cId = key.replace("client:", "");
        client = clientMap.get(cId) ?? null;
        targetPhone = client?.phone ? (normalizeWhatsAppPhone(client.phone) || client.phone) : "";
      } else if (key.startsWith("phone:")) {
        targetPhone = key.replace("phone:", "");
        client = phoneToClientMap.get(targetPhone) ?? null;
      }

      const clientTransactions = client
        ? allTransactions.filter(t => t.clientId === client.id)
        : [];
      const overdueTransactions = clientTransactions.filter(t => new Date(t.dueDate) < now);
      const totalPendingCents = clientTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
      const totalOverdueCents = overdueTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);

      const sortedTxs = [...clientTransactions].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      const nextDueDate = sortedTxs[0]?.dueDate ? sortedTxs[0].dueDate.toISOString() : null;

      const lastMessage = msgs[0] ?? null;
      const inboundCount = msgs.filter(m => m.direction === "inbound").length;
      const outboundCount = msgs.filter(m => m.direction === "outbound").length;
      const unreadCount = msgs.filter(m => m.direction === "inbound" && !m.isRead).length;
      const hasReplied = inboundCount > 0;

      const conversationItem = {
        id: client?.id ?? targetPhone,
        clientId: client?.id ?? null,
        clientName: client?.name ?? lastMessage?.senderName ?? (targetPhone ? `+${targetPhone}` : "Contato"),
        phone: targetPhone || client?.phone || lastMessage?.recipient || lastMessage?.senderPhone || "",
        document: client?.document ?? null,
        optIn: client?.whatsappOptIn ?? false,
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          body: lastMessage.body,
          sentAt: lastMessage.sentAt ?? lastMessage.createdAt,
          direction: lastMessage.direction,
          kind: lastMessage.kind,
          status: lastMessage.status,
          senderName: lastMessage.senderName,
        } : null,
        totalMessages: msgs.length,
        inboundCount,
        outboundCount,
        unreadCount,
        hasReplied,
        financialInfo: {
          pendingCount: clientTransactions.length,
          overdueCount: overdueTransactions.length,
          totalPendingCents,
          totalOverdueCents,
          nextDueDate,
          status: overdueTransactions.length > 0 ? "overdue" : clientTransactions.length > 0 ? "pending" : "paid_up",
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
    const isUuid = z.string().uuid().safeParse(target).success;
    let client: any = null;
    let phone = normalizeWhatsAppPhone(target);

    if (isUuid) {
      const [foundClient] = await db.select().from(clientsTable)
        .where(and(eq(clientsTable.id, target), eq(clientsTable.workspaceId, wsId))).limit(1);
      client = foundClient ?? null;
      if (client?.phone) phone = normalizeWhatsAppPhone(client.phone);
    } else if (phone) {
      const allClients = await db.select().from(clientsTable).where(eq(clientsTable.workspaceId, wsId));
      client = allClients.find(c => normalizeWhatsAppPhone(c.phone) === phone) ?? null;
    }

    const conditions = [];
    if (client) {
      conditions.push(eq(whatsappMessagesTable.clientId, client.id));
    }
    if (phone) {
      conditions.push(eq(whatsappMessagesTable.recipient, phone));
      conditions.push(eq(whatsappMessagesTable.senderPhone, phone));
    }

    if (conditions.length === 0) {
      res.json({ messages: [], client: null, transactions: [] });
      return;
    }

    const messages = await db.select({
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

    const unreadIds = messages
      .filter(({ message }) => message.direction === "inbound" && !message.isRead)
      .map(({ message }) => message.id);

    if (unreadIds.length > 0) {
      void db.update(whatsappMessagesTable)
        .set({ isRead: true, updatedAt: new Date() })
        .where(and(eq(whatsappMessagesTable.workspaceId, wsId), inArray(whatsappMessagesTable.id, unreadIds)))
        .catch(err => logger.warn({ err }, "Failed to mark messages as read"));
    }

    let openTransactions: any[] = [];
    if (client) {
      openTransactions = await db.select().from(financialTransactionsTable)
        .where(and(
          eq(financialTransactionsTable.workspaceId, wsId),
          eq(financialTransactionsTable.clientId, client.id),
          eq(financialTransactionsTable.type, "inflow")
        ))
        .orderBy(asc(financialTransactionsTable.dueDate));
    }

    res.json({
      client,
      phone,
      messages: messages.map(({ message, txAmount, txDueDate, txDescription, txStatus }) => ({
        ...message,
        transaction: message.transactionId ? {
          id: message.transactionId,
          amount: txAmount,
          dueDate: txDueDate,
          description: txDescription,
          status: txStatus,
        } : null,
      })),
      openTransactions,
    });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId, target }, "WhatsApp monitoring messages failed");
    res.status(500).json({ error: "Falha ao carregar mensagens da conversa" });
  }
});

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
    const isUuid = z.string().uuid().safeParse(target).success;
    let clientId: string | null = null;
    let destinationPhone: string | null = null;

    if (isUuid) {
      const [client] = await db.select().from(clientsTable)
        .where(and(eq(clientsTable.id, target), eq(clientsTable.workspaceId, wsId))).limit(1);
      if (client) {
        clientId = client.id;
        destinationPhone = normalizeWhatsAppPhone(client.phone);
      }
    } else {
      destinationPhone = normalizeWhatsAppPhone(target);
      if (destinationPhone) {
        const allClients = await db.select().from(clientsTable).where(eq(clientsTable.workspaceId, wsId));
        const matched = allClients.find(c => normalizeWhatsAppPhone(c.phone) === destinationPhone);
        if (matched) {
          clientId = matched.id;
        }
      }
    }

    if (!destinationPhone) {
      res.status(400).json({ error: "Número de telefone de destino inválido ou cliente sem telefone cadastrado" });
      return;
    }

    const settings = await readSettings(wsId);
    const senderName = settings?.assistantName || "Nexus";

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
    res.json({ ok: true, message: result.message });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "Monitoring send Pix failed");
    res.status(500).json({ error: "Falha ao enviar Pix para o cliente" });
  }
});

export default router;
