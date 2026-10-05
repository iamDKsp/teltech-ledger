import test from "node:test";
import assert from "node:assert/strict";
import {
  addMonthsClamped,
  buildEntrySchedule,
  firstOccurrenceOfDay,
  horizonEndFor,
  listSubscriptionDueDates,
  monthKey,
  parseDay,
  resolveSubscriptionStart,
  splitInstallments,
  subscriptionAmountAt,
} from "../services/sales-schedule";

const d = (s: string) => parseDay(s)!;
const iso = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);

test("parseDay valida datas e usa meio-dia UTC", () => {
  assert.equal(d("2026-10-10").toISOString(), "2026-10-10T12:00:00.000Z");
  assert.equal(parseDay("2026-02-31"), null);
  assert.equal(parseDay("abc"), null);
});

test("addMonthsClamped não deriva em fim de mês", () => {
  const base = d("2026-01-31");
  assert.equal(iso(addMonthsClamped(base, 1)), "2026-02-28");
  assert.equal(iso(addMonthsClamped(base, 2)), "2026-03-31");
  assert.equal(iso(addMonthsClamped(base, 13)), "2027-02-28");
});

test("splitInstallments: resto vai para a última parcela e soma bate", () => {
  const parts = splitInstallments(10000, 3);
  assert.deepEqual(parts, [3333, 3333, 3334]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 10000);
});

test("firstOccurrenceOfDay respeita inclusive/estrito", () => {
  assert.equal(iso(firstOccurrenceOfDay(d("2026-10-10"), 10, true)), "2026-10-10");
  assert.equal(iso(firstOccurrenceOfDay(d("2026-10-10"), 10, false)), "2026-11-10");
  assert.equal(iso(firstOccurrenceOfDay(d("2026-10-10"), 5, true)), "2026-11-05");
  assert.equal(iso(firstOccurrenceOfDay(d("2026-12-20"), 5, true)), "2027-01-05");
});

const entry3x = () =>
  buildEntrySchedule({
    mode: "installments",
    label: "Entrada",
    totalAmount: 600000,
    installmentsCount: 3,
    firstDueDate: d("2026-10-10"),
  });

test("Cenário A: entrada em 3x, mensalidade só depois de quitar", () => {
  const entry = entry3x();
  assert.deepEqual(entry.map((e) => iso(e.dueDate)), ["2026-10-10", "2026-11-10", "2026-12-10"]);
  const start = resolveSubscriptionStart({ startMode: "after_entry", billingDay: 10, entry });
  assert.equal(iso(start), "2027-01-10");
});

test("Cenário A2: entrada no dia 04 e cobrança no dia 10 (não cai no mesmo mês da entrada)", () => {
  const entry = buildEntrySchedule({
    mode: "installments",
    label: "Entrada",
    totalAmount: 420000,
    installmentsCount: 1,
    firstDueDate: d("2026-10-04"),
  });
  const start = resolveSubscriptionStart({ startMode: "after_entry", billingDay: 10, entry });
  assert.equal(iso(start), "2026-11-10");
});

test("Cenário B: entrada à vista, mensalidade junto (mesmo mês)", () => {
  const entry = buildEntrySchedule({ mode: "installments", label: "Entrada", totalAmount: 500000, installmentsCount: 1, firstDueDate: d("2026-10-10") });
  const start = resolveSubscriptionStart({ startMode: "with_entry", billingDay: 10, entry });
  assert.equal(iso(start), "2026-10-10");
  // dia de cobrança antes da entrada → vai para o mês seguinte (nunca antes da entrada)
  const start2 = resolveSubscriptionStart({ startMode: "with_entry", billingDay: 5, entry });
  assert.equal(iso(start2), "2026-11-05");
});

test("Cenário C: entrada parcelada e mensalidade já desde a 1ª parcela", () => {
  const entry = entry3x();
  const start = resolveSubscriptionStart({ startMode: "with_entry", billingDay: 10, entry });
  assert.equal(iso(start), "2026-10-10");
});

test("Cenário D/E: data fixa e após a entrega", () => {
  assert.equal(iso(resolveSubscriptionStart({ startMode: "fixed_date", billingDay: 1, entry: null, fixedDate: d("2026-11-15") })), "2026-11-15");
  assert.equal(resolveSubscriptionStart({ startMode: "after_delivery", billingDay: 1, entry: null }), null);
});

test("Marcos: ordena por data e preserva valores", () => {
  const entry = buildEntrySchedule({
    mode: "milestones",
    label: "Projeto",
    totalAmount: 0,
    installmentsCount: 0,
    firstDueDate: d("2026-10-01"),
    milestones: [
      { label: "Entrega", amount: 400000, dueDate: d("2026-12-01") },
      { label: "Kickoff", amount: 200000, dueDate: d("2026-10-01") },
    ],
  });
  assert.deepEqual(entry.map((e) => e.label), ["Kickoff", "Entrega"]);
});

test("Módulos: preço soma módulos vigentes e respeita troca com vigência", () => {
  const windows = [
    { price: 100000, startDate: d("2026-10-10"), endDate: null },                 // módulo A
    { price: 50000, startDate: d("2026-10-10"), endDate: d("2026-12-31") },        // módulo B encerrado
    { price: 70000, startDate: d("2027-01-01"), endDate: null },                  // módulo C novo
  ];
  assert.equal(subscriptionAmountAt(d("2026-11-10"), windows, null), 150000);
  assert.equal(subscriptionAmountAt(d("2027-01-10"), windows, null), 170000);
  assert.equal(subscriptionAmountAt(d("2026-11-10"), [], 99000), 99000);
});

test("Geração contínua: respeita horizonte, endDate e generatedThrough", () => {
  const now = new Date(Date.UTC(2026, 9, 4, 15)); // 04/10/2026
  const horizonEnd = horizonEndFor(now, 3); // até 31/01/2027
  const all = listSubscriptionDueDates({ startDate: d("2026-10-10"), endDate: null, generatedThrough: null, horizonEnd });
  assert.deepEqual(all.map((x) => x.referenceMonth), ["2026-10", "2026-11", "2026-12", "2027-01"]);

  const rest = listSubscriptionDueDates({ startDate: d("2026-10-10"), endDate: null, generatedThrough: "2026-11", horizonEnd });
  assert.deepEqual(rest.map((x) => x.referenceMonth), ["2026-12", "2027-01"]);

  const capped = listSubscriptionDueDates({ startDate: d("2026-10-10"), endDate: d("2026-11-30"), generatedThrough: null, horizonEnd });
  assert.deepEqual(capped.map((x) => x.referenceMonth), ["2026-10", "2026-11"]);
  assert.equal(monthKey(d("2026-10-31")), "2026-10");
});
