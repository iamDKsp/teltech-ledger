// Lógica pura de cronograma de vendas (sem acesso a banco).
// Todas as datas de vencimento são gravadas ao meio-dia UTC para que o fuso
// horário local (ex.: UTC-3) nunca empurre um vencimento para o mês anterior.

export type StartMode = "with_entry" | "after_entry" | "fixed_date" | "after_delivery";
export type EntryMode = "installments" | "milestones";

export const START_MODES: StartMode[] = ["with_entry", "after_entry", "fixed_date", "after_delivery"];

export interface EntryParcel {
  label: string;
  amount: number; // centavos
  dueDate: Date;
}

export interface ModulePriceWindow {
  price: number; // centavos
  startDate: Date;
  endDate: Date | null;
}

/** 'YYYY-MM-DD' (ou ISO) → meio-dia UTC daquele dia. Retorna null se inválido. */
export function parseDay(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const iso = value instanceof Date ? value.toISOString() : value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

export function todayNoonUTC(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0));
}

function lastDayOfMonthUTC(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Soma meses preservando o dia do mês original (com clamp no fim do mês). Sem deriva. */
export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12, 0, 0));
  const last = lastDayOfMonthUTC(target.getUTCFullYear(), target.getUTCMonth());
  target.setUTCDate(Math.min(day, last));
  return target;
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Primeira ocorrência do `day` do mês a partir de `ref` (inclusive ou estritamente depois). */
export function firstOccurrenceOfDay(ref: Date, day: number, inclusive: boolean): Date {
  const clampDay = (y: number, m0: number) => Math.min(day, lastDayOfMonthUTC(y, m0));
  let candidate = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), clampDay(ref.getUTCFullYear(), ref.getUTCMonth()), 12, 0, 0));
  const ok = (c: Date) => (inclusive ? c.getTime() >= ref.getTime() : c.getTime() > ref.getTime());
  if (!ok(candidate)) {
    const y = ref.getUTCFullYear();
    const m0 = ref.getUTCMonth() + 1;
    const next = new Date(Date.UTC(y, m0, 1, 12, 0, 0));
    candidate = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), clampDay(next.getUTCFullYear(), next.getUTCMonth()), 12, 0, 0));
  }
  return candidate;
}

/** Divide `total` em `count` parcelas inteiras; o resto de centavos vai para a última. */
export function splitInstallments(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const parts = Array.from({ length: count }, () => base);
  parts[count - 1] += total - base * count;
  return parts;
}

export function buildEntrySchedule(input: {
  mode: EntryMode;
  label: string;
  totalAmount: number;
  installmentsCount: number;
  firstDueDate: Date;
  milestones?: Array<{ label: string; amount: number; dueDate: Date }>;
}): EntryParcel[] {
  if (input.mode === "milestones") {
    return [...(input.milestones ?? [])]
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .map((m) => ({ label: m.label, amount: m.amount, dueDate: m.dueDate }));
  }
  const n = input.installmentsCount;
  const amounts = splitInstallments(input.totalAmount, n);
  return amounts.map((amount, i) => ({
    label: n === 1 ? input.label : `${input.label} ${i + 1}/${n}`,
    amount,
    dueDate: addMonthsClamped(input.firstDueDate, i),
  }));
}

/**
 * Resolve a data do 1º vencimento da mensalidade.
 *  - with_entry:     1ª ocorrência do dia de cobrança em/depois da 1ª parcela da entrada
 *  - after_entry:    1ª ocorrência do dia de cobrança depois da última parcela da entrada
 *  - fixed_date:     a própria data informada
 *  - after_delivery: null (aguarda ser iniciada manualmente)
 */
export function resolveSubscriptionStart(input: {
  startMode: StartMode;
  billingDay: number;
  entry: EntryParcel[] | null;
  fixedDate?: Date | null;
}): Date | null {
  switch (input.startMode) {
    case "with_entry": {
      if (!input.entry?.length) return null;
      return firstOccurrenceOfDay(input.entry[0].dueDate, input.billingDay, true);
    }
    case "after_entry": {
      if (!input.entry?.length) return null;
      return firstOccurrenceOfDay(input.entry[input.entry.length - 1].dueDate, input.billingDay, false);
    }
    case "fixed_date":
      return input.fixedDate ?? null;
    case "after_delivery":
    default:
      return null;
  }
}

/** Valor da mensalidade para um vencimento: soma dos módulos vigentes, ou valor fixo. */
export function subscriptionAmountAt(due: Date, windows: ModulePriceWindow[], fixedAmount: number | null): number {
  if (windows.length === 0) return fixedAmount ?? 0;
  const t = due.getTime();
  return windows
    .filter((w) => w.startDate.getTime() <= t && (w.endDate === null || w.endDate.getTime() >= t))
    .reduce((sum, w) => sum + w.price, 0);
}

/**
 * Vencimentos de mensalidade que ainda precisam ser gerados:
 * a partir de `startDate`, depois de `generatedThrough` ('YYYY-MM'),
 * até `horizonEnd` e respeitando `endDate`.
 */
export function listSubscriptionDueDates(input: {
  startDate: Date;
  endDate: Date | null;
  generatedThrough: string | null;
  horizonEnd: Date;
  maxCount?: number;
}): Array<{ dueDate: Date; referenceMonth: string }> {
  const out: Array<{ dueDate: Date; referenceMonth: string }> = [];
  const max = input.maxCount ?? 120;
  for (let i = 0; i < max; i++) {
    const dueDate = addMonthsClamped(input.startDate, i);
    if (dueDate.getTime() > input.horizonEnd.getTime()) break;
    if (input.endDate && dueDate.getTime() > input.endDate.getTime()) break;
    const key = monthKey(dueDate);
    if (input.generatedThrough && key <= input.generatedThrough) continue;
    out.push({ dueDate, referenceMonth: key });
  }
  return out;
}

/** Fim do mês (UTC) `monthsAhead` meses à frente de `now`. */
export function horizonEndFor(now: Date, monthsAhead: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead + 1, 0, 23, 59, 59));
}
