import { Router, type IRouter } from "express";
import { db, clientsTable, whatsappMessagesTable, whatsappSettingsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireRole, requireWorkspace, type AuthenticatedRequest } from "../middlewares/auth";
import { enqueueManualBilling } from "../services/whatsapp-automation";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
  normalizeWhatsAppPhone,
  normalizeWhatsAppPhoneList,
} from "../services/whatsapp-session";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const ADMIN_ROLES = ["owner", "admin", "ceo", "cto"];
router.use(requireAuth, requireWorkspace, requireRole(ADMIN_ROLES));

const settingsInput = z.object({
  autoBillingEnabled: z.boolean().optional(),
  daysBeforeDue: z.number().int().min(0).max(30).optional(),
  sendOnDueDate: z.boolean().optional(),
  daysAfterDue: z.number().int().min(0).max(30).optional(),
  dailySendHour: z.number().int().min(0).max(23).optional(),
  pixKey: z.string().trim().max(200).nullable().optional(),
  internalAlertPhone: z.string().trim().max(500).nullable().optional(),
  withdrawalAlertsEnabled: z.boolean().optional(),
}).strict();

const defaultSettings = {
  autoBillingEnabled: false,
  daysBeforeDue: 3,
  sendOnDueDate: true,
  daysAfterDue: 3,
  dailySendHour: 10,
  pixKey: "",
  internalAlertPhone: "",
  withdrawalAlertsEnabled: false,
};

function publicSettings(row?: typeof whatsappSettingsTable.$inferSelect) {
  return {
    autoBillingEnabled: row?.autoBillingEnabled ?? defaultSettings.autoBillingEnabled,
    daysBeforeDue: row?.daysBeforeDue ?? defaultSettings.daysBeforeDue,
    sendOnDueDate: row?.sendOnDueDate ?? defaultSettings.sendOnDueDate,
    daysAfterDue: row?.daysAfterDue ?? defaultSettings.daysAfterDue,
    dailySendHour: row?.dailySendHour ?? defaultSettings.dailySendHour,
    pixKey: row?.pixKey ?? defaultSettings.pixKey,
    internalAlertPhone: row?.internalAlertPhone ?? defaultSettings.internalAlertPhone,
    withdrawalAlertsEnabled: row?.withdrawalAlertsEnabled ?? defaultSettings.withdrawalAlertsEnabled,
  };
}

function workspaceId(req: AuthenticatedRequest): string {
  return req.user.workspaceId!;
}

router.get("/status", async (req, res) => {
  try {
    res.json(await getWhatsAppStatus(workspaceId(req as AuthenticatedRequest)));
  } catch (error) {
    logger.error({ err: error }, "WhatsApp status failed");
    res.status(500).json({ error: "Não foi possível consultar a conexão" });
  }
});

router.post("/connect", async (req, res) => {
  const wsId = workspaceId(req as AuthenticatedRequest);
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
  const wsId = workspaceId(req as AuthenticatedRequest);
  try {
    await disconnectWhatsApp(wsId);
    res.json(await getWhatsAppStatus(wsId));
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp disconnect failed");
    res.status(500).json({ error: "Não foi possível desconectar o WhatsApp" });
  }
});

router.get("/settings", async (req, res) => {
  const wsId = workspaceId(req as AuthenticatedRequest);
  try {
    const [stored] = await db.select().from(whatsappSettingsTable)
      .where(eq(whatsappSettingsTable.workspaceId, wsId)).limit(1);
    res.json({ settings: publicSettings(stored) });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp settings read failed");
    res.status(500).json({ error: "Não foi possível consultar as configurações" });
  }
});

router.put("/settings", async (req, res) => {
  const wsId = workspaceId(req as AuthenticatedRequest);
  const parsed = settingsInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Configurações inválidas", details: parsed.error.flatten() });
    return;
  }
  try {
    const [stored] = await db.select().from(whatsappSettingsTable)
      .where(eq(whatsappSettingsTable.workspaceId, wsId)).limit(1);
    const current = publicSettings(stored);
    const next = {
      ...current,
      ...parsed.data,
      pixKey: (parsed.data.pixKey !== undefined ? parsed.data.pixKey : current.pixKey)?.trim() || null,
      internalAlertPhone: normalizeWhatsAppPhoneList(
        parsed.data.internalAlertPhone !== undefined ? parsed.data.internalAlertPhone : current.internalAlertPhone,
      ),
    };
    if (next.autoBillingEnabled && !next.pixKey) {
      res.status(400).json({ error: "Cadastre a chave Pix antes de ativar cobranças automáticas" });
      return;
    }
    if (next.withdrawalAlertsEnabled && !next.internalAlertPhone) {
      res.status(400).json({ error: "Cadastre pelo menos um WhatsApp interno válido para receber alertas" });
      return;
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

router.get("/messages", async (req, res) => {
  const wsId = workspaceId(req as AuthenticatedRequest);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "50"), 10) || 50));
  try {
    const rows = await db.select({ message: whatsappMessagesTable, clientName: clientsTable.name })
      .from(whatsappMessagesTable)
      .leftJoin(clientsTable, eq(whatsappMessagesTable.clientId, clientsTable.id))
      .where(eq(whatsappMessagesTable.workspaceId, wsId))
      .orderBy(desc(whatsappMessagesTable.createdAt))
      .limit(limit);
    res.json({ messages: rows.map(({ message, clientName }) => ({ ...message, clientName })) });
  } catch (error) {
    logger.error({ err: error, workspaceId: wsId }, "WhatsApp message history failed");
    res.status(500).json({ error: "Não foi possível consultar as mensagens" });
  }
});

router.post("/messages/manual-billing", async (req, res) => {
  const wsId = workspaceId(req as AuthenticatedRequest);
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

export default router;
