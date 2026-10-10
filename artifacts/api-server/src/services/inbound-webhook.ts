import {
  db, clientsTable, clientSalesTable, clientContractsTable, saleItemsTable, projectsTable, financialAccountsTable,
  financialTransactionsTable, financialAuditLogsTable, inboundWebhookEntitiesTable, inboundWebhookEventsTable,
} from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { enqueuePaymentReceipt } from "./whatsapp-automation";
import { parseDay } from "./sales-schedule";
import { ClientPhotoFiles, validatePhotoUrl, type PhotoStorageOptions } from "./client-photo";
import {
  WebhookError, compareEntityVersion, hashPayload, paidBalanceDelta, findExistingWebhookClient,
  type InboundWebhook, type WebhookClient, type WebhookBase, type WebhookInvoice, type WebhookIntegration,
} from "./inbound-webhook-contract";

type Executor = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Entity = typeof inboundWebhookEntitiesTable.$inferSelect;
export interface WebhookResult extends Record<string, unknown> {
  eventId: string;
  outcome: "applied" | "unchanged" | "stale";
  duplicate?: boolean;
}

/** Event, identifiers, financial balances and audit entries commit together. */
export async function processInboundWebhook(config: WebhookIntegration, event: InboundWebhook, bodyHash: string, photoOptions?: PhotoStorageOptions): Promise<WebhookResult> {
  const files = new ClientPhotoFiles(photoOptions);
  let committed = false;
  try {
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '5s'`);
    await tx.execute(sql`set local statement_timeout = '15s'`);
    // Workspace-wide lock also prevents two sources creating the same manual client.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`inbound:${config.workspaceId}`}, 0))`);
    const scope = [eq(inboundWebhookEventsTable.workspaceId, config.workspaceId), eq(inboundWebhookEventsTable.source, config.source)];
    const [previous] = await tx.select().from(inboundWebhookEventsTable)
      .where(and(...scope, eq(inboundWebhookEventsTable.eventId, event.eventId))).limit(1);
    if (previous) {
      if (previous.payloadHash !== bodyHash) throw new WebhookError(409, "event_id_conflict", "eventId já utilizado com outro corpo.");
      return { ...previous.result, eventId: event.eventId, outcome: previous.result.outcome as WebhookResult["outcome"], duplicate: true };
    }

    const [project] = await tx.select({ id: projectsTable.id }).from(projectsTable)
      .where(and(eq(projectsTable.id, config.projectId), eq(projectsTable.workspaceId, config.workspaceId))).limit(1);
    if (!project) throw new WebhookError(503, "project_not_configured", "Produto/projeto da integração não pertence ao workspace configurado.");
    if (config.accountId) {
      const [account] = await tx.select({ id: financialAccountsTable.id }).from(financialAccountsTable)
        .where(and(eq(financialAccountsTable.id, config.accountId), eq(financialAccountsTable.workspaceId, config.workspaceId), eq(financialAccountsTable.isActive, true))).limit(1);
      if (!account) throw new WebhookError(503, "account_not_configured", "Conta de recebimento da integração inválida ou inativa.");
    }

    const sync = new WebhookSync(tx, config, event.eventId, files);
    let result: WebhookResult;
    if (event.eventType === "client.upsert") {
      const client = await sync.client(event.data);
      result = { eventId: event.eventId, outcome: client.outcome, clientId: client.id, ...(client.photo ? { photo: client.photo } : {}) };
    } else if (event.eventType === "base.upsert") {
      const client = await sync.client(event.data.client);
      const base = await sync.base(event.data.base, event.data.client.externalId, client.id, event.data.invoices.length);
      const invoices = [];
      // A stale base snapshot must not suppress independently versioned invoices.
      for (const invoice of event.data.invoices) invoices.push(await sync.invoice(event.data.base.externalId, invoice));
      const outcomes = [client.outcome, base.outcome, ...invoices.map((i) => i.outcome)];
      const outcome = outcomes.includes("applied") ? "applied"
        : outcomes.includes("stale") ? "stale" : "unchanged";
      result = { eventId: event.eventId, outcome, clientId: client.id, saleItemId: base.id, invoices, ...(client.photo ? { photo: client.photo } : {}) };
    } else {
      const invoice = await sync.invoice(event.data.baseExternalId, event.data.invoice);
      result = { eventId: event.eventId, outcome: invoice.outcome, transactionId: invoice.id };
    }
    await tx.insert(inboundWebhookEventsTable).values({
      workspaceId: config.workspaceId, source: config.source, eventId: event.eventId,
      eventType: event.eventType, payloadHash: bodyHash, result,
    });
    return result;
  });
  committed = true;
  return result;
  } finally { await files.finish(committed); }
}

class WebhookSync {
  constructor(private tx: Executor, private config: WebhookIntegration, private eventId: string, private files: ClientPhotoFiles) {}

  private async entity(kind: string, externalId: string): Promise<Entity | undefined> {
    const [row] = await this.tx.select().from(inboundWebhookEntitiesTable).where(and(
      eq(inboundWebhookEntitiesTable.workspaceId, this.config.workspaceId),
      eq(inboundWebhookEntitiesTable.source, this.config.source),
      eq(inboundWebhookEntitiesTable.kind, kind), eq(inboundWebhookEntitiesTable.externalId, externalId),
    )).limit(1);
    return row;
  }

  private async saveEntity(kind: string, externalId: string, internalId: string, version: number, payloadHash: string, parentExternalId: string | null = null) {
    const values = { workspaceId: this.config.workspaceId, source: this.config.source, kind, externalId, internalId,
      version, payloadHash, parentExternalId, updatedAt: new Date() };
    await this.tx.insert(inboundWebhookEntitiesTable).values(values).onConflictDoUpdate({
      target: [inboundWebhookEntitiesTable.workspaceId, inboundWebhookEntitiesTable.source, inboundWebhookEntitiesTable.kind, inboundWebhookEntitiesTable.externalId],
      set: { version, payloadHash, updatedAt: values.updatedAt },
    });
  }

  private async audit(action: string, externalId: string, transactionId: string | null, details: Record<string, unknown>) {
    await this.tx.insert(financialAuditLogsTable).values({
      workspaceId: this.config.workspaceId, transactionId, userId: null, action,
      details: JSON.stringify({ source: this.config.source, eventId: this.eventId, externalId, ...details }),
    });
  }

  private missingInternal() {
    throw new WebhookError(409, "linked_record_deleted", "Registro vinculado removido no Leadger. Reconcile o vínculo antes de reenviar.");
  }

  async client(data: WebhookClient) {
    const link = await this.entity("client", data.externalId);
    const hash = hashPayload(JSON.stringify(data));
    const outcome = compareEntityVersion(data.version, hash, link);
    let [existing] = link ? await this.tx.select().from(clientsTable)
      .where(and(eq(clientsTable.id, link.internalId), eq(clientsTable.workspaceId, this.config.workspaceId))).limit(1).for("update") : [];
    if (link && !existing) this.missingInternal();
    if (outcome !== "apply") return { id: link!.internalId, outcome,
      ...(data.photo !== undefined ? { photo: { status: outcome, version: existing!.photoVersion, url: existing!.photoUrl } } : {}) };
    if (!link) {
      const candidates = await this.tx.select({ id: clientsTable.id, name: clientsTable.name, document: clientsTable.document,
        email: clientsTable.email, phone: clientsTable.phone }).from(clientsTable)
        .where(eq(clientsTable.workspaceId, this.config.workspaceId));
      const matchedId = findExistingWebhookClient(data, candidates);
      if (matchedId) {
        const claims = await this.tx.select({ id: inboundWebhookEntitiesTable.id }).from(inboundWebhookEntitiesTable).where(and(
          eq(inboundWebhookEntitiesTable.workspaceId, this.config.workspaceId), eq(inboundWebhookEntitiesTable.source, this.config.source),
          eq(inboundWebhookEntitiesTable.kind, "client"), eq(inboundWebhookEntitiesTable.internalId, matchedId),
        )).limit(1);
        if (claims.length) throw new WebhookError(409, "client_already_linked", "Cliente já vinculado a outro ID externo desse sistema. Use o ID original.");
        [existing] = await this.tx.select().from(clientsTable).where(eq(clientsTable.id, matchedId)).limit(1).for("update");
      }
    }
    const { externalId, version, photo: incomingPhoto, ...fields } = data;
    // First linking must not erase manual contact details absent in the source.
    if (existing && (!link || link.version === 0)) {
      fields.document ??= existing.document;
      fields.email ??= existing.email;
      fields.phone ??= existing.phone;
      fields.notes ??= existing.notes;
    }
    const [client] = existing
      ? await this.tx.update(clientsTable).set({ ...fields, updatedAt: new Date(),
          ...(existing.phone !== fields.phone ? { whatsappOptIn: false, whatsappOptInAt: null } : {}),
        }).where(eq(clientsTable.id, existing.id)).returning()
      : await this.tx.insert(clientsTable).values({ ...fields, workspaceId: this.config.workspaceId, projectId: this.config.projectId }).returning();
    await this.saveEntity("client", externalId, client.id, version, hash);
    await this.audit("webhook_client_upsert", externalId, null, { clientId: client.id, version, linkedExisting: Boolean(existing && !link) });
    const photo = incomingPhoto === undefined ? undefined : await this.photo(client, incomingPhoto);
    return { id: client.id, outcome: "applied" as const, ...(photo ? { photo } : {}) };
  }

  private async photo(client: typeof clientsTable.$inferSelect, data: WebhookClient["photo"]) {
    if (client.photoSource && client.photoSource !== this.config.source) {
      throw new WebhookError(409, "photo_source_conflict", "Foto gerenciada por outra integração. Reconcile o responsável pela imagem.");
    }
    if (data === null) {
      await this.tx.update(clientsTable).set({ photoUrl: null, updatedAt: new Date() }).where(eq(clientsTable.id, client.id));
      this.files.retire(client.photoUrl);
      await this.audit("webhook_photo_removed", client.id, null, { photoVersion: client.photoVersion });
      return { status: "removed", version: client.photoVersion, url: null };
    }
    if (!data) return undefined;
    if (data.version <= client.photoVersion) return { status: data.version < client.photoVersion ? "stale" : "unchanged",
      version: client.photoVersion, url: client.photoUrl };
    const url = validatePhotoUrl(data.sourceUrl, this.config.photoAllowedHosts);
    const localUrl = await this.files.copy(url, this.config.workspaceId, client.id, data.version);
    await this.tx.update(clientsTable).set({ photoUrl: localUrl, photoVersion: data.version,
      photoSource: this.config.source, updatedAt: new Date() }).where(eq(clientsTable.id, client.id));
    if (client.photoUrl !== localUrl) this.files.retire(client.photoUrl);
    await this.audit("webhook_photo_stored", client.id, null, { photoVersion: data.version });
    return { status: "stored", version: data.version, url: localUrl };
  }

  async base(data: WebhookBase, clientExternalId: string, clientId: string, invoiceCount: number) {
    const link = await this.entity("base", data.externalId);
    if (link && link.parentExternalId !== clientExternalId) throw new WebhookError(409, "base_client_conflict", "Base já vinculada a outro cliente.");
    const hash = hashPayload(JSON.stringify({ ...data, clientExternalId }));
    const outcome = compareEntityVersion(data.version, hash, link);
    let row = link ? await this.loadBase(link) : undefined;
    if (outcome !== "apply") return { id: link!.internalId, outcome };
    if (!link && invoiceCount === 0) throw new WebhookError(422, "initial_invoice_required", "Uma base nova exige ao menos uma fatura em data.invoices.");
    if (!link) {
      const localSubscriptions = await this.tx.select({ item: saleItemsTable, sale: clientSalesTable }).from(saleItemsTable)
        .innerJoin(clientSalesTable, eq(saleItemsTable.saleId, clientSalesTable.id)).where(and(
          eq(saleItemsTable.workspaceId, this.config.workspaceId), eq(clientSalesTable.clientId, clientId),
          eq(clientSalesTable.projectId, this.config.projectId), eq(saleItemsTable.kind, "subscription"),
          eq(saleItemsTable.billingSource, "ledger"),
        )).for("update");
      // A manually-created subscription is ambiguous when multiple bases exist.
      if (localSubscriptions.length) throw new WebhookError(409, "existing_contract_requires_link", "Cliente já possui mensalidade cadastrada neste produto. Vincule a base ao contrato existente em Configurações > Integrações.");
      const legacyContracts = await this.tx.select({ id: clientContractsTable.id }).from(clientContractsTable).where(and(
        eq(clientContractsTable.workspaceId, this.config.workspaceId), eq(clientContractsTable.clientId, clientId), eq(clientContractsTable.projectId, this.config.projectId),
      )).limit(1);
      if (legacyContracts.length) throw new WebhookError(409, "legacy_contract_requires_migration", "Cliente possui um contrato do modelo antigo. Migre e reconcilie esse contrato antes de integrar a base.");
      const sameName = await this.tx.select({ id: saleItemsTable.id }).from(saleItemsTable)
        .innerJoin(clientSalesTable, eq(saleItemsTable.saleId, clientSalesTable.id)).where(and(
          eq(saleItemsTable.workspaceId, this.config.workspaceId), eq(clientSalesTable.clientId, clientId),
          eq(clientSalesTable.projectId, this.config.projectId), eq(saleItemsTable.kind, "subscription"),
          sql`lower(trim(${saleItemsTable.label})) = lower(trim(${data.name}))`,
        )).limit(1);
      if (sameName.length) throw new WebhookError(409, "existing_contract_requires_link", "Já existe uma base com esse nome neste cliente e produto. Confira o ID externo ou vincule o contrato existente.");
    }
    if (row && (row.sale.projectId !== this.config.projectId || row.sale.clientId !== clientId)) {
      throw new WebhookError(409, "base_mapping_conflict", "Vínculo de produto ou cliente da base foi alterado. Reconcile a integração.");
    }
    let saleId = row?.sale.id;
    if (!saleId) {
      const [sale] = await this.tx.insert(clientSalesTable).values({
        workspaceId: this.config.workspaceId, clientId, projectId: this.config.projectId,
        title: data.name, status: data.status,
      }).returning();
      saleId = sale.id;
    } else {
      await this.tx.update(clientSalesTable).set({ title: data.name, status: data.status, updatedAt: new Date() }).where(eq(clientSalesTable.id, saleId));
    }
    const fields = { label: data.name, fixedAmount: data.monthlyAmount, billingDay: data.billingDay,
      startDate: parseDay(data.startDate)!, endDate: data.endDate ? parseDay(data.endDate)! : null,
      status: data.status, billingSource: "external", updatedAt: new Date() };
    const [item] = row
      ? await this.tx.update(saleItemsTable).set(fields).where(eq(saleItemsTable.id, row.item.id)).returning()
      : await this.tx.insert(saleItemsTable).values({ ...fields, workspaceId: this.config.workspaceId, saleId, kind: "subscription", startMode: "fixed_date" }).returning();

    // Only open charges from the effective date get a new recurring price.
    // Paid history is changed only by an explicit, newer invoice snapshot.
    if (row && row.item.fixedAmount !== data.monthlyAmount && data.monthlyAmount > 0) {
      const changed = await this.tx.update(financialTransactionsTable).set({ amount: data.monthlyAmount, updatedAt: new Date() })
        .where(and(eq(financialTransactionsTable.workspaceId, this.config.workspaceId), eq(financialTransactionsTable.saleItemId, item.id),
          eq(financialTransactionsTable.status, "pending"), gte(financialTransactionsTable.dueDate, parseDay(data.effectiveDate)!)))
        .returning({ id: financialTransactionsTable.id });
      for (const charge of changed) await this.audit("webhook_price_changed", data.externalId, charge.id, { amount: data.monthlyAmount, effectiveDate: data.effectiveDate });
    }
    await this.saveEntity("base", data.externalId, item.id, data.version, hash, clientExternalId);
    await this.audit("webhook_base_upsert", data.externalId, null, { saleId, saleItemId: item.id, version: data.version });
    return { id: item.id, outcome: "applied" as const };
  }

  private async loadBase(link: Entity) {
    const [row] = await this.tx.select({ item: saleItemsTable, sale: clientSalesTable }).from(saleItemsTable)
      .innerJoin(clientSalesTable, eq(saleItemsTable.saleId, clientSalesTable.id))
      .where(and(eq(saleItemsTable.id, link.internalId), eq(saleItemsTable.workspaceId, this.config.workspaceId),
        eq(clientSalesTable.workspaceId, this.config.workspaceId))).limit(1).for("update");
    if (!row) this.missingInternal();
    if (row.item.billingSource !== "external" || row.item.kind !== "subscription") throw new WebhookError(409, "base_mapping_conflict", "Base não é uma mensalidade externa.");
    return row;
  }

  async invoice(baseExternalId: string, data: WebhookInvoice) {
    const baseLink = await this.entity("base", baseExternalId);
    if (!baseLink) throw new WebhookError(409, "base_not_synced", "Envie base.upsert antes da fatura.");
    const { item, sale } = await this.loadBase(baseLink);
    const link = await this.entity("invoice", data.externalId);
    if (link && link.parentExternalId !== baseExternalId) throw new WebhookError(409, "invoice_base_conflict", "Fatura já vinculada a outra base.");
    const hash = hashPayload(JSON.stringify({ ...data, baseExternalId }));
    const outcome = compareEntityVersion(data.version, hash, link);
    let [existing] = link ? await this.tx.select().from(financialTransactionsTable)
      .where(and(eq(financialTransactionsTable.id, link.internalId), eq(financialTransactionsTable.workspaceId, this.config.workspaceId))).limit(1).for("update") : [];
    if (link && !existing) this.missingInternal();
    if (!link) {
      // Claim an existing charge for the manually-linked contract by competence.
      // Never create another row for a charge already in the ledger.
      const candidates = await this.tx.select().from(financialTransactionsTable).where(and(
        eq(financialTransactionsTable.workspaceId, this.config.workspaceId), eq(financialTransactionsTable.saleItemId, item.id),
        eq(financialTransactionsTable.type, "inflow"), eq(financialTransactionsTable.referenceMonth, data.referenceMonth),
      )).for("update");
      if (candidates.length > 1) throw new WebhookError(409, "invoice_match_ambiguous", "Mais de uma fatura neste contrato e competência. Reconcile as cobranças antes de integrar.");
      if (candidates.length === 1) {
        const candidate = candidates[0];
        const claimed = await this.tx.select({ id: inboundWebhookEntitiesTable.id }).from(inboundWebhookEntitiesTable)
          .where(and(eq(inboundWebhookEntitiesTable.workspaceId, this.config.workspaceId), eq(inboundWebhookEntitiesTable.kind, "invoice"), eq(inboundWebhookEntitiesTable.internalId, candidate.id))).limit(1);
        if (claimed.length) throw new WebhookError(409, "invoice_already_linked", "A competência já foi vinculada a outro ID externo. Use o mesmo ID de fatura.");
        if (candidate.amount !== data.amount || candidate.status !== data.status || candidate.dueDate.toISOString().slice(0, 10) !== data.dueDate) {
          throw new WebhookError(409, "existing_invoice_conflict", "Fatura existente tem valor, vencimento ou status diferente. Reconcile nos dois sistemas antes do primeiro vínculo.");
        }
        existing = candidate;
      }
    }
    if (existing && (existing.type !== "inflow" || existing.saleItemId !== item.id || existing.clientId !== sale.clientId)) {
      throw new WebhookError(409, "invoice_mapping_conflict", "Vínculo financeiro da fatura foi alterado no Leadger.");
    }
    if (outcome !== "apply") return { id: link!.internalId, outcome };
    // A local account selection is retained; configuration supplies it on creation.
    const accountId = existing?.accountId ?? this.config.accountId;
    const fields = { description: data.description, amount: data.amount, dueDate: parseDay(data.dueDate)!,
      referenceMonth: data.referenceMonth, status: data.status, paidAt: data.paidAt ? new Date(data.paidAt) : null,
      paymentMethod: data.paymentMethod, accountId, updatedAt: new Date() };
    const [record] = existing
      ? await this.tx.update(financialTransactionsTable).set(fields).where(eq(financialTransactionsTable.id, existing.id)).returning()
      : await this.tx.insert(financialTransactionsTable).values({ ...fields, workspaceId: this.config.workspaceId,
          type: "inflow", clientId: sale.clientId, projectId: sale.projectId, saleId: sale.id, saleItemId: item.id,
          revenueType: "recurring", isRecurring: true, recurringInterval: "monthly", approvalStatus: "approved",
        }).returning();
    // Reverse the old paid posting before applying the new one (including undo).
    const deltas = new Map<string, number>();
    if (existing?.status === "paid" && existing.accountId) deltas.set(existing.accountId, -existing.amount);
    if (record.status === "paid" && record.accountId) deltas.set(record.accountId, (deltas.get(record.accountId) ?? 0) + record.amount);
    for (const [id, delta] of [...deltas].sort(([a], [b]) => a.localeCompare(b))) {
      if (delta === 0) continue;
      const updated = await this.tx.update(financialAccountsTable)
        .set({ currentBalance: sql`${financialAccountsTable.currentBalance} + ${delta}`, updatedAt: new Date() })
        .where(and(eq(financialAccountsTable.id, id), eq(financialAccountsTable.workspaceId, this.config.workspaceId)))
        .returning({ id: financialAccountsTable.id });
      if (updated.length !== 1) throw new WebhookError(409, "invoice_account_conflict", "Conta da fatura não pertence ao workspace.");
    }
    await this.saveEntity("invoice", data.externalId, record.id, data.version, hash, baseExternalId);
    await this.audit("webhook_invoice_upsert", data.externalId, record.id, {
      version: data.version, beforeStatus: existing?.status ?? null, status: record.status,
      beforeAmount: existing?.amount ?? null, amount: record.amount, paidBalanceDelta: paidBalanceDelta(existing, record),
    });
    if (existing?.status !== "paid" && record.status === "paid") await enqueuePaymentReceipt(this.tx, this.config.workspaceId, record);
    return { id: record.id, outcome: "applied" as const };
  }
}
