import {
  db,
  pool,
  clientsTable,
  demoLeadsTable,
  leadCadenceStepsTable,
  whatsappMessagesTable,
  whatsappSettingsTable,
  type DemoLead,
  type LeadCadenceStep,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendPushNotificationToWorkspace } from "./push-notification";
import { WebhookError, type WebhookIntegration } from "./inbound-webhook-contract";
import { saoPauloNow } from "./whatsapp-compose";
import {
  buildDefaultCadenceSeeds,
  canonicalLeadPhone,
  computeScheduledSendTime,
  leadPhonesMatch,
  normalizeLeadPhone,
  renderLeadCadenceBody,
  type DefaultCadenceStepSeed,
} from "./lead-cadence-rules";

export {
  buildDefaultCadenceSeeds,
  canonicalLeadPhone,
  computeScheduledSendTime,
  leadPhonesMatch,
  normalizeLeadPhone,
  renderLeadCadenceBody,
  type DefaultCadenceStepSeed,
};

export interface WebhookDemoLeadPayload {
  externalId: string;
  version: number;
  name: string;
  phone: string;
  email?: string | null;
  accessCount?: number;
  isFirstAccess?: boolean;
  previousAccessAt?: string | null;
  sourceLabel?: string | null;
  notes?: string | null;
}

let schemaEnsurePromise: Promise<void> | null = null;

export function ensureDemoLeadsSchema(): Promise<void> {
  if (!schemaEnsurePromise) {
    schemaEnsurePromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS demo_leads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
          source TEXT NOT NULL,
          source_label TEXT NOT NULL DEFAULT 'Sistema',
          external_id TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT,
          access_count INTEGER NOT NULL DEFAULT 1,
          first_access_at TIMESTAMP NOT NULL DEFAULT NOW(),
          last_access_at TIMESTAMP NOT NULL DEFAULT NOW(),
          status TEXT NOT NULL DEFAULT 'active_cadence',
          pause_reason TEXT,
          current_step INTEGER NOT NULL DEFAULT 0,
          next_step_order INTEGER,
          next_step_at TIMESTAMP,
          sent_count INTEGER NOT NULL DEFAULT 0,
          last_sent_at TIMESTAMP,
          replied_at TIMESTAMP,
          last_reaccess_sent_at TIMESTAMP,
          converted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
          notes TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS demo_leads_workspace_source_external_uq
          ON demo_leads (workspace_id, source, external_id);
        CREATE INDEX IF NOT EXISTS idx_demo_leads_workspace_phone
          ON demo_leads (workspace_id, phone);
        CREATE INDEX IF NOT EXISTS idx_demo_leads_due_cadence
          ON demo_leads (status, next_step_at);

        CREATE TABLE IF NOT EXISTS lead_cadence_steps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          source TEXT NOT NULL,
          product_label TEXT NOT NULL DEFAULT 'PDV Lojista',
          step_kind TEXT NOT NULL DEFAULT 'sequence',
          step_order INTEGER NOT NULL,
          title TEXT NOT NULL,
          delay_minutes INTEGER NOT NULL DEFAULT 2,
          respect_business_hours BOOLEAN NOT NULL DEFAULT TRUE,
          business_start_hour INTEGER NOT NULL DEFAULT 9,
          business_end_hour INTEGER NOT NULL DEFAULT 20,
          body_template TEXT NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS lead_cadence_steps_workspace_source_kind_order_uq
          ON lead_cadence_steps (workspace_id, source, step_kind, step_order);

        ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS demo_lead_id UUID;
        ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS cadence_step INTEGER;
        CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_demo_lead_id ON whatsapp_messages (demo_lead_id);
      `)
      .then(() => undefined)
      .catch((err) => {
        schemaEnsurePromise = null;
        logger.warn({ err: err?.message }, "Demo leads schema ensure warning");
      });
  }
  return schemaEnsurePromise;
}

export async function ensureCadenceStepsForSource(
  exec: any,
  workspaceId: string,
  source: string,
  productLabel = "PDV Lojista",
): Promise<LeadCadenceStep[]> {
  await ensureDemoLeadsSchema();
  const existing: LeadCadenceStep[] = await exec
    .select()
    .from(leadCadenceStepsTable)
    .where(and(eq(leadCadenceStepsTable.workspaceId, workspaceId), eq(leadCadenceStepsTable.source, source)))
    .orderBy(asc(leadCadenceStepsTable.stepOrder));

  if (existing.length > 0) {
    return existing;
  }

  const seeds = buildDefaultCadenceSeeds(source, productLabel);
  await exec
    .insert(leadCadenceStepsTable)
    .values(
      seeds.map((s) => ({
        workspaceId,
        source,
        productLabel: productLabel || "PDV Lojista",
        stepKind: s.stepKind,
        stepOrder: s.stepOrder,
        title: s.title,
        delayMinutes: s.delayMinutes,
        respectBusinessHours: s.respectBusinessHours,
        businessStartHour: s.businessStartHour,
        businessEndHour: s.businessEndHour,
        bodyTemplate: s.bodyTemplate,
        enabled: s.enabled,
      })),
    )
    .onConflictDoNothing();

  return await exec
    .select()
    .from(leadCadenceStepsTable)
    .where(and(eq(leadCadenceStepsTable.workspaceId, workspaceId), eq(leadCadenceStepsTable.source, source)))
    .orderBy(asc(leadCadenceStepsTable.stepOrder));
}

export async function upsertDemoLeadFromWebhook(
  tx: any,
  config: WebhookIntegration,
  data: WebhookDemoLeadPayload,
  onAfterSchedule?: (delayMs: number) => void,
): Promise<{
  id: string;
  outcome: "applied" | "unchanged" | "stale";
  cadenceStatus: string;
  nextStepAt: string | null;
}> {
  await ensureDemoLeadsSchema();

  const normalizedPhone = canonicalLeadPhone(data.phone) || normalizeLeadPhone(data.phone);
  if (!normalizedPhone) {
    throw new WebhookError(422, "invalid_lead_phone", "Telefone WhatsApp do lead inválido.");
  }

  const productLabel = (data.sourceLabel || config.name || config.source).trim();
  const steps = await ensureCadenceStepsForSource(tx, config.workspaceId, config.source, productLabel);
  const enabledSequenceSteps = steps.filter((s) => s.stepKind === "sequence" && s.enabled).sort((a, b) => a.stepOrder - b.stepOrder);
  const reaccessStep = steps.find((s) => s.stepKind === "reaccess" && s.enabled);

  // Check if this phone already belongs to an active converted client in this workspace
  const allClients: Array<{ id: string; phone: string | null; status: string }> = await tx
    .select({ id: clientsTable.id, phone: clientsTable.phone, status: clientsTable.status })
    .from(clientsTable)
    .where(eq(clientsTable.workspaceId, config.workspaceId));

  const existingClient = allClients.find((c) => c.status === "active" && leadPhonesMatch(c.phone, normalizedPhone));

  // Find existing lead by (workspaceId, source, externalId) or same phone in same source
  const existingRows: DemoLead[] = await tx
    .select()
    .from(demoLeadsTable)
    .where(and(eq(demoLeadsTable.workspaceId, config.workspaceId), eq(demoLeadsTable.source, config.source)));

  const existing =
    existingRows.find((r) => r.externalId === data.externalId) ||
    existingRows.find((r) => leadPhonesMatch(r.phone, normalizedPhone));

  const now = new Date();

  if (!existing) {
    const firstStep = !existingClient ? enabledSequenceSteps[0] : undefined;
    const nextStepAt = firstStep
      ? computeScheduledSendTime(
          now,
          firstStep.delayMinutes,
          firstStep.respectBusinessHours,
          firstStep.businessStartHour,
          firstStep.businessEndHour,
        )
      : null;

    const initialStatus = existingClient
      ? "converted"
      : firstStep
      ? "active_cadence"
      : "completed";

    const [inserted] = await tx
      .insert(demoLeadsTable)
      .values({
        workspaceId: config.workspaceId,
        projectId: config.projectId,
        source: config.source,
        sourceLabel: productLabel,
        externalId: data.externalId,
        name: data.name.trim(),
        phone: normalizedPhone,
        email: data.email?.trim() || null,
        accessCount: Math.max(1, data.accessCount ?? 1),
        firstAccessAt: now,
        lastAccessAt: now,
        status: initialStatus,
        pauseReason: existingClient ? "Telefone já cadastrado como cliente ativo" : null,
        currentStep: 0,
        nextStepOrder: firstStep ? firstStep.stepOrder : null,
        nextStepAt,
        convertedClientId: existingClient?.id ?? null,
        notes: data.notes?.trim() || null,
        version: data.version,
      })
      .returning();

    if (nextStepAt && onAfterSchedule) {
      onAfterSchedule(Math.max(1_000, nextStepAt.getTime() - Date.now()));
    }

    // Fire push notification to partners asynchronously
    void sendPushNotificationToWorkspace(config.workspaceId, {
      title: `Novo Lead na Demo • ${productLabel}`,
      body: `${data.name.trim()} (${normalizedPhone}) acabou de abrir a demonstração gratuita!`,
      icon: "/apple-touch-icon.png",
      badge: "/favicon-32x32.png",
      tag: `demo-lead-${inserted.id}`,
      data: {
        url: `/funil-demo?source=${encodeURIComponent(config.source)}`,
        type: "demo_lead_captured",
      },
    }).catch(() => undefined);

    return {
      id: inserted.id,
      outcome: "applied",
      cadenceStatus: inserted.status,
      nextStepAt: inserted.nextStepAt ? inserted.nextStepAt.toISOString() : null,
    };
  }

  if (data.version < existing.version) {
    return {
      id: existing.id,
      outcome: "stale",
      cadenceStatus: existing.status,
      nextStepAt: existing.nextStepAt ? existing.nextStepAt.toISOString() : null,
    };
  }

  const prevAccessMs = data.previousAccessAt
    ? Date.parse(data.previousAccessAt)
    : existing.lastAccessAt
    ? new Date(existing.lastAccessAt).getTime()
    : now.getTime();
  const hoursSinceLastAccess = Number.isFinite(prevAccessMs) ? (now.getTime() - prevAccessMs) / 3_600_000 : 0;
  const hoursSinceLastReaccess = existing.lastReaccessSentAt
    ? (now.getTime() - new Date(existing.lastReaccessSentAt).getTime()) / 3_600_000
    : 999;

  const nextStatus =
    existingClient && existing.status !== "converted" ? "converted" : existing.status;

  const canFireReaccess =
    !existingClient &&
    reaccessStep &&
    data.isFirstAccess !== true &&
    (nextStatus === "active_cadence" || nextStatus === "completed") &&
    existing.sentCount >= 1 &&
    hoursSinceLastAccess >= 24 &&
    hoursSinceLastReaccess >= 24;

  const [updated] = await tx
    .update(demoLeadsTable)
    .set({
      name: data.name.trim() || existing.name,
      phone: normalizedPhone,
      email: data.email?.trim() ?? existing.email,
      sourceLabel: productLabel || existing.sourceLabel,
      accessCount: Math.max(existing.accessCount + (data.version > existing.version ? 1 : 0), data.accessCount ?? 1),
      lastAccessAt: now,
      status: nextStatus,
      convertedClientId: existingClient?.id ?? existing.convertedClientId,
      nextStepOrder: existingClient ? null : existing.nextStepOrder,
      nextStepAt: existingClient ? null : existing.nextStepAt,
      lastReaccessSentAt: canFireReaccess ? now : existing.lastReaccessSentAt,
      notes: data.notes !== undefined ? (data.notes?.trim() || null) : existing.notes,
      version: data.version,
      updatedAt: now,
    })
    .where(eq(demoLeadsTable.id, existing.id))
    .returning();

  if (canFireReaccess && reaccessStep) {
    const [settings] = await tx
      .select()
      .from(whatsappSettingsTable)
      .where(eq(whatsappSettingsTable.workspaceId, config.workspaceId))
      .limit(1);

    const sendAt = computeScheduledSendTime(
      now,
      reaccessStep.delayMinutes,
      reaccessStep.respectBusinessHours,
      reaccessStep.businessStartHour,
      reaccessStep.businessEndHour,
    );

    const body = renderLeadCadenceBody(reaccessStep.bodyTemplate, updated, settings, sendAt);
    await tx
      .insert(whatsappMessagesTable)
      .values({
        workspaceId: config.workspaceId,
        demoLeadId: updated.id,
        cadenceStep: reaccessStep.stepOrder,
        dedupeKey: `${config.workspaceId}:lead_reaccess:${updated.id}:${now.toISOString().slice(0, 13)}`,
        kind: "lead_reaccess",
        recipient: updated.phone,
        body,
        status: "queued",
        nextAttemptAt: sendAt,
      })
      .onConflictDoNothing();

    if (onAfterSchedule) {
      onAfterSchedule(Math.max(1_000, sendAt.getTime() - Date.now()));
    }
  }

  return {
    id: updated.id,
    outcome: "applied",
    cadenceStatus: updated.status,
    nextStepAt: updated.nextStepAt ? updated.nextStepAt.toISOString() : null,
  };
}

/**
 * Checks due demo_leads and enqueues the next step into whatsapp_messages just-in-time
 * so future unsent steps never clutter live chat before their scheduled moment.
 */
export async function enqueueDueLeadCadenceMessages(): Promise<number> {
  await ensureDemoLeadsSchema();
  const now = new Date();
  const dueLeads = await db
    .select()
    .from(demoLeadsTable)
    .where(and(eq(demoLeadsTable.status, "active_cadence"), lte(demoLeadsTable.nextStepAt, now)))
    .limit(30);

  let enqueued = 0;

  for (const lead of dueLeads) {
    if (lead.nextStepOrder == null) continue;

    // Skip if there is already an in-flight cadence message for this lead
    const [inFlight] = await db
      .select({ id: whatsappMessagesTable.id })
      .from(whatsappMessagesTable)
      .where(
        and(
          eq(whatsappMessagesTable.workspaceId, lead.workspaceId),
          eq(whatsappMessagesTable.demoLeadId, lead.id),
          inArray(whatsappMessagesTable.status, ["queued", "processing", "retry"]),
        ),
      )
      .limit(1);

    if (inFlight) continue;

    // Safety check: did the lead already become an active client?
    const clients = await db
      .select({ id: clientsTable.id, phone: clientsTable.phone, status: clientsTable.status })
      .from(clientsTable)
      .where(eq(clientsTable.workspaceId, lead.workspaceId));
    const matchedClient = clients.find((c) => c.status === "active" && leadPhonesMatch(c.phone, lead.phone));
    if (matchedClient) {
      await db
        .update(demoLeadsTable)
        .set({
          status: "converted",
          convertedClientId: matchedClient.id,
          pauseReason: "Convertido em cliente ativo",
          nextStepOrder: null,
          nextStepAt: null,
          updatedAt: new Date(),
        })
        .where(eq(demoLeadsTable.id, lead.id));
      continue;
    }

    const steps = await ensureCadenceStepsForSource(db, lead.workspaceId, lead.source, lead.sourceLabel);
    const enabledSteps = steps
      .filter((s) => s.stepKind === "sequence" && s.enabled)
      .sort((a, b) => a.stepOrder - b.stepOrder);

    const step = enabledSteps.find((s) => s.stepOrder >= lead.nextStepOrder!);
    if (!step) {
      await db
        .update(demoLeadsTable)
        .set({ status: "completed", nextStepOrder: null, nextStepAt: null, updatedAt: new Date() })
        .where(eq(demoLeadsTable.id, lead.id));
      continue;
    }

    // Re-verify business window at the moment of enqueue
    if (step.respectBusinessHours) {
      const sp = saoPauloNow(now);
      if (sp.hour < step.businessStartHour || sp.hour >= step.businessEndHour) {
        const postponed = computeScheduledSendTime(
          now,
          0,
          true,
          step.businessStartHour,
          step.businessEndHour,
        );
        await db
          .update(demoLeadsTable)
          .set({ nextStepAt: postponed, updatedAt: new Date() })
          .where(eq(demoLeadsTable.id, lead.id));
        continue;
      }
    }

    const [settings] = await db
      .select()
      .from(whatsappSettingsTable)
      .where(eq(whatsappSettingsTable.workspaceId, lead.workspaceId))
      .limit(1);

    const body = renderLeadCadenceBody(step.bodyTemplate, lead, settings, now);
    const dedupeKey = `${lead.workspaceId}:lead_cadence:${lead.id}:step:${step.stepOrder}`;

    const [inserted] = await db
      .insert(whatsappMessagesTable)
      .values({
        workspaceId: lead.workspaceId,
        demoLeadId: lead.id,
        cadenceStep: step.stepOrder,
        dedupeKey,
        kind: "lead_cadence",
        recipient: lead.phone,
        body,
        status: "queued",
        nextAttemptAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: whatsappMessagesTable.id });

    if (inserted) {
      enqueued += 1;
    } else {
      // Dedupe hit: step was already sent earlier; advance pointer to next step
      const nextStep = enabledSteps.find((s) => s.stepOrder > step.stepOrder);
      if (nextStep) {
        const nextAt = computeScheduledSendTime(
          now,
          nextStep.delayMinutes,
          nextStep.respectBusinessHours,
          nextStep.businessStartHour,
          nextStep.businessEndHour,
        );
        await db
          .update(demoLeadsTable)
          .set({
            currentStep: step.stepOrder,
            nextStepOrder: nextStep.stepOrder,
            nextStepAt: nextAt,
            updatedAt: new Date(),
          })
          .where(eq(demoLeadsTable.id, lead.id));
      } else {
        await db
          .update(demoLeadsTable)
          .set({
            status: "completed",
            currentStep: step.stepOrder,
            nextStepOrder: null,
            nextStepAt: null,
            updatedAt: new Date(),
          })
          .where(eq(demoLeadsTable.id, lead.id));
      }
    }
  }

  return enqueued;
}

/**
 * Revalidates a lead cadence message right before Baileys sends it.
 */
export async function revalidateLeadCadenceMessage(
  message: typeof whatsappMessagesTable.$inferSelect,
): Promise<{ recipient: string; body: string } | { skip: string }> {
  await ensureDemoLeadsSchema();
  if (!message.demoLeadId) {
    return { skip: "Lead de demonstração não vinculado" };
  }

  const [lead] = await db
    .select()
    .from(demoLeadsTable)
    .where(and(eq(demoLeadsTable.id, message.demoLeadId), eq(demoLeadsTable.workspaceId, message.workspaceId)))
    .limit(1);

  if (!lead) {
    return { skip: "Lead removido" };
  }

  const isManualImmediate = message.kind === "lead_manual_step";

  if (!isManualImmediate && !["active_cadence", "completed"].includes(lead.status)) {
    return { skip: `Cadência encerrada/pausada (${lead.status})` };
  }
  if (["opted_out", "discarded"].includes(lead.status)) {
    return { skip: `Lead com status ${lead.status}` };
  }

  const recipient = normalizeLeadPhone(lead.phone);
  if (!recipient) {
    return { skip: "Telefone do lead inválido" };
  }

  // Refresh greeting ({saudacao}) for the exact hour of delivery if step template still exists
  const [settings] = await db
    .select()
    .from(whatsappSettingsTable)
    .where(eq(whatsappSettingsTable.workspaceId, message.workspaceId))
    .limit(1);

  if (message.cadenceStep != null) {
    const steps = await ensureCadenceStepsForSource(db, lead.workspaceId, lead.source, lead.sourceLabel);
    const matchingStep = steps.find((s) => s.stepOrder === message.cadenceStep);
    if (matchingStep) {
      return {
        recipient,
        body: renderLeadCadenceBody(matchingStep.bodyTemplate, lead, settings, new Date()),
      };
    }
  }

  return { recipient, body: message.body };
}

/**
 * Advances the lead's cadence pointer ONLY after Baileys confirms the message was sent,
 * preventing message bursts after temporary WhatsApp disconnections.
 */
export async function onLeadCadenceMessageSent(
  message: typeof whatsappMessagesTable.$inferSelect,
): Promise<void> {
  if (!message.demoLeadId) return;
  await ensureDemoLeadsSchema();

  const [lead] = await db
    .select()
    .from(demoLeadsTable)
    .where(eq(demoLeadsTable.id, message.demoLeadId))
    .limit(1);
  if (!lead) return;

  const now = new Date();
  const steps = await ensureCadenceStepsForSource(db, lead.workspaceId, lead.source, lead.sourceLabel);
  const enabledSequenceSteps = steps
    .filter((s) => s.stepKind === "sequence" && s.enabled)
    .sort((a, b) => a.stepOrder - b.stepOrder);

  if (message.kind === "lead_reaccess") {
    await db
      .update(demoLeadsTable)
      .set({
        sentCount: sql`${demoLeadsTable.sentCount} + 1`,
        lastSentAt: now,
        lastReaccessSentAt: now,
        updatedAt: now,
      })
      .where(eq(demoLeadsTable.id, lead.id));
    return;
  }

  const sentStepOrder = message.cadenceStep ?? lead.nextStepOrder ?? lead.currentStep;
  const nextStep = enabledSequenceSteps.find((s) => s.stepOrder > sentStepOrder);

  if (nextStep && lead.status === "active_cadence") {
    const nextStepAt = computeScheduledSendTime(
      now,
      nextStep.delayMinutes,
      nextStep.respectBusinessHours,
      nextStep.businessStartHour,
      nextStep.businessEndHour,
    );
    await db
      .update(demoLeadsTable)
      .set({
        currentStep: Math.max(lead.currentStep, sentStepOrder),
        nextStepOrder: nextStep.stepOrder,
        nextStepAt,
        sentCount: sql`${demoLeadsTable.sentCount} + 1`,
        lastSentAt: now,
        updatedAt: now,
      })
      .where(eq(demoLeadsTable.id, lead.id));
  } else {
    await db
      .update(demoLeadsTable)
      .set({
        currentStep: Math.max(lead.currentStep, sentStepOrder),
        status: lead.status === "active_cadence" ? "completed" : lead.status,
        nextStepOrder: lead.status === "active_cadence" ? null : lead.nextStepOrder,
        nextStepAt: lead.status === "active_cadence" ? null : lead.nextStepAt,
        sentCount: sql`${demoLeadsTable.sentCount} + 1`,
        lastSentAt: now,
        updatedAt: now,
      })
      .where(eq(demoLeadsTable.id, lead.id));
  }
}

/**
 * Automatically pauses pending automated provocations when the lead replies on WhatsApp,
 * requests opt-out, or when the operator messages them manually from the phone.
 */
export async function pauseLeadCadenceOnInteraction(
  workspaceId: string,
  remotePhone: string | null | undefined,
  reason: "lead_replied" | "operator_manual_chat" | "opt_out",
): Promise<void> {
  if (!remotePhone) return;
  await ensureDemoLeadsSchema();

  const leads = await db
    .select()
    .from(demoLeadsTable)
    .where(eq(demoLeadsTable.workspaceId, workspaceId));

  const matched = leads.filter(
    (l) =>
      leadPhonesMatch(l.phone, remotePhone) &&
      (reason === "opt_out"
        ? !["opted_out", "converted"].includes(l.status)
        : ["active_cadence", "completed"].includes(l.status)),
  );

  if (matched.length === 0) return;

  const now = new Date();
  const ids = matched.map((l) => l.id);
  const nextStatus = reason === "opt_out" ? "opted_out" : reason === "lead_replied" ? "replied" : "paused";
  const pauseLabel =
    reason === "opt_out"
      ? "Lead solicitou parar mensagens"
      : reason === "lead_replied"
      ? "Lead respondeu no WhatsApp — atendimento humano"
      : "Operador iniciou conversa manual pelo celular";

  await db
    .update(demoLeadsTable)
    .set({
      status: nextStatus,
      pauseReason: pauseLabel,
      nextStepAt: null,
      ...(reason === "lead_replied" ? { repliedAt: now } : {}),
      updatedAt: now,
    })
    .where(and(eq(demoLeadsTable.workspaceId, workspaceId), inArray(demoLeadsTable.id, ids)));

  await db
    .update(whatsappMessagesTable)
    .set({
      status: "skipped",
      lastError: pauseLabel,
      updatedAt: now,
    })
    .where(
      and(
        eq(whatsappMessagesTable.workspaceId, workspaceId),
        inArray(whatsappMessagesTable.demoLeadId, ids),
        inArray(whatsappMessagesTable.status, ["queued", "retry"]),
      ),
    );
}

/**
 * Marks any matching demo_leads as converted when a paying client is synced or registered.
 */
export async function markMatchingLeadsConverted(
  tx: any,
  workspaceId: string,
  phone: string | null | undefined,
  clientId: string,
): Promise<void> {
  if (!phone) return;
  await ensureDemoLeadsSchema();

  const leads: DemoLead[] = await tx
    .select()
    .from(demoLeadsTable)
    .where(eq(demoLeadsTable.workspaceId, workspaceId));

  const matchedIds = leads
    .filter((l) => l.status !== "converted" && leadPhonesMatch(l.phone, phone))
    .map((l) => l.id);

  if (matchedIds.length === 0) return;

  const now = new Date();
  await tx
    .update(demoLeadsTable)
    .set({
      status: "converted",
      convertedClientId: clientId,
      pauseReason: "Convertido em cliente ativo",
      nextStepOrder: null,
      nextStepAt: null,
      updatedAt: now,
    })
    .where(and(eq(demoLeadsTable.workspaceId, workspaceId), inArray(demoLeadsTable.id, matchedIds)));

  await tx
    .update(whatsappMessagesTable)
    .set({
      status: "skipped",
      lastError: "Lead convertido em cliente ativo",
      updatedAt: now,
    })
    .where(
      and(
        eq(whatsappMessagesTable.workspaceId, workspaceId),
        inArray(whatsappMessagesTable.demoLeadId, matchedIds),
        inArray(whatsappMessagesTable.status, ["queued", "retry"]),
      ),
    );
}

export async function summarizeDemoLeadsForIntegration(
  config: WebhookIntegration,
): Promise<Record<string, unknown>> {
  await ensureDemoLeadsSchema();
  const steps = await ensureCadenceStepsForSource(db, config.workspaceId, config.source, config.name);
  const totalSteps = steps.filter((s) => s.stepKind === "sequence" && s.enabled).length;

  const rows = await db
    .select()
    .from(demoLeadsTable)
    .where(and(eq(demoLeadsTable.workspaceId, config.workspaceId), eq(demoLeadsTable.source, config.source)))
    .orderBy(desc(demoLeadsTable.lastAccessAt))
    .limit(500);

  return {
    source: config.source,
    sourceName: config.name,
    totalSteps,
    leads: rows.map((r) => ({
      id: r.id,
      externalId: r.externalId,
      name: r.name,
      phone: r.phone,
      status: r.status,
      pauseReason: r.pauseReason,
      currentStep: r.currentStep,
      sentCount: r.sentCount,
      nextStepOrder: r.nextStepOrder,
      nextStepAt: r.nextStepAt ? r.nextStepAt.toISOString() : null,
      lastSentAt: r.lastSentAt ? r.lastSentAt.toISOString() : null,
      repliedAt: r.repliedAt ? r.repliedAt.toISOString() : null,
      accessCount: r.accessCount,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    })),
  };
}
