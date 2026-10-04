import {
  db,
  clientSalesTable,
  saleItemsTable,
  saleModulesTable,
  saasModulesTable,
  clientsTable,
  financialTransactionsTable,
  type SaleItem,
} from "@workspace/db";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  horizonEndFor,
  listSubscriptionDueDates,
  subscriptionAmountAt,
  type EntryParcel,
  type ModulePriceWindow,
} from "./sales-schedule";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const BILLING_HORIZON_MONTHS = 3;

interface SaleContext {
  workspaceId: string;
  saleId: string;
  clientId: string;
  clientName: string;
  projectId: string | null;
}

function formatMonth(referenceMonth: string): string {
  const [y, m] = referenceMonth.split("-");
  return `${m}/${y}`;
}

/** Cria os lançamentos (pendentes) das parcelas de entrada/projeto de uma venda. */
export async function insertEntryTransactions(
  ex: Executor,
  ctx: SaleContext,
  itemId: string,
  parcels: EntryParcel[],
) {
  if (parcels.length === 0) return [];
  const rows = parcels.map((p, i) => ({
    workspaceId: ctx.workspaceId,
    type: "inflow" as const,
    status: "pending" as const,
    description: `${ctx.clientName} — ${p.label}`,
    amount: p.amount,
    dueDate: p.dueDate,
    costType: "fixed_operating",
    clientId: ctx.clientId,
    projectId: ctx.projectId,
    saleId: ctx.saleId,
    saleItemId: itemId,
    revenueType: "one_time",
    isRecurring: false,
    installmentNumber: i + 1,
    installmentsTotal: parcels.length,
    installmentGroupId: itemId,
    approvalStatus: "approved",
  }));
  return ex.insert(financialTransactionsTable).values(rows).returning();
}

async function loadModuleWindows(ex: Executor, itemId: string) {
  const rows = await ex
    .select({
      price: saleModulesTable.price,
      startDate: saleModulesTable.startDate,
      endDate: saleModulesTable.endDate,
      moduleName: saasModulesTable.name,
    })
    .from(saleModulesTable)
    .innerJoin(saasModulesTable, eq(saleModulesTable.moduleId, saasModulesTable.id))
    .where(eq(saleModulesTable.saleItemId, itemId));
  return rows.map((r) => ({
    price: r.price,
    startDate: new Date(r.startDate),
    endDate: r.endDate ? new Date(r.endDate) : null,
    moduleName: r.moduleName,
  }));
}

function activeModuleNames(due: Date, windows: Array<ModulePriceWindow & { moduleName: string }>): string[] {
  const t = due.getTime();
  return windows
    .filter((w) => w.startDate.getTime() <= t && (w.endDate === null || w.endDate.getTime() >= t))
    .map((w) => w.moduleName);
}

/**
 * Geração contínua: cria as mensalidades que faltam até hoje + BILLING_HORIZON_MONTHS.
 * Idempotente — `generatedThrough` impede duplicar meses já gerados.
 */
export async function generateSubscriptionCharges(
  ex: Executor,
  item: SaleItem,
  ctx: SaleContext,
  now: Date = new Date(),
): Promise<number> {
  if (item.kind !== "subscription" || item.status !== "active" || !item.startDate) return 0;

  const dueList = listSubscriptionDueDates({
    startDate: new Date(item.startDate),
    endDate: item.endDate ? new Date(item.endDate) : null,
    generatedThrough: item.generatedThrough,
    horizonEnd: horizonEndFor(now, BILLING_HORIZON_MONTHS),
  });
  if (dueList.length === 0) return 0;

  const windows = await loadModuleWindows(ex, item.id);

  const rows = dueList
    .map(({ dueDate, referenceMonth }) => {
      const amount = subscriptionAmountAt(dueDate, windows, item.fixedAmount);
      const names = activeModuleNames(dueDate, windows);
      return { dueDate, referenceMonth, amount, names };
    })
    .filter((r) => r.amount > 0)
    .map((r) => ({
      workspaceId: ctx.workspaceId,
      type: "inflow" as const,
      status: "pending" as const,
      description: `${ctx.clientName} — ${item.label} ${formatMonth(r.referenceMonth)}${r.names.length ? ` (${r.names.join(", ")})` : ""}`,
      amount: r.amount,
      dueDate: r.dueDate,
      costType: "fixed_operating",
      clientId: ctx.clientId,
      projectId: ctx.projectId,
      saleId: ctx.saleId,
      saleItemId: item.id,
      revenueType: "recurring",
      referenceMonth: r.referenceMonth,
      isRecurring: true,
      recurringInterval: "monthly",
      approvalStatus: "approved",
    }));

  if (rows.length > 0) {
    await ex.insert(financialTransactionsTable).values(rows);
  }

  await ex
    .update(saleItemsTable)
    .set({ generatedThrough: dueList[dueList.length - 1].referenceMonth, updatedAt: new Date() })
    .where(eq(saleItemsTable.id, item.id));

  return rows.length;
}

/** Recalcula o valor das mensalidades ainda pendentes a partir de uma data (troca de módulos). */
export async function recalcPendingCharges(ex: Executor, item: SaleItem, fromDate: Date): Promise<number> {
  const windows = await loadModuleWindows(ex, item.id);
  const pending = await ex
    .select()
    .from(financialTransactionsTable)
    .where(
      and(
        eq(financialTransactionsTable.saleItemId, item.id),
        eq(financialTransactionsTable.status, "pending"),
        eq(financialTransactionsTable.revenueType, "recurring"),
        gte(financialTransactionsTable.dueDate, fromDate),
      ),
    );

  let updated = 0;
  for (const tx of pending) {
    const due = new Date(tx.dueDate);
    const amount = subscriptionAmountAt(due, windows, item.fixedAmount);
    if (amount > 0 && amount !== tx.amount) {
      await ex
        .update(financialTransactionsTable)
        .set({ amount, updatedAt: new Date() })
        .where(eq(financialTransactionsTable.id, tx.id));
      updated++;
    }
  }
  return updated;
}

/** Varre todas as mensalidades ativas e gera o que falta. Usado pelo agendador diário. */
export async function syncAllSubscriptions(workspaceId?: string): Promise<number> {
  const conditions = [
    eq(saleItemsTable.kind, "subscription"),
    eq(saleItemsTable.status, "active"),
    isNotNull(saleItemsTable.startDate),
    eq(clientSalesTable.status, "active"),
    eq(clientsTable.status, "active"),
  ];
  if (workspaceId) conditions.push(eq(saleItemsTable.workspaceId, workspaceId));

  const rows = await db
    .select({
      item: saleItemsTable,
      saleId: clientSalesTable.id,
      projectId: clientSalesTable.projectId,
      clientId: clientsTable.id,
      clientName: clientsTable.name,
    })
    .from(saleItemsTable)
    .innerJoin(clientSalesTable, eq(saleItemsTable.saleId, clientSalesTable.id))
    .innerJoin(clientsTable, eq(clientSalesTable.clientId, clientsTable.id))
    .where(and(...conditions));

  let total = 0;
  for (const r of rows) {
    try {
      total += await db.transaction((tx) =>
        generateSubscriptionCharges(tx, r.item, {
          workspaceId: r.item.workspaceId,
          saleId: r.saleId,
          clientId: r.clientId,
          clientName: r.clientName,
          projectId: r.projectId,
        }),
      );
    } catch (err) {
      logger.error({ err, itemId: r.item.id }, "Falha ao gerar mensalidades");
    }
  }
  return total;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Gera mensalidades pendentes ao subir o servidor e a cada 6 horas. */
export function startSalesBillingScheduler() {
  if (timer) return;
  const run = () =>
    void syncAllSubscriptions()
      .then((n) => n > 0 && logger.info({ created: n }, "Mensalidades geradas automaticamente"))
      .catch((err) => logger.error({ err }, "Agendador de mensalidades falhou"));
  setTimeout(run, 15_000);
  timer = setInterval(run, 6 * 60 * 60 * 1000);
  timer.unref?.();
}

export function stopSalesBillingScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
