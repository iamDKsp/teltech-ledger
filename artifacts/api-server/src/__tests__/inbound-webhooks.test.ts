import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import express from "express";
import { createInboundWebhookRouter } from "../routes/inbound-webhooks";
import { inboundWebhookSchema, readWebhookIntegrations, webhookSignature, verifyWebhookSignature,
  compareEntityVersion, paidBalanceDelta, WebhookError, findExistingWebhookClient } from "../services/inbound-webhook-contract";

const secret = "test-secret-with-at-least-thirty-two-characters";
const config = { source: "sistema-teste", name: "Teste", secret,
  workspaceId: "00000000-0000-4000-8000-000000000001", projectId: "00000000-0000-4000-8000-000000000002", accountId: null };
const client = { externalId: "client-1", version: 1, name: "Cliente teste" };
const envelope = { schemaVersion: 1, eventId: "event-1", occurredAt: "2026-10-10T12:00:00-03:00" };

test("HMAC interoperável cobre timestamp, source e os bytes do corpo", () => {
  const raw = Buffer.from(JSON.stringify({ ...envelope, eventType: "client.upsert", data: client }));
  const timestamp = "1791630000";
  const expected = `sha256=${createHmac("sha256", secret).update(Buffer.concat([Buffer.from(`${timestamp}.sistema-teste.`), raw])).digest("hex")}`;
  assert.equal(webhookSignature(secret, config.source, timestamp, raw), expected);
  assert.equal(verifyWebhookSignature(secret, config.source, timestamp, expected, raw, Number(timestamp) * 1000), true);
  assert.equal(verifyWebhookSignature(secret, "outro-sistema", timestamp, expected, raw, Number(timestamp) * 1000), false);
  assert.equal(verifyWebhookSignature(secret, config.source, timestamp, expected, Buffer.concat([raw, Buffer.from(" ")]), Number(timestamp) * 1000), false);
  assert.equal(verifyWebhookSignature(secret, config.source, timestamp, expected, raw, Number(timestamp) * 1000 + 301_000), false);
  assert.equal(verifyWebhookSignature(secret, config.source, timestamp, expected, raw, Number(timestamp) * 1000 - 301_000), false);
  assert.equal(verifyWebhookSignature(secret, config.source, timestamp, "sha256=abc", raw), false);
});

test("configuração fecha sem segredos e rejeita origem duplicada", () => {
  assert.deepEqual(readWebhookIntegrations(""), []);
  assert.deepEqual(readWebhookIntegrations(JSON.stringify([config])), [config]);
  assert.throws(() => readWebhookIntegrations(JSON.stringify([config, config])), WebhookError);
  assert.throws(() => readWebhookIntegrations(JSON.stringify([{ ...config, secret: "short" }])), (e: unknown) =>
    e instanceof WebhookError && !e.message.includes("short"));
});

test("versões rejeitam colisão e ignoram atraso sem aplicar uma segunda vez", () => {
  assert.equal(compareEntityVersion(1, "a"), "apply");
  assert.equal(compareEntityVersion(2, "b", { version: 1, payloadHash: "a" }), "apply");
  assert.equal(compareEntityVersion(1, "a", { version: 1, payloadHash: "a" }), "unchanged");
  assert.equal(compareEntityVersion(1, "b", { version: 2, payloadHash: "a" }), "stale");
  assert.throws(() => compareEntityVersion(2, "b", { version: 2, payloadHash: "a" }), WebhookError);
});

test("efeito financeiro cobre baixa, correção e estorno sem crédito duplicado", () => {
  assert.equal(paidBalanceDelta(undefined, { status: "paid", amount: 10000 }), 10000);
  assert.equal(paidBalanceDelta({ status: "pending", amount: 10000 }, { status: "paid", amount: 10000 }), 10000);
  assert.equal(paidBalanceDelta({ status: "paid", amount: 10000 }, { status: "paid", amount: 10000 }), 0);
  assert.equal(paidBalanceDelta({ status: "paid", amount: 10000 }, { status: "paid", amount: 15000 }), 5000);
  assert.equal(paidBalanceDelta({ status: "paid", amount: 10000 }, { status: "pending", amount: 15000 }), -10000);
  assert.equal(paidBalanceDelta({ status: "paid", amount: 10000 }, { status: "cancelled", amount: 10000 }), -10000);
});

test("cliente manual é reutilizado por CPF/CNPJ ou e-mail; ambiguidades e nome isolado bloqueiam duplicação", () => {
  const a = { id: "a", name: "João Silva", document: "12.345.678/0001-99", email: "ana@example.test", phone: null };
  const b = { id: "b", name: "Outra empresa", document: "98.765.432/0001-99", email: "bia@example.test", phone: null };
  assert.equal(findExistingWebhookClient({ ...a, name: "Empresa nova", document: "12345678000199" }, [a, b]), "a");
  assert.equal(findExistingWebhookClient({ ...a, document: null, email: "ANA@EXAMPLE.TEST" }, [a, b]), "a");
  assert.throws(() => findExistingWebhookClient({ ...a, email: b.email }, [a, b]), (e: any) => e.code === "client_identity_conflict");
  assert.throws(() => findExistingWebhookClient(a, [a, { ...a, id: "duplicate" }]), (e: any) => e.code === "client_match_ambiguous");
  assert.throws(() => findExistingWebhookClient({ ...a, document: b.document, email: a.email }, [a]), (e: any) => e.code === "client_identity_conflict");
  assert.throws(() => findExistingWebhookClient({ ...a, name: "JOAO SILVA", document: null, email: null }, [a]), (e: any) => e.code === "existing_client_requires_link");
  assert.equal(findExistingWebhookClient({ ...a, name: "Cliente realmente novo", document: null, email: null }, [a]), undefined);
});

test("contrato rejeita valor decimal, data impossível, pagamento sem data e campos fora do escopo", () => {
  const invoice = { externalId: "inv-1", version: 1, description: "Mensalidade", amount: 10000, dueDate: "2026-10-10", referenceMonth: "2026-10", status: "pending" };
  const payload = (patch: object) => ({ ...envelope, eventType: "invoice.upsert", data: { baseExternalId: "base-1", invoice: { ...invoice, ...patch } } });
  assert.equal(inboundWebhookSchema.safeParse(payload({})).success, true);
  for (const patch of [{ amount: 100.50 }, { amount: "10000" }, { dueDate: "2026-02-31" }, { status: "paid" },
    { paidAt: "2026-10-10T15:00:00Z" }, { accountId: config.workspaceId }, { referenceMonth: "2026-13" }, { version: 0 }]) {
    assert.equal(inboundWebhookSchema.safeParse(payload(patch)).success, false, JSON.stringify(patch));
  }
  assert.equal(inboundWebhookSchema.safeParse({ ...envelope, eventType: "client.upsert", data: { ...client, whatsappOptIn: true } }).success, false);
  assert.equal(inboundWebhookSchema.safeParse({ ...payload({}), workspaceId: config.workspaceId }).success, false);
});

test("HTTP usa corpo bruto e não chama persistência com autenticação ou payload inválidos", async () => {
  let calls = 0;
  const app = express();
  app.use("/api/webhooks/inbound", createInboundWebhookRouter({ integrations: () => [config], process: async (_config, event) => {
    calls++; return { eventId: event.eventId, outcome: "applied" };
  } }));
  // The global JSON parser must remain after the webhook router.
  app.use(express.json());
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const port = (server.address() as { port: number }).port;
    const raw = JSON.stringify({ ...envelope, eventType: "client.upsert", data: client }, null, 2);
    const send = async (body: string, headers: Record<string, string> = {}, source = config.source) => {
      const ts = String(Math.floor(Date.now() / 1000));
      return fetch(`http://127.0.0.1:${port}/api/webhooks/inbound/${source}`, { method: "POST", body,
        headers: { "Content-Type": "application/json", "x-leadger-timestamp": ts,
          "x-leadger-signature": webhookSignature(secret, source, ts, Buffer.from(body)), ...headers } });
    };
    const success = await send(raw);
    assert.equal(success.status, 200);
    assert.equal(((await success.json()) as { outcome: string }).outcome, "applied");
    assert.equal(calls, 1);
    assert.equal((await send(raw, { "x-leadger-signature": "bad" })).status, 401);
    assert.equal((await send(raw, { "x-leadger-timestamp": "1000000000" })).status, 401);
    assert.equal((await send(raw, { "Content-Type": "text/plain" })).status, 415);
    assert.equal((await send(raw, { "Content-Encoding": "gzip" })).status, 415);
    assert.equal((await send("{broken")).status, 400);
    assert.equal((await send(JSON.stringify({ ...envelope, eventType: "client.upsert", data: { ...client, workspaceId: config.workspaceId } }))).status, 422);
    assert.equal((await send(raw, {}, "unknown")).status, 404);
    assert.equal((await send("x".repeat(262145))).status, 413);
    assert.equal(calls, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  }
});
