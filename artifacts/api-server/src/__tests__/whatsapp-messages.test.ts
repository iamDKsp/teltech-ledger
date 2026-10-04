import test from "node:test";
import assert from "node:assert/strict";
import { detectPixKeyType, generatePixPayload, normalizePixKey } from "../lib/pix";
import {
  TEMPLATE_KINDS,
  TEMPLATE_META,
  deadlinePhrase,
  firstName,
  greeting,
  overduePhrase,
  renderTemplate,
  resolveTemplate,
  unknownVariables,
} from "../services/whatsapp-templates";
import { composeBilling, composePreview, composeWithdrawal, storedBody } from "../services/whatsapp-compose";

test("detectPixKeyType reconhece cada tipo de chave", () => {
  assert.equal(detectPixKeyType("financeiro@teltech.com"), "email");
  assert.equal(detectPixKeyType("123e4567-e89b-12d3-a456-426614174000"), "random");
  assert.equal(detectPixKeyType("+5514998364338"), "phone");
  assert.equal(detectPixKeyType("12.345.678/0001-95"), "cnpj");
  assert.equal(detectPixKeyType("529.982.247-25"), "cpf");
  // 11 dígitos que não fecham como CPF são tratados como celular
  assert.equal(detectPixKeyType("11999998888"), "phone");
  assert.equal(detectPixKeyType("abc"), null);
  assert.equal(detectPixKeyType(""), null);
});

test("normalizePixKey converte para o formato do BR Code", () => {
  assert.deepEqual(normalizePixKey("(14) 99836-4338", "phone"), { key: "+5514998364338", type: "phone" });
  assert.deepEqual(normalizePixKey("529.982.247-25", "cpf"), { key: "52998224725", type: "cpf" });
  assert.deepEqual(normalizePixKey("Financeiro@Teltech.com"), { key: "financeiro@teltech.com", type: "email" });
  assert.equal(normalizePixKey("123", "cpf"), null);
});

test("generatePixPayload inclui chave normalizada, valor e CRC", () => {
  const payload = generatePixPayload({ pixKey: "14998364338", pixKeyType: "phone", amountCents: 125_000, txId: "abc" });
  assert.ok(payload.startsWith("000201"));
  assert.ok(payload.includes("BR.GOV.BCB.PIX0114+5514998364338"));
  assert.ok(payload.includes("54071250.00"));
  assert.match(payload, /6304[0-9A-F]{4}$/);
});

test("todos os templates padrão usam apenas variáveis conhecidas", () => {
  for (const kind of TEMPLATE_KINDS) {
    assert.deepEqual(unknownVariables(kind, TEMPLATE_META[kind].defaultBody), [], kind);
  }
});

test("unknownVariables aponta variáveis inexistentes", () => {
  assert.deepEqual(unknownVariables("payment_receipt", "Oi {nome}, {coisa} e {outra}"), ["coisa", "outra"]);
});

test("renderTemplate remove linhas cujas variáveis ficaram vazias", () => {
  const out = renderTemplate("Oi {nome}\n🏦 Conta: {conta}\n\n\n\nFim", { nome: "Ana", conta: "" });
  assert.equal(out, "Oi Ana\n\nFim");
});

test("resolveTemplate usa o texto personalizado só quando não está em branco", () => {
  assert.equal(resolveTemplate("payment_receipt", { payment_receipt: "Olá {nome}" }), "Olá {nome}");
  assert.equal(resolveTemplate("payment_receipt", { payment_receipt: "   " }), TEMPLATE_META.payment_receipt.defaultBody);
  assert.equal(resolveTemplate("payment_receipt", null), TEMPLATE_META.payment_receipt.defaultBody);
});

test("saudação, prazo e atraso em português", () => {
  assert.equal(greeting(9), "Bom dia");
  assert.equal(greeting(15), "Boa tarde");
  assert.equal(greeting(21), "Boa noite");
  assert.equal(firstName("Mariana Souza"), "Mariana");
  assert.equal(deadlinePhrase(3), "em 3 dias");
  assert.equal(deadlinePhrase(1), "amanhã");
  assert.equal(deadlinePhrase(0), "hoje");
  assert.equal(deadlinePhrase(-2), "há 2 dias");
  assert.equal(overduePhrase(-1), "1 dia de atraso");
  assert.equal(overduePhrase(-4), "4 dias de atraso");
  assert.equal(overduePhrase(2), "");
});

const settings = { assistantName: "Nexus", companyName: "Teltech", pixKey: "14998364338", pixKeyType: "phone", optOutHintEnabled: true } as never;

test("prévia de cobrança no modo texto leva chave e código Copia e Cola", () => {
  const preview = composePreview("billing_before", { ...(settings as object), pixDeliveryMode: "text" } as never);
  assert.match(preview.text, /Nexus/);
  assert.match(preview.text, /Chave Pix/);
  assert.equal(preview.pixMode, "text");
  assert.equal(preview.fallbackText, undefined);
  assert.ok(preview.pix?.code.startsWith("000201"));
  assert.match(storedBody(preview), /Pix Copia e Cola/);
});

test("prévia de cobrança no modo nativo aponta para o botão e guarda texto alternativo", () => {
  const preview = composePreview("billing_overdue", { ...(settings as object), pixDeliveryMode: "native" } as never);
  assert.equal(preview.pixMode, "native");
  assert.match(preview.text, /botão de \*Pix\*/);
  assert.match(preview.fallbackText ?? "", /Chave Pix/);
  assert.equal(preview.pix?.keyType, "PHONE");
});

test("sem chave Pix a cobrança não leva anexo de Pix", () => {
  const preview = composePreview("billing_due", { ...(settings as object), pixKey: null } as never);
  assert.equal(preview.pix, undefined);
  assert.doesNotMatch(preview.text, /\{pix\}/);
});

test("rodapé de opt-out pode ser desligado e template personalizado prevalece", () => {
  const preview = composePreview(
    "payment_receipt",
    { ...(settings as object), optOutHintEnabled: false } as never,
    { templateOverride: "Olá {nome}, aqui é o {assistente}!" },
  );
  assert.equal(preview.text, "Olá Mariana, aqui é o Nexus!");
});

test("aviso de retirada chama o sócio pelo nome e marca a própria retirada", () => {
  const transaction = { amount: 300_000, description: "Pró-labore", paidAt: new Date("2026-10-04T15:00:00Z") } as never;
  const common = { partnerName: "Tarcísio", partnerUserId: "u1", account: { name: "Conta principal", currentBalance: 1_842_000 }, actorName: "Lucas" };
  const own = composeWithdrawal(transaction, { ...common, recipient: { phone: "5514", name: "Tarcísio Silva", nickname: null, userId: "u1" } }, settings);
  assert.match(own.text, /, Tarcísio! Aqui é o \*Nexus\*/);
  assert.match(own.text, /Sócio: \*Tarcísio \(você\)\*/);
  const other = composeWithdrawal(transaction, { ...common, recipient: { phone: "5511", name: "Lucas Almeida", nickname: "Lu", userId: "u2" } }, settings);
  assert.match(other.text, /, Lu! Aqui é o \*Nexus\*/);
  assert.match(other.text, /Sócio: \*Tarcísio\*/);
  assert.match(other.text, /Registrado por: Lucas/);
});

test("composeBilling escolhe o texto pelo prazo na cobrança manual", () => {
  const now = new Date("2026-10-04T15:00:00Z");
  const base = { id: "11111111-2222-3333-4444-555555555555", description: "Site", installmentNumber: 2, installmentsTotal: 6, amount: 50_000 };
  const overdue = composeBilling("manual_billing", { ...base, dueDate: new Date("2026-10-01T00:00:00Z") } as never, { name: "Mariana Souza" }, settings, now);
  assert.equal(overdue.templateKind, "billing_overdue");
  assert.match(overdue.text, /3 dias de atraso/);
  assert.match(overdue.text, /Site \(parcela 2\/6\)/);
  const upcoming = composeBilling("manual_billing", { ...base, dueDate: new Date("2026-10-07T00:00:00Z") } as never, { name: "Mariana Souza" }, settings, now);
  assert.equal(upcoming.templateKind, "billing_before");
  assert.match(upcoming.text, /vence \*em 3 dias\*/);
});
