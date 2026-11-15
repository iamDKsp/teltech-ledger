import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import {
  db,
  demoLeadsTable,
  leadCadenceStepsTable,
  whatsappMessagesTable,
  whatsappSettingsTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireRole, requireWorkspace, type AuthenticatedRequest } from "../middlewares/auth";
import { loadActiveWebhookIntegrations } from "../services/webhook-config-store";
import {
  buildDefaultCadenceSeeds,
  canonicalLeadPhone,
  computeScheduledSendTime,
  ensureCadenceStepsForSource,
  ensureDemoLeadsSchema,
  normalizeLeadPhone,
  renderLeadCadenceBody,
} from "../services/lead-cadence";
import { triggerImmediateWorker } from "../services/whatsapp-automation";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const ADMIN_ROLES = ["owner", "admin", "ceo", "cto", "cmo", "member"];

router.use(requireAuth, requireWorkspace, requireRole(ADMIN_ROLES));

function getWorkspaceId(req: Request): string {
  return (req as AuthenticatedRequest).user.workspaceId!;
}

const sourceSlugSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,59}$/, "Identificador de origem inválido");

const patchLeadSchema = z.object({
  status: z.enum(["active_cadence", "paused", "replied", "converted", "completed", "discarded"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  pauseReason: z.string().max(300).nullable().optional(),
}).strict();

const simulateLeadSchema = z.object({
  source: sourceSlugSchema.default("pdv_lojista"),
  sourceLabel: z.string().trim().min(1).max(120).default("PDV Lojista"),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(8).max(40),
  email: z.string().email().max(254).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict();

const cadenceStepInputSchema = z.object({
  stepKind: z.enum(["sequence", "reaccess"]).default("sequence"),
  stepOrder: z.number().int().min(1).max(999),
  title: z.string().trim().min(1).max(160),
  delayMinutes: z.number().int().min(0).max(43_200),
  respectBusinessHours: z.boolean().default(true),
  businessStartHour: z.number().int().min(0).max(22).default(9),
  businessEndHour: z.number().int().min(1).max(23).default(20),
  bodyTemplate: z.string().trim().min(5).max(3000),
  enabled: z.boolean().default(true),
}).strict();

const putCadenceSchema = z.object({
  resetDefaults: z.boolean().optional(),
  productLabel: z.string().trim().min(1).max(120).optional(),
  steps: z.array(cadenceStepInputSchema).min(1).max(25).optional(),
}).strict();

async function safeWorkspaceIntegrations(workspaceId: string) {
  try {
    return (await loadActiveWebhookIntegrations()).filter((i) => i.workspaceId === workspaceId);
  } catch {
    return [];
  }
}

router.get("/", async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  try {
    await ensureDemoLeadsSchema();

    const sourceFilter = typeof req.query.source === "string" && req.query.source.trim() && req.query.source !== "all"
      ? req.query.source.trim()
      : null;
    const statusFilter = typeof req.query.status === "string" && req.query.status.trim() && req.query.status !== "all"
      ? req.query.status.trim()
      : null;
    const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";

    const integrations = await safeWorkspaceIntegrations(workspaceId);
    const [allLeads, existingSteps] = await Promise.all([
      db.select().from(demoLeadsTable)
        .where(eq(demoLeadsTable.workspaceId, workspaceId))
        .orderBy(desc(demoLeadsTable.lastAccessAt)),
      db.select().from(leadCadenceStepsTable)
        .where(eq(leadCadenceStepsTable.workspaceId, workspaceId))
        .orderBy(asc(leadCadenceStepsTable.stepOrder)),
    ]);

    const sourceMap = new Map<string, string>();
    for (const integ of integrations) {
      sourceMap.set(integ.source, integ.name);
    }
    for (const step of existingSteps) {
      if (!sourceMap.has(step.source)) {
        sourceMap.set(step.source, step.productLabel || step.source);
      }
    }
    for (const lead of allLeads) {
      if (!sourceMap.has(lead.source)) {
        sourceMap.set(lead.source, lead.sourceLabel || lead.source);
      }
    }
    if (sourceMap.size === 0) {
      sourceMap.set("pdv_lojista", "PDV Lojista");
    }

    const stepCountBySource = new Map<string, number>();
    for (const [src, label] of sourceMap.entries()) {
      const stepsForSrc = existingSteps.filter((s) => s.source === src);
      if (stepsForSrc.length > 0) {
        stepCountBySource.set(
          src,
          stepsForSrc.filter((s) => s.stepKind === "sequence" && s.enabled).length,
        );
      } else {
        const seeded = await ensureCadenceStepsForSource(db, workspaceId, src, label);
        stepCountBySource.set(
          src,
          seeded.filter((s) => s.stepKind === "sequence" && s.enabled).length,
        );
      }
    }

    const scopedForKpi = sourceFilter
      ? allLeads.filter((l) => l.source === sourceFilter)
      : allLeads;

    const kpis = {
      total: scopedForKpi.length,
      activeCadence: scopedForKpi.filter((l) => l.status === "active_cadence").length,
      replied: scopedForKpi.filter((l) => l.status === "replied").length,
      paused: scopedForKpi.filter((l) => l.status === "paused").length,
      converted: scopedForKpi.filter((l) => l.status === "converted").length,
      completed: scopedForKpi.filter((l) => l.status === "completed").length,
      totalMessagesSent: scopedForKpi.reduce((acc, l) => acc + (l.sentCount || 0), 0),
    };

    const filteredLeads = scopedForKpi
      .filter((l) => !statusFilter || l.status === statusFilter)
      .filter((l) => {
        if (!search) return true;
        return (
          l.name.toLowerCase().includes(search) ||
          l.phone.toLowerCase().includes(search) ||
          (l.email?.toLowerCase().includes(search) ?? false) ||
          (l.notes?.toLowerCase().includes(search) ?? false) ||
          l.sourceLabel.toLowerCase().includes(search)
        );
      })
      .map((l) => ({
        ...l,
        totalSteps: stepCountBySource.get(l.source) ?? 7,
      }));

    const sources = Array.from(sourceMap.entries()).map(([source, label]) => ({
      source,
      label,
      totalSteps: stepCountBySource.get(source) ?? 7,
      leadCount: allLeads.filter((l) => l.source === source).length,
    }));

    res.json({
      sources,
      kpis,
      leads: filteredLeads,
    });
  } catch (err) {
    logger.error({ err, workspaceId }, "Failed to list demo leads");
    res.status(500).json({ error: "Falha ao carregar funil de demonstrações" });
  }
});

router.post("/simulate", async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const parsed = simulateLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Dados inválidos para cadastro manual de lead", issues: parsed.error.issues });
    return;
  }

  try {
    await ensureDemoLeadsSchema();
    const data = parsed.data;
    const normalizedPhone = canonicalLeadPhone(data.phone) || normalizeLeadPhone(data.phone);
    if (!normalizedPhone) {
      res.status(422).json({ error: "Número de WhatsApp inválido (informe DDD + número)" });
      return;
    }

    const steps = await ensureCadenceStepsForSource(db, workspaceId, data.source, data.sourceLabel);
    const enabledSeq = steps.filter((s) => s.stepKind === "sequence" && s.enabled).sort((a, b) => a.stepOrder - b.stepOrder);
    const firstStep = enabledSeq[0];
    const now = new Date();
    const nextStepAt = firstStep
      ? computeScheduledSendTime(
          now,
          firstStep.delayMinutes,
          firstStep.respectBusinessHours,
          firstStep.businessStartHour,
          firstStep.businessEndHour,
        )
      : null;

    const [created] = await db
      .insert(demoLeadsTable)
      .values({
        workspaceId,
        source: data.source,
        sourceLabel: data.sourceLabel,
        externalId: `manual-${randomUUID().slice(0, 12)}`,
        name: data.name,
        phone: normalizedPhone,
        email: data.email || null,
        accessCount: 1,
        firstAccessAt: now,
        lastAccessAt: now,
        status: firstStep ? "active_cadence" : "completed",
        currentStep: 0,
        nextStepOrder: firstStep?.stepOrder ?? null,
        nextStepAt,
        notes: data.notes || null,
        version: 1,
      })
      .returning();

    res.status(201).json({ lead: created });
  } catch (err) {
    logger.error({ err, workspaceId }, "Failed to simulate demo lead");
    res.status(500).json({ error: "Não foi possível cadastrar o lead de teste" });
  }
});

router.get("/cadence/:source", async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const srcParsed = sourceSlugSchema.safeParse(req.params.source);
  if (!srcParsed.success) {
    res.status(400).json({ error: "Origem inválida" });
    return;
  }
  const source = srcParsed.data;

  try {
    await ensureDemoLeadsSchema();
    const integrations = safeWorkspaceIntegrations(workspaceId);
    const matchedInteg = integrations.find((i) => i.source === source);
    const defaultLabel = matchedInteg?.name || (source === "pdv_lojista" ? "PDV Lojista" : source);

    const [steps, settingsRows] = await Promise.all([
      ensureCadenceStepsForSource(db, workspaceId, source, defaultLabel),
      db.select().from(whatsappSettingsTable).where(eq(whatsappSettingsTable.workspaceId, workspaceId)).limit(1),
    ]);

    const settings = settingsRows[0];
    const productLabel = steps[0]?.productLabel || defaultLabel;

    res.json({
      source,
      productLabel,
      companyName: settings?.companyName || "Teltech",
      assistantName: settings?.assistantName || "Nexus",
      steps,
    });
  } catch (err) {
    logger.error({ err, workspaceId, source }, "Failed to fetch cadence steps");
    res.status(500).json({ error: "Falha ao carregar etapas da régua" });
  }
});

router.put("/cadence/:source", async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const srcParsed = sourceSlugSchema.safeParse(req.params.source);
  if (!srcParsed.success) {
    res.status(400).json({ error: "Origem inválida" });
    return;
  }
  const source = srcParsed.data;
  const parsed = putCadenceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Dados inválidos na régua de mensagens", issues: parsed.error.issues });
    return;
  }

  try {
    await ensureDemoLeadsSchema();
    const integrations = safeWorkspaceIntegrations(workspaceId);
    const matchedInteg = integrations.find((i) => i.source === source);
    const productLabel = (
      parsed.data.productLabel ||
      matchedInteg?.name ||
      (source === "pdv_lojista" ? "PDV Lojista" : source)
    ).trim();

    const incomingSteps = parsed.data.resetDefaults
      ? buildDefaultCadenceSeeds(source, productLabel)
      : (parsed.data.steps ?? []);

    if (incomingSteps.length === 0) {
      res.status(422).json({ error: "Informe ao menos uma etapa para a régua" });
      return;
    }

    // Normalize sequence step orders to 1..N cleanly, keeping reaccess at 99
    let seqIndex = 1;
    const normalizedSteps = incomingSteps.map((s) => ({
      workspaceId,
      source,
      productLabel,
      stepKind: s.stepKind,
      stepOrder: s.stepKind === "reaccess" ? 99 : seqIndex++,
      title: s.title,
      delayMinutes: s.delayMinutes,
      respectBusinessHours: s.respectBusinessHours,
      businessStartHour: Math.min(s.businessStartHour, s.businessEndHour - 1),
      businessEndHour: Math.max(s.businessStartHour + 1, s.businessEndHour),
      bodyTemplate: s.bodyTemplate,
      enabled: s.enabled,
    }));

    await db.transaction(async (tx) => {
      await tx
        .delete(leadCadenceStepsTable)
        .where(and(eq(leadCadenceStepsTable.workspaceId, workspaceId), eq(leadCadenceStepsTable.source, source)));
      await tx.insert(leadCadenceStepsTable).values(normalizedSteps);
    });

    const updated = await db
      .select()
      .from(leadCadenceStepsTable)
      .where(and(eq(leadCadenceStepsTable.workspaceId, workspaceId), eq(leadCadenceStepsTable.source, source)))
      .orderBy(asc(leadCadenceStepsTable.stepOrder));

    res.json({ ok: true, source, productLabel, steps: updated });
  } catch (err) {
    logger.error({ err, workspaceId, source }, "Failed to save cadence steps");
    res.status(500).json({ error: "Falha ao salvar régua de mensagens" });
  }
});

router.get("/:id/messages", async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const leadId = req.params.id;
  if (!z.string().uuid().safeParse(leadId).success) {
    res.status(400).json({ error: "ID de lead inválido" });
    return;
  }

  try {
    await ensureDemoLeadsSchema();
    const [lead] = await db
      .select()
      .from(demoLeadsTable)
      .where(and(eq(demoLeadsTable.id, leadId), eq(demoLeadsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!lead) {
      res.status(404).json({ error: "Lead não encontrado" });
      return;
    }

    const phones = new Set<string>();
    const norm = normalizeLeadPhone(lead.phone);
    const canon = canonicalLeadPhone(lead.phone);
    if (norm) phones.add(norm);
    if (canon) {
      phones.add(canon);
      if (canon.startsWith("55") && canon.length === 13) {
        phones.add(`55${canon.slice(2, 4)}${canon.slice(5)}`);
      }
    }

    const conditions = [eq(whatsappMessagesTable.demoLeadId, lead.id)];
    for (const p of phones) {
      conditions.push(eq(whatsappMessagesTable.recipient, p));
      conditions.push(eq(whatsappMessagesTable.senderPhone, p));
    }

    const messages = await db
      .select()
      .from(whatsappMessagesTable)
      .where(and(eq(whatsappMessagesTable.workspaceId, workspaceId), or(...conditions)))
      .orderBy(asc(whatsappMessagesTable.createdAt));

    res.json({ lead, messages });
  } catch (err) {
    logger.error({ err, workspaceId, leadId }, "Failed to fetch demo lead messages");
    res.status(500).json({ error: "Falha ao buscar histórico de mensagens do lead" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const leadId = req.params.id;
  if (!z.string().uuid().safeParse(leadId).success) {
    res.status(400).json({ error: "ID de lead inválido" });
    return;
  }

  const parsed = patchLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Dados inválidos", issues: parsed.error.issues });
    return;
  }

  try {
    await ensureDemoLeadsSchema();
    const [lead] = await db
      .select()
      .from(demoLeadsTable)
      .where(and(eq(demoLeadsTable.id, leadId), eq(demoLeadsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!lead) {
      res.status(404).json({ error: "Lead não encontrado" });
      return;
    }

    const now = new Date();
    const updates: Partial<typeof demoLeadsTable.$inferInsert> = {
      updatedAt: now,
    };

    if (parsed.data.notes !== undefined) {
      updates.notes = parsed.data.notes;
    }

    if (parsed.data.status && parsed.data.status !== lead.status) {
      updates.status = parsed.data.status;

      if (parsed.data.status === "active_cadence") {
        const steps = await ensureCadenceStepsForSource(db, workspaceId, lead.source, lead.sourceLabel);
        const enabledSeq = steps
          .filter((s) => s.stepKind === "sequence" && s.enabled)
          .sort((a, b) => a.stepOrder - b.stepOrder);
        const nextStep = enabledSeq.find((s) => s.stepOrder > lead.currentStep) ?? enabledSeq[0];

        if (nextStep) {
          updates.nextStepOrder = nextStep.stepOrder;
          updates.nextStepAt = computeScheduledSendTime(
            now,
            Math.min(nextStep.delayMinutes, 5),
            nextStep.respectBusinessHours,
            nextStep.businessStartHour,
            nextStep.businessEndHour,
          );
          updates.pauseReason = null;
        } else {
          updates.status = "completed";
          updates.nextStepOrder = null;
          updates.nextStepAt = null;
        }
      } else {
        updates.nextStepAt = null;
        updates.pauseReason =
          parsed.data.pauseReason !== undefined
            ? parsed.data.pauseReason
            : parsed.data.status === "paused"
            ? "Pausado manualmente no painel"
            : parsed.data.status === "converted"
            ? "Marcado como convertido manualmente"
            : parsed.data.status === "discarded"
            ? "Lead arquivado/descartado"
            : lead.pauseReason;

        await db
          .update(whatsappMessagesTable)
          .set({
            status: "skipped",
            lastError: updates.pauseReason || "Cadência interrompida manualmente",
            updatedAt: now,
          })
          .where(
            and(
              eq(whatsappMessagesTable.workspaceId, workspaceId),
              eq(whatsappMessagesTable.demoLeadId, lead.id),
              inArray(whatsappMessagesTable.status, ["queued", "retry"]),
            ),
          );
      }
    }

    const [updated] = await db
      .update(demoLeadsTable)
      .set(updates)
      .where(eq(demoLeadsTable.id, lead.id))
      .returning();

    res.json({ ok: true, lead: updated });
  } catch (err) {
    logger.error({ err, workspaceId, leadId }, "Failed to update demo lead");
    res.status(500).json({ error: "Falha ao atualizar lead" });
  }
});

router.post("/:id/send-now", async (req: Request, res: Response) => {
  const workspaceId = getWorkspaceId(req);
  const leadId = req.params.id;
  if (!z.string().uuid().safeParse(leadId).success) {
    res.status(400).json({ error: "ID de lead inválido" });
    return;
  }

  const requestedStepOrder =
    typeof req.body?.stepOrder === "number" && Number.isInteger(req.body.stepOrder)
      ? req.body.stepOrder
      : null;

  try {
    await ensureDemoLeadsSchema();
    const [lead] = await db
      .select()
      .from(demoLeadsTable)
      .where(and(eq(demoLeadsTable.id, leadId), eq(demoLeadsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!lead) {
      res.status(404).json({ error: "Lead não encontrado" });
      return;
    }

    if (lead.status === "opted_out") {
      res.status(409).json({ error: "Este lead solicitou PARAR e não pode receber disparos automáticos" });
      return;
    }

    const steps = await ensureCadenceStepsForSource(db, workspaceId, lead.source, lead.sourceLabel);
    const enabledSeq = steps
      .filter((s) => s.stepKind === "sequence" && s.enabled)
      .sort((a, b) => a.stepOrder - b.stepOrder);

    const targetStep = requestedStepOrder != null
      ? steps.find((s) => s.stepOrder === requestedStepOrder)
      : enabledSeq.find((s) => s.stepOrder > lead.currentStep) ?? enabledSeq[enabledSeq.length - 1];

    if (!targetStep) {
      res.status(422).json({ error: "Nenhuma etapa ativa encontrada nesta régua" });
      return;
    }

    const [settings] = await db
      .select()
      .from(whatsappSettingsTable)
      .where(eq(whatsappSettingsTable.workspaceId, workspaceId))
      .limit(1);

    const now = new Date();
    const body = renderLeadCadenceBody(targetStep.bodyTemplate, lead, settings, now);

    const [queued] = await db
      .insert(whatsappMessagesTable)
      .values({
        workspaceId,
        demoLeadId: lead.id,
        cadenceStep: targetStep.stepOrder,
        dedupeKey: `${workspaceId}:lead_manual:${lead.id}:${targetStep.stepOrder}:${Date.now()}`,
        kind: "lead_manual_step",
        recipient: lead.phone,
        body,
        status: "queued",
        nextAttemptAt: now,
      })
      .returning();

    triggerImmediateWorker();

    res.json({
      ok: true,
      stepOrder: targetStep.stepOrder,
      stepTitle: targetStep.title,
      message: queued,
    });
  } catch (err) {
    logger.error({ err, workspaceId, leadId }, "Failed to enqueue immediate cadence step");
    res.status(500).json({ error: "Falha ao disparar etapa imediata" });
  }
});

export default router;
