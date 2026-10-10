import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import sharp from "sharp";
import { mkdtemp, readFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inboundWebhookSchema, hashPayload } from "../services/inbound-webhook-contract";

const testUrl = process.env.INBOUND_WEBHOOK_TEST_DATABASE_URL;

test("PostgreSQL: recebimento atômico, retries concorrentes, versões, reajuste, pagamento e estorno", { skip: !testUrl }, async () => {
  // Never run against an ordinary application database, even by accidental env reuse.
  assert.match(new URL(testUrl!).pathname, /^\/([a-z0-9_]+_)?webhook_test$/i, "Use um banco exclusivo com nome webhook_test ou *_webhook_test");
  process.env.DATABASE_URL = testUrl;
  const { db, pool, usersTable, workspacesTable, workspaceMembersTable, projectsTable, clientsTable, clientSalesTable, saleItemsTable,
    financialAccountsTable, financialTransactionsTable, inboundWebhookEventsTable, inboundWebhookEntitiesTable } = await import("@workspace/db");
  const { eq, and } = await import("drizzle-orm");
  const { processInboundWebhook } = await import("../services/inbound-webhook");
  const { generateSubscriptionCharges } = await import("../services/sales-billing");
  const { default: integrationsRouter } = await import("../routes/webhook-integrations");
  const { signToken } = await import("../lib/auth");
  const userId = randomUUID(), workspaceId = randomUUID(), projectId = randomUUID(), accountId = randomUUID();
  const config = { source: "integration-test", name: "Teste", secret: "test-secret-not-for-production-00000000", workspaceId, projectId, accountId };
  const client = { externalId: "client-a", version: 1, name: "Cliente A" };
  const base = { externalId: "base-a", version: 1, name: "Base A", monthlyAmount: 10000, billingDay: 10,
    startDate: "2026-10-10", effectiveDate: "2026-10-10" };
  const invoice = { externalId: "invoice-a", version: 1, description: "Mensalidade", amount: 10000,
    dueDate: "2026-10-10", referenceMonth: "2026-10", status: "pending" };
  const send = (eventId: string, eventType: string, data: unknown) => {
    const raw = JSON.stringify({ schemaVersion: 1, eventId, eventType, occurredAt: new Date().toISOString(), data });
    return { event: inboundWebhookSchema.parse(JSON.parse(raw)), hash: hashPayload(raw) };
  };
  const apply = (eventId: string, eventType: string, data: unknown) => {
    const { event, hash } = send(eventId, eventType, data);
    return processInboundWebhook(config, event, hash);
  };
  const balance = async () => (await db.select().from(financialAccountsTable).where(eq(financialAccountsTable.id, accountId)))[0].currentBalance;
  const photoRoot = await mkdtemp(path.join(tmpdir(), "leadger-photo-db-test-"));
  try {
    await db.insert(usersTable).values({ id: userId, name: "Test", email: `${userId}@example.test`, passwordHash: "not-a-login" });
    await db.insert(workspacesTable).values({ id: workspaceId, name: "Test", slug: `test-${workspaceId}`, ownerId: userId });
    await db.insert(workspaceMembersTable).values({ workspaceId, userId, role: "owner" });
    await db.insert(projectsTable).values({ id: projectId, workspaceId, name: "Produto", createdBy: userId });
    await db.insert(financialAccountsTable).values({ id: accountId, workspaceId, name: "Conta teste" });

    // Failure after client creation must roll back the client and all mappings.
    await assert.rejects(apply("missing-first-invoice", "base.upsert", { client, base }), (e: any) => e.code === "initial_invoice_required");
    assert.equal((await db.select().from(clientsTable).where(eq(clientsTable.workspaceId, workspaceId))).length, 0);
    assert.equal((await db.select().from(inboundWebhookEntitiesTable).where(eq(inboundWebhookEntitiesTable.workspaceId, workspaceId))).length, 0);
    assert.equal((await db.select().from(inboundWebhookEventsTable).where(eq(inboundWebhookEventsTable.workspaceId, workspaceId))).length, 0);

    const created = await apply("new-base", "base.upsert", { client, base, invoices: [invoice] });
    assert.equal(created.outcome, "applied");
    assert.equal((await db.select().from(clientSalesTable).where(eq(clientSalesTable.workspaceId, workspaceId))).length, 1);
    const [item] = await db.select().from(saleItemsTable).where(eq(saleItemsTable.id, created.saleItemId as string));
    assert.equal(item.billingSource, "external");
    assert.equal(await generateSubscriptionCharges(db, item, { workspaceId, saleId: item.saleId,
      clientId: created.clientId as string, clientName: "Cliente A", projectId }), 0);
    const txs = () => db.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.workspaceId, workspaceId));
    assert.equal((await txs()).length, 1);
    assert.equal(await balance(), 0);

    const paidInvoice = { ...invoice, version: 2, status: "paid", paidAt: "2026-10-10T15:00:00Z", paymentMethod: "pix" };
    const payment = send("payment", "invoice.upsert", { baseExternalId: base.externalId, invoice: paidInvoice });
    const retries = await Promise.all([processInboundWebhook(config, payment.event, payment.hash), processInboundWebhook(config, payment.event, payment.hash)]);
    assert.equal(retries.filter((r) => r.duplicate).length, 1);
    assert.equal(await balance(), 10000);
    assert.equal((await txs())[0].status, "paid");
    await assert.rejects(processInboundWebhook(config, payment.event, "different-body"), (e: any) => e.code === "event_id_conflict");
    assert.equal(await balance(), 10000);

    assert.equal((await apply("old-payment", "invoice.upsert", { baseExternalId: base.externalId, invoice })).outcome, "stale");
    assert.equal(await balance(), 10000);
    await assert.rejects(apply("same-version-conflict", "invoice.upsert", { baseExternalId: base.externalId, invoice: { ...paidInvoice, amount: 12000 } }), (e: any) => e.code === "version_conflict");
    assert.equal(await balance(), 10000);

    await apply("future-invoice", "invoice.upsert", { baseExternalId: base.externalId,
      invoice: { ...invoice, externalId: "invoice-b", dueDate: "2026-11-10", referenceMonth: "2026-11" } });
    await apply("reprice", "base.upsert", { client, base: { ...base, version: 2, monthlyAmount: 15000, effectiveDate: "2026-11-01" } });
    assert.deepEqual((await txs()).map((t) => [t.status, t.amount]).sort(), [["paid", 10000], ["pending", 15000]].sort());
    assert.equal(await balance(), 10000);
    await apply("correct-payment", "invoice.upsert", { baseExternalId: base.externalId, invoice: { ...paidInvoice, version: 3, amount: 12000 } });
    assert.equal(await balance(), 12000);
    await apply("undo-payment", "invoice.upsert", { baseExternalId: base.externalId, invoice: { ...invoice, version: 4 } });
    assert.equal(await balance(), 0);

    await db.update(clientsTable).set({ phone: "+5514999999999", whatsappOptIn: true, whatsappOptInAt: new Date() })
      .where(eq(clientsTable.id, created.clientId as string));
    await apply("changed-phone", "client.upsert", { ...client, version: 2, phone: "+5514888888888" });
    assert.equal((await db.select().from(clientsTable).where(eq(clientsTable.id, created.clientId as string)))[0].whatsappOptIn, false);

    // Validate tenant isolation and deterministic behavior for deleted records.
    const invalidConfig = { ...config, workspaceId: randomUUID() };
    const invalid = send("cross-workspace", "client.upsert", client);
    await assert.rejects(processInboundWebhook(invalidConfig, invalid.event, invalid.hash), (e: any) => e.code === "project_not_configured");
    const [txRecord] = await txs();
    await db.delete(financialTransactionsTable).where(eq(financialTransactionsTable.id, txRecord.id));
    const link = (await db.select().from(inboundWebhookEntitiesTable).where(and(eq(inboundWebhookEntitiesTable.internalId, txRecord.id), eq(inboundWebhookEntitiesTable.kind, "invoice"))))[0];
    const deleted = { ...(link.externalId === "invoice-a" ? invoice : { ...invoice, externalId: "invoice-b" }), version: 10 };
    await assert.rejects(apply("deleted-invoice", "invoice.upsert", { baseExternalId: base.externalId, invoice: deleted }), (e: any) => e.code === "linked_record_deleted");

    // Existing manual client AND contract AND paid charge must be reused.
    const [manual] = await db.insert(clientsTable).values({ workspaceId, name: "Cliente existente", document: "12.345.678/0001-99", email: "manual@example.test", notes: "Anotação manual" }).returning();
    const [manualSale] = await db.insert(clientSalesTable).values({ workspaceId, clientId: manual.id, projectId, title: "Mensalidade existente" }).returning();
    const [manualItem] = await db.insert(saleItemsTable).values({ workspaceId, saleId: manualSale.id, kind: "subscription", label: "Base manual", fixedAmount: 10000,
      billingDay: 10, startDate: new Date("2026-10-10T12:00:00Z"), startMode: "fixed_date" }).returning();
    const [manualCharge] = await db.insert(financialTransactionsTable).values({ workspaceId, clientId: manual.id, projectId, saleId: manualSale.id,
      saleItemId: manualItem.id, type: "inflow", status: "paid", amount: 10000, description: "Mensalidade manual", dueDate: new Date("2026-10-10T12:00:00Z"),
      referenceMonth: "2026-10", revenueType: "recurring", accountId, paidAt: new Date("2026-10-10T15:00:00Z") }).returning();
    await db.update(financialAccountsTable).set({ currentBalance: 10000 }).where(eq(financialAccountsTable.id, accountId));
    const manualClientSnapshot = { externalId: "manual-client", version: 1, name: manual.name, document: "12345678000199" };
    const manualSnapshot = { client: manualClientSnapshot, base: { ...base, externalId: "manual-base", name: "Base manual" },
      invoices: [{ ...paidInvoice, externalId: "manual-invoice", version: 1 }] };
    const autoMatch = await apply("match-manual-client", "client.upsert", manualClientSnapshot);
    assert.equal(autoMatch.clientId, manual.id);
    await assert.rejects(apply("unlinked-manual-base", "base.upsert", manualSnapshot), (e: any) => e.code === "existing_contract_requires_link");
    assert.equal((await db.select().from(clientsTable).where(eq(clientsTable.workspaceId, workspaceId))).length, 2);

    const savedConfig = process.env.INBOUND_WEBHOOK_INTEGRATIONS;
    process.env.INBOUND_WEBHOOK_INTEGRATIONS = JSON.stringify([config]);
    const app = express(); app.use(express.json()); app.use("/api/integrations/webhooks", integrationsRouter);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    try {
      const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/integrations/webhooks`;
      const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${signToken({ userId, email: `${userId}@example.test` })}` };
      const body = JSON.stringify({ clientExternalId: "manual-client", clientId: manual.id, baseExternalId: "manual-base", saleItemId: manualItem.id });
      assert.equal((await fetch(`${url}/${config.source}/link`, { method: "POST", body, headers: { "Content-Type": "application/json" } })).status, 401);
      assert.equal((await fetch(`${url}/${config.source}/link`, { method: "POST", body, headers: authHeaders })).status, 200);
      const linked = await apply("linked-manual-base", "base.upsert", manualSnapshot);
      assert.equal(linked.clientId, manual.id);
      assert.equal(linked.saleItemId, manualItem.id);
      assert.equal((linked.invoices as Array<{ id: string }>)[0].id, manualCharge.id);
      assert.equal((await db.select().from(clientsTable).where(eq(clientsTable.workspaceId, workspaceId))).length, 2);
      assert.equal((await db.select().from(clientSalesTable).where(eq(clientSalesTable.workspaceId, workspaceId))).length, 2);
      assert.equal(await balance(), 10000); // Existing payment was not credited again.
      const [reused] = await db.select().from(clientsTable).where(eq(clientsTable.id, manual.id));
      assert.equal(reused.email, "manual@example.test"); assert.equal(reused.notes, "Anotação manual");
      const status = await fetch(url, { headers: authHeaders });
      const statusBody = await status.text();
      assert.equal(status.status, 200); assert.equal(statusBody.includes(config.secret), false);
      const revision = await fetch(`${url}/revision`, { headers: authHeaders });
      assert.equal(revision.status, 200);
      await assert.rejects(apply("duplicate-name", "client.upsert", { externalId: "another-id", version: 1, name: manual.name }),
        (e: any) => e.code === "existing_client_requires_link");
    } finally {
      process.env.INBOUND_WEBHOOK_INTEGRATIONS = savedConfig;
      await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
    }

    const blue = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#2266cc" } }).png().toBuffer();
    const green = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#22aa66" } }).png().toBuffer();
    let downloads = 0;
    const photoConfig = { ...config, photoAllowedHosts: ["cdn.example.test"] };
    const photoIo = { uploadRoot: photoRoot, download: async (url: URL) => {
      downloads++;
      return url.pathname === "/bad.png" ? Buffer.from("invalid image") : url.pathname === "/green.png" ? green : blue;
    } };
    const sendPhoto = (id: string, version: number, photo?: object | null) => send(id, "client.upsert", { ...client, version,
      ...(photo !== undefined ? { photo } : {}) });
    const firstPhoto = sendPhoto("first-photo", 3, { sourceUrl: "https://cdn.example.test/blue.png", version: 1 });
    const stored = await processInboundWebhook(photoConfig, firstPhoto.event, firstPhoto.hash, photoIo);
    const storedPhoto = stored.photo as { status: string; version: number; url: string };
    assert.equal(storedPhoto.status, "stored"); assert.equal(downloads, 1);
    assert.ok(storedPhoto.url.startsWith("/uploads/client-photos/"));
    assert.equal((await sharp(await readFile(path.join(photoRoot, storedPhoto.url.slice("/uploads/".length)))).metadata()).format, "webp");
    assert.equal((await processInboundWebhook(photoConfig, firstPhoto.event, firstPhoto.hash, photoIo)).duplicate, true);
    assert.equal(downloads, 1);
    const clientRow = async () => (await db.select().from(clientsTable).where(eq(clientsTable.id, created.clientId as string)))[0];
    const preserve = sendPhoto("preserve-photo", 4);
    await processInboundWebhook(photoConfig, preserve.event, preserve.hash, photoIo);
    assert.equal((await clientRow()).photoUrl, storedPhoto.url);

    const secondPhoto = sendPhoto("replace-photo", 5, { sourceUrl: "https://cdn.example.test/green.png", version: 2 });
    const replaced = await processInboundWebhook(photoConfig, secondPhoto.event, secondPhoto.hash, photoIo);
    const replacedPhoto = replaced.photo as { url: string };
    assert.notEqual(replacedPhoto.url, storedPhoto.url); assert.equal(downloads, 2);
    await assert.rejects(access(path.join(photoRoot, storedPhoto.url.slice("/uploads/".length))));
    const oldPhoto = sendPhoto("old-photo", 6, { sourceUrl: "https://cdn.example.test/blue.png", version: 1 });
    const old = await processInboundWebhook(photoConfig, oldPhoto.event, oldPhoto.hash, photoIo);
    assert.equal((old.photo as { status: string }).status, "stale"); assert.equal(downloads, 2);
    assert.equal((await clientRow()).photoUrl, replacedPhoto.url);

    const badPhoto = sendPhoto("invalid-image", 7, { sourceUrl: "https://cdn.example.test/bad.png", version: 3 });
    await assert.rejects(processInboundWebhook(photoConfig, badPhoto.event, badPhoto.hash, photoIo), (e: any) => e.code === "photo_format_invalid");
    assert.equal((await clientRow()).photoUrl, replacedPhoto.url);
    assert.equal((await db.select().from(inboundWebhookEventsTable).where(and(eq(inboundWebhookEventsTable.workspaceId, workspaceId), eq(inboundWebhookEventsTable.eventId, "invalid-image")))).length, 0);
    const transient = sendPhoto("transient-photo", 7, { sourceUrl: "https://cdn.example.test/blue.png", version: 3 });
    await assert.rejects(processInboundWebhook(photoConfig, transient.event, transient.hash, { uploadRoot: photoRoot, download: async () => { throw new Error("origin offline"); } }));
    assert.equal((await clientRow()).photoUrl, replacedPhoto.url);
    const retry = await processInboundWebhook(photoConfig, transient.event, transient.hash, photoIo);
    assert.equal((retry.photo as { status: string }).status, "stored");

    const remove = sendPhoto("remove-photo", 8, null);
    const removed = await processInboundWebhook(photoConfig, remove.event, remove.hash, photoIo);
    assert.equal((removed.photo as { status: string }).status, "removed"); assert.equal((await clientRow()).photoUrl, null);
    const staleRestore = sendPhoto("no-resurrect-photo", 9, { sourceUrl: "https://cdn.example.test/blue.png", version: 3 });
    await processInboundWebhook(photoConfig, staleRestore.event, staleRestore.hash, photoIo);
    assert.equal((await clientRow()).photoUrl, null);
    const restored = sendPhoto("new-photo-after-removal", 10, { sourceUrl: "https://cdn.example.test/green.png", version: 4 });
    await processInboundWebhook(photoConfig, restored.event, restored.hash, photoIo);
    assert.ok((await clientRow()).photoUrl);
  } finally {
    await db.delete(workspacesTable).where(eq(workspacesTable.id, workspaceId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await pool.end();
    await rm(photoRoot, { recursive: true, force: true });
  }
});
