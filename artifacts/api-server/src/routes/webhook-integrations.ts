import { Router, type Request, type Response } from "express";
import { db, inboundWebhookEventsTable, inboundWebhookEntitiesTable, clientsTable, saleItemsTable, clientSalesTable, financialAuditLogsTable } from "@workspace/db";
import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireWorkspace, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { readWebhookIntegrations, WebhookError } from "../services/inbound-webhook-contract";

const router = Router();
router.use(requireAuth, requireWorkspace);

const externalId = z.string().min(1).max(120).regex(/^[A-Za-z0-9_.:-]+$/);
const linkSchema = z.object({ clientExternalId: externalId, clientId: z.string().uuid(),
  baseExternalId: externalId.optional(), saleItemId: z.string().uuid().optional(),
}).strict().refine((v) => Boolean(v.baseExternalId) === Boolean(v.saleItemId), "Informe baseExternalId e saleItemId juntos.");

router.post("/:source/link", requireRole(["owner", "admin", "ceo", "cto"]), async (req: Request, res: Response) => {
  try {
    const parsed = linkSchema.safeParse(req.body);
    if (!parsed.success) { res.status(422).json({ error: "invalid_link", message: "Informe o cliente, seu ID externo e, opcionalmente, a mensalidade e o ID da base juntos." }); return; }
    const workspaceId = (req as AuthenticatedRequest).user.workspaceId!;
    const config = readWebhookIntegrations().find((c) => c.source === req.params.source && c.workspaceId === workspaceId);
    if (!config) throw new WebhookError(404, "source_not_found", "Integração não encontrada neste workspace.");
    const input = parsed.data;
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`inbound:${workspaceId}`}, 0))`);
      const [client] = await tx.select({ id: clientsTable.id }).from(clientsTable)
        .where(and(eq(clientsTable.workspaceId, workspaceId), eq(clientsTable.id, input.clientId))).limit(1);
      if (!client) throw new WebhookError(404, "client_not_found", "Cliente não encontrado neste workspace.");
      const link = async (kind: string, externalId: string, internalId: string, parentExternalId: string | null) => {
        const [existing] = await tx.select().from(inboundWebhookEntitiesTable).where(and(
          eq(inboundWebhookEntitiesTable.workspaceId, workspaceId), eq(inboundWebhookEntitiesTable.source, config.source),
          eq(inboundWebhookEntitiesTable.kind, kind), eq(inboundWebhookEntitiesTable.externalId, externalId),
        )).limit(1);
        if (existing) {
          if (existing.internalId !== internalId || existing.parentExternalId !== parentExternalId) {
            throw new WebhookError(409, "link_conflict", "ID externo já vinculado a outro registro. Reconcile o vínculo existente.");
          }
          return;
        }
        // Within one source a manual client has one stable external ID; bases
        // cannot be claimed twice even across sources.
        const claims = await tx.select({ id: inboundWebhookEntitiesTable.id }).from(inboundWebhookEntitiesTable).where(and(
          eq(inboundWebhookEntitiesTable.workspaceId, workspaceId), eq(inboundWebhookEntitiesTable.kind, kind),
          eq(inboundWebhookEntitiesTable.internalId, internalId), kind === "client" ? eq(inboundWebhookEntitiesTable.source, config.source) : undefined,
        )).limit(1);
        if (claims.length) throw new WebhookError(409, "record_already_linked", "Registro já vinculado a outro ID externo.");
        await tx.insert(inboundWebhookEntitiesTable).values({ workspaceId, source: config.source, kind, externalId, internalId,
          parentExternalId, version: 0, payloadHash: "" });
      };
      await link("client", input.clientExternalId, client.id, null);
      if (input.saleItemId && input.baseExternalId) {
        const [row] = await tx.select({ item: saleItemsTable, sale: clientSalesTable }).from(saleItemsTable)
          .innerJoin(clientSalesTable, eq(saleItemsTable.saleId, clientSalesTable.id)).where(and(
            eq(saleItemsTable.id, input.saleItemId), eq(saleItemsTable.workspaceId, workspaceId), eq(saleItemsTable.kind, "subscription"),
            eq(clientSalesTable.workspaceId, workspaceId), eq(clientSalesTable.clientId, client.id), eq(clientSalesTable.projectId, config.projectId),
          )).limit(1).for("update");
        if (!row) throw new WebhookError(404, "contract_not_found", "Mensalidade não pertence a esse cliente e ao produto configurado.");
        await link("base", input.baseExternalId, row.item.id, input.clientExternalId);
        await tx.update(saleItemsTable).set({ billingSource: "external", updatedAt: new Date() }).where(eq(saleItemsTable.id, row.item.id));
      }
      await tx.insert(financialAuditLogsTable).values({ workspaceId, userId: (req as AuthenticatedRequest).user.userId,
        action: "webhook_manual_link", details: JSON.stringify({ source: config.source, ...input }) });
    });
    res.json({ ok: true, message: "Vínculo salvo. O próximo evento atualizará esses registros existentes." });
  } catch (error) {
    res.status(error instanceof WebhookError ? error.status : 503).json({
      error: error instanceof WebhookError ? error.code : "temporarily_unavailable",
      message: error instanceof WebhookError ? error.message : "Não foi possível salvar o vínculo. Tente novamente.",
    });
  }
});

// Lightweight polling: no customer data or configuration is exposed here.
router.get("/revision", async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as AuthenticatedRequest).user.workspaceId!;
    // Count committed events, because sequences can commit out of order across sources.
    const [row] = await db.select({ revision: sql<number>`count(*)::int` })
      .from(inboundWebhookEventsTable).where(eq(inboundWebhookEventsTable.workspaceId, workspaceId));
    res.setHeader("Cache-Control", "no-store");
    res.json({ revision: row?.revision ?? 0 });
  } catch {
    res.setHeader("Cache-Control", "no-store");
    res.json({ revision: 0 });
  }
});

router.get("/", requireRole(["owner", "admin", "ceo", "cto"]), async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as AuthenticatedRequest).user.workspaceId!;
    const configs = readWebhookIntegrations().filter((i) => i.workspaceId === workspaceId);
    const integrations = [];
    for (const config of configs) {
      const [lastEvent] = await db.select({ eventId: inboundWebhookEventsTable.eventId,
        eventType: inboundWebhookEventsTable.eventType, processedAt: inboundWebhookEventsTable.processedAt,
        outcome: sql<string>`${inboundWebhookEventsTable.result}->>'outcome'` })
        .from(inboundWebhookEventsTable).where(and(eq(inboundWebhookEventsTable.workspaceId, workspaceId), eq(inboundWebhookEventsTable.source, config.source)))
        .orderBy(desc(inboundWebhookEventsTable.id)).limit(1);
      integrations.push({ source: config.source, name: config.name, path: `/api/webhooks/inbound/${config.source}`,
        projectId: config.projectId, accountId: config.accountId, lastEvent: lastEvent ?? null });
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ workspaceId, integrations });
  } catch (error) {
    res.status(error instanceof WebhookError ? error.status : 503).json({ error: "integration_unavailable",
      message: error instanceof WebhookError ? error.message : "Não foi possível carregar as integrações." });
  }
});

export default router;
