import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  financialTransactionsTable,
  financialCategoriesTable,
  clientsTable,
  clientContractsTable,
  workspaceMembersTable,
  projectsTable,
  usersTable,
  financialAccountsTable,
  financialApprovalRulesTable,
  financialBudgetsTable,
  financialAuditLogsTable,
  financialSettingsTable,
  whatsappMessagesTable,
  clientSalesTable,
  saleItemsTable,
  saleModulesTable,
  teamCommissionsTable,
  tasksTable,
} from "@workspace/db";
import { eq, and, or, lt, desc, sql, inArray, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { enqueuePaymentReceipt, enqueueWithdrawalAlert } from "../services/whatsapp-automation";
import { normalizeWhatsAppPhone } from "../services/whatsapp-session";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getWorkspaceId(req: Request): Promise<string | null> {
  const userId = (req as AuthenticatedRequest).user?.userId;
  if (!userId) return null;
  const requestedWsId = req.headers["x-workspace-id"] as string | undefined;
  if (requestedWsId) {
    const [member] = await db
      .select({ workspaceId: workspaceMembersTable.workspaceId })
      .from(workspaceMembersTable)
      .where(and(eq(workspaceMembersTable.userId, userId), eq(workspaceMembersTable.workspaceId, requestedWsId)))
      .limit(1);
    if (member) return member.workspaceId;
  }
  const [member] = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId))
    .limit(1);
  return member?.workspaceId ?? null;
}

async function getUserInfo(req: Request, wsId?: string | null): Promise<{ userId: string; role: string } | null> {
  const userId = (req as AuthenticatedRequest).user?.userId;
  if (!userId) return null;
  if (wsId) {
    const [member] = await db
      .select({ role: workspaceMembersTable.role })
      .from(workspaceMembersTable)
      .where(and(eq(workspaceMembersTable.userId, userId), eq(workspaceMembersTable.workspaceId, wsId)))
      .limit(1);
    if (member) return { userId, role: member.role };
  }
  const [member] = await db
    .select({ role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId))
    .limit(1);
  return { userId, role: member?.role ?? "member" };
}

function computeStatus(tx: { status: string; dueDate: Date }): string {
  if (tx.status !== "pending") return tx.status;
  if (new Date(tx.dueDate) < new Date()) return "overdue";
  return "pending";
}

function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date);
  const dayOfMonth = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDayOfMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth));
  return result;
}

async function updateAccountBalance(tx: any, accountId: string, deltaCents: number) {
  if (!accountId || deltaCents === 0) return;
  await tx
    .update(financialAccountsTable)
    .set({
      currentBalance: sql`${financialAccountsTable.currentBalance} + ${deltaCents}`,
      updatedAt: new Date(),
    })
    .where(eq(financialAccountsTable.id, accountId));
}

async function logAudit(
  tx: any,
  workspaceId: string,
  transactionId: string | null,
  userId: string | null,
  action: string,
  details: any
) {
  try {
    await tx.insert(financialAuditLogsTable).values({
      workspaceId,
      transactionId,
      userId,
      action,
      details: typeof details === "string" ? details : JSON.stringify(details),
    });
  } catch (err) {
    console.error("Failed to log audit in transaction:", err);
    throw err; // Ensure audit failures fail the transaction to guarantee auditability
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

router.get("/dashboard", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const now = new Date();
    const reqMonth = req.query.month ? parseInt(req.query.month as string) - 1 : now.getMonth();
    const reqYear = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();

    const startOfMonth = new Date(reqYear, reqMonth, 1);
    const endOfMonth = new Date(reqYear, reqMonth + 1, 0, 23, 59, 59);

    const [transactions, accounts, categories, settingsList, budgets, users, clients, projects] = await Promise.all([
      db.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.workspaceId, workspaceId)),
      db.select().from(financialAccountsTable).where(and(eq(financialAccountsTable.workspaceId, workspaceId), eq(financialAccountsTable.isActive, true))),
      db.select().from(financialCategoriesTable).where(eq(financialCategoriesTable.workspaceId, workspaceId)),
      db.select().from(financialSettingsTable).where(eq(financialSettingsTable.workspaceId, workspaceId)).limit(1),
      db.select().from(financialBudgetsTable).where(and(eq(financialBudgetsTable.workspaceId, workspaceId), eq(financialBudgetsTable.year, reqYear), eq(financialBudgetsTable.month, reqMonth + 1))),
      db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email }).from(usersTable),
      db.select().from(clientsTable).where(eq(clientsTable.workspaceId, workspaceId)),
      db.select().from(projectsTable).where(eq(projectsTable.workspaceId, workspaceId)),
    ]);

    const settings = settingsList[0] ?? { taxRatePercent: 600, emergencyReserveTarget: 5000000 };

    // ── Current/selected month stats
    const monthTxs = transactions.filter(tx => {
      const d = new Date(tx.dueDate);
      return d >= startOfMonth && d <= endOfMonth;
    });

    const monthInflow = monthTxs.filter(t => t.type === "inflow" && t.status === "paid").reduce((s, t) => s + t.amount, 0);
    const monthInflowPending = monthTxs.filter(t => t.type === "inflow" && t.status === "pending").reduce((s, t) => s + t.amount, 0);
    const monthOutflow = monthTxs.filter(t => t.type === "outflow" && t.status === "paid").reduce((s, t) => s + t.amount, 0);
    const monthOutflowPending = monthTxs.filter(t => t.type === "outflow" && t.status === "pending").reduce((s, t) => s + t.amount, 0);
    const monthBalance = monthInflow - monthOutflow;

    // ── MRR: Sum of contracted recurring inflow due this month (not cancelled)
    const mrr = monthTxs.filter(t => t.type === "inflow" && t.isRecurring && t.status !== "cancelled").reduce((s, t) => s + t.amount, 0);

    // ── Receita pontual (projetos/entradas) prevista no mês e receita contratada para meses futuros
    const oneTimeContracted = monthTxs
      .filter(t => t.type === "inflow" && t.revenueType === "one_time" && t.status !== "cancelled")
      .reduce((s, t) => s + t.amount, 0);
    const contractedReceivable = transactions
      .filter(t => t.type === "inflow" && t.saleId && t.status === "pending" && new Date(t.dueDate) > endOfMonth)
      .reduce((s, t) => s + t.amount, 0);

    // ── Fluxo de Caixa Realizado no Mês (agrupado por paidAt com fallback para dueDate)
    const cashRealizedInflow = transactions.filter(t => {
      if (t.type !== "inflow" || t.status !== "paid") return false;
      const d = new Date(t.paidAt ?? t.dueDate);
      return d >= startOfMonth && d <= endOfMonth;
    }).reduce((s, t) => s + t.amount, 0);

    const cashRealizedOutflow = transactions.filter(t => {
      if (t.type !== "outflow" || t.status !== "paid") return false;
      const d = new Date(t.paidAt ?? t.dueDate);
      return d >= startOfMonth && d <= endOfMonth;
    }).reduce((s, t) => s + t.amount, 0);

    const cashRealizedBalance = cashRealizedInflow - cashRealizedOutflow;

    // ── Overdue: pending transactions with dueDate < now
    const overdueAmount = transactions
      .filter(t => t.status === "pending" && new Date(t.dueDate) < now)
      .reduce((s, t) => s + t.amount, 0);
    const overdueCount = transactions.filter(t => t.status === "pending" && new Date(t.dueDate) < now).length;

    // ── Total Cash in Bank Accounts
    const totalCash = accounts.reduce((acc, a) => acc + a.currentBalance, 0);

    // ── Emergency Reserve
    const isBelowReserve = totalCash < settings.emergencyReserveTarget;

    // ── Tax Provision for the month
    const taxProvision = Math.round((monthInflow * settings.taxRatePercent) / 10000);

    // ── Burn Rate & Runway Calculation (based on last 3 months paid outflows)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const pastOutflows = transactions.filter(t => t.type === "outflow" && t.status === "paid" && new Date(t.paidAt ?? t.dueDate) >= threeMonthsAgo);
    const pastTotalOutflow = pastOutflows.reduce((s, t) => s + t.amount, 0);
    const burnRate = Math.round(pastTotalOutflow / 3) || monthOutflow || 0;
    const runwayMonths = burnRate > 0 ? Number((totalCash / burnRate).toFixed(1)) : null;

    // ── Pending Approvals Count & List
    const pendingApprovals = transactions.filter(t => t.approvalStatus === "pending_approval");
    const pendingApprovalsCount = pendingApprovals.length;
    const pendingApprovalsList = pendingApprovals
      .map(t => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
        dueDate: t.dueDate,
        costType: t.costType,
        partnerId: t.partnerId,
        partnerName: users.find(u => u.id === t.partnerId)?.name ?? null,
      }))
      .slice(0, 5);

    // ── Overdue Inflows (customers to charge)
    const overdueInflowsList = transactions
      .filter(t => t.type === "inflow" && t.status === "pending" && new Date(t.dueDate) < now)
      .map(t => {
        const client = clients.find(c => c.id === t.clientId);
        return {
          id: t.id,
          description: t.description,
          amount: t.amount,
          dueDate: t.dueDate,
          clientId: t.clientId,
          clientName: client?.name ?? "Cliente Teltech",
          clientPhone: client?.phone ?? null,
        };
      })
      .slice(0, 5);

    // ── Overdue Outflows (bills overdue)
    const overdueOutflowsList = transactions
      .filter(t => t.type === "outflow" && t.status === "pending" && new Date(t.dueDate) < now)
      .map(t => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
        dueDate: t.dueDate,
        costType: t.costType,
      }))
      .slice(0, 5);

    // ── Today Due Outflows
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const todayDueOutflowsList = transactions
      .filter(t => t.type === "outflow" && t.status === "pending" && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd)
      .map(t => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
        dueDate: t.dueDate,
      }))
      .slice(0, 5);

    // ── Category Distribution (Outflow for the selected month)
    const categoryMap = new Map(categories.map(c => [c.id, { name: c.name, color: c.color, total: 0 }]));
    let uncategorizedOutflow = 0;
    for (const tx of monthTxs.filter(t => t.type === "outflow" && t.status === "paid")) {
      if (tx.categoryId && categoryMap.has(tx.categoryId)) {
        categoryMap.get(tx.categoryId)!.total += tx.amount;
      } else {
        uncategorizedOutflow += tx.amount;
      }
    }
    const categoryDistribution: Array<{ name: string; color: string; amount: number; percentage: number }> = [];
    categoryMap.forEach((v) => {
      if (v.total > 0) {
        categoryDistribution.push({
          name: v.name,
          color: v.color,
          amount: v.total,
          percentage: monthOutflow > 0 ? Math.round((v.total / monthOutflow) * 100) : 0,
        });
      }
    });
    if (uncategorizedOutflow > 0) {
      categoryDistribution.push({
        name: "Outros / Sem categoria",
        color: "#6B7280",
        amount: uncategorizedOutflow,
        percentage: monthOutflow > 0 ? Math.round((uncategorizedOutflow / monthOutflow) * 100) : 0,
      });
    }

    // ── Department Budgets Progress (Strictly protected against NaN)
    const budgetProgress = budgets.map(b => {
      const spent = monthTxs
        .filter(t => t.type === "outflow" && t.status === "paid" && (b.categoryId ? t.categoryId === b.categoryId : true))
        .reduce((s, t) => s + t.amount, 0);
      const amount = b.amount || 0;
      const percentage = amount > 0 ? Math.min(Math.round((spent / amount) * 100), 200) : 0;
      return {
        id: b.id,
        department: b.department || "Geral",
        amount,
        spent,
        percentage: isNaN(percentage) ? 0 : percentage,
      };
    });

    // ── Last 6 months chart data
    const chartData: Array<{ month: string; inflow: number; outflow: number; balance: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const label = d.toLocaleString("pt-BR", { month: "short", year: "2-digit" });

      const sliceTxs = transactions.filter(tx => {
        const td = new Date(tx.dueDate);
        return td >= start && td <= end;
      });

      const inf = sliceTxs.filter(t => t.type === "inflow" && t.status === "paid").reduce((s, t) => s + t.amount, 0);
      const out = sliceTxs.filter(t => t.type === "outflow" && t.status === "paid").reduce((s, t) => s + t.amount, 0);
      chartData.push({ month: label, inflow: inf, outflow: out, balance: inf - out });
    }

    // ── Next 5 upcoming inflow transactions (pending, not overdue)
    const upcoming = transactions
      .filter(t => t.type === "inflow" && t.status === "pending" && new Date(t.dueDate) >= now)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);

    // ── Relatório Macro: Faturamento por Produto & Mês ─────────────────────
    interface MacroMonthItem {
      key: string;       // "YYYY-MM"
      label: string;     // "mai/26"
      shortLabel: string;// "Mai"
      year: number;
      month: number;
      isCurrent: boolean;
      isPast: boolean;
      isFuture: boolean;
    }

    interface MacroAmountItem {
      paid: number;
      pending: number;
      total: number;
      recurring: number;
      oneTime: number;
      txCount: number;
    }

    const macroMonths: MacroMonthItem[] = [];
    const macroMonthKeysSet = new Set<string>();

    for (let offset = -5; offset <= 6; offset++) {
      const d = new Date(reqYear, reqMonth + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      macroMonthKeysSet.add(key);

      const isCurrentMonth = y === now.getFullYear() && d.getMonth() === now.getMonth();
      const isPastMonth = d < new Date(now.getFullYear(), now.getMonth(), 1);
      const isFutureMonth = d > new Date(now.getFullYear(), now.getMonth(), 1);

      macroMonths.push({
        key,
        label: d.toLocaleString("pt-BR", { month: "short", year: "2-digit" }),
        shortLabel: d.toLocaleString("pt-BR", { month: "short" }),
        year: y,
        month: m,
        isCurrent: isCurrentMonth,
        isPast: isPastMonth,
        isFuture: isFutureMonth,
      });
    }

    const createEmptyAmount = (): MacroAmountItem => ({
      paid: 0,
      pending: 0,
      total: 0,
      recurring: 0,
      oneTime: 0,
      txCount: 0,
    });

    const clientMap = new Map(clients.map(c => [c.id, c]));

    const productRowsMap = new Map<string, {
      productId: string;
      productName: string;
      productColor: string;
      productIcon: string | null;
      status: string;
      activeClientsCount: number;
      months: Record<string, MacroAmountItem>;
      totalPeriod: MacroAmountItem;
      averageMonthly: number;
      sharePercent: number;
    }>();

    for (const p of projects) {
      const activeClients = clients.filter(c => c.projectId === p.id && c.status === "active").length;
      const monthsRecord: Record<string, MacroAmountItem> = {};
      for (const m of macroMonths) {
        monthsRecord[m.key] = createEmptyAmount();
      }
      productRowsMap.set(p.id, {
        productId: p.id,
        productName: p.name,
        productColor: p.color || "#8B5CF6",
        productIcon: p.icon ?? null,
        status: p.status || "active",
        activeClientsCount: activeClients,
        months: monthsRecord,
        totalPeriod: createEmptyAmount(),
        averageMonthly: 0,
        sharePercent: 0,
      });
    }

    // Unallocated / Serviços Avulsos / Geral
    const unallocatedActiveClients = clients.filter(c => !c.projectId && c.status === "active").length;
    const unallocatedMonthsRecord: Record<string, MacroAmountItem> = {};
    for (const m of macroMonths) {
      unallocatedMonthsRecord[m.key] = createEmptyAmount();
    }
    productRowsMap.set("unallocated", {
      productId: "unallocated",
      productName: "Serviços Avulsos / Geral",
      productColor: "#71717A",
      productIcon: "Layers",
      status: "active",
      activeClientsCount: unallocatedActiveClients,
      months: unallocatedMonthsRecord,
      totalPeriod: createEmptyAmount(),
      averageMonthly: 0,
      sharePercent: 0,
    });

    const totalsByMonth: Record<string, MacroAmountItem> = {};
    for (const m of macroMonths) {
      totalsByMonth[m.key] = createEmptyAmount();
    }
    const macroGrandTotal = createEmptyAmount();

    for (const tx of transactions) {
      if (tx.type !== "inflow" || tx.status === "cancelled") continue;

      const txDate = new Date(tx.dueDate);
      const txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
      if (!macroMonthKeysSet.has(txMonthKey)) continue;

      let targetId = tx.projectId;
      if (!targetId && tx.clientId) {
        targetId = clientMap.get(tx.clientId)?.projectId ?? null;
      }
      if (!targetId || !productRowsMap.has(targetId)) {
        targetId = "unallocated";
      }

      const prod = productRowsMap.get(targetId)!;
      const amt = tx.amount || 0;
      const isPaid = tx.status === "paid";
      const isPending = tx.status === "pending";
      const isRec = tx.revenueType === "recurring" || (tx.isRecurring && tx.revenueType !== "one_time");

      // Acumula no produto no mês
      const prodMonth = prod.months[txMonthKey];
      if (isPaid) prodMonth.paid += amt;
      if (isPending) prodMonth.pending += amt;
      prodMonth.total += amt;
      if (isRec) prodMonth.recurring += amt;
      else prodMonth.oneTime += amt;
      prodMonth.txCount += 1;

      // Acumula no total do período do produto
      if (isPaid) prod.totalPeriod.paid += amt;
      if (isPending) prod.totalPeriod.pending += amt;
      prod.totalPeriod.total += amt;
      if (isRec) prod.totalPeriod.recurring += amt;
      else prod.totalPeriod.oneTime += amt;
      prod.totalPeriod.txCount += 1;

      // Acumula nos totais do mês da Teltech
      const monthTot = totalsByMonth[txMonthKey];
      if (isPaid) monthTot.paid += amt;
      if (isPending) monthTot.pending += amt;
      monthTot.total += amt;
      if (isRec) monthTot.recurring += amt;
      else monthTot.oneTime += amt;
      monthTot.txCount += 1;

      // Acumula no Total Geral
      if (isPaid) macroGrandTotal.paid += amt;
      if (isPending) macroGrandTotal.pending += amt;
      macroGrandTotal.total += amt;
      if (isRec) macroGrandTotal.recurring += amt;
      else macroGrandTotal.oneTime += amt;
      macroGrandTotal.txCount += 1;
    }

    const productRows = Array.from(productRowsMap.values());
    for (const p of productRows) {
      p.averageMonthly = macroMonths.length > 0 ? Math.round(p.totalPeriod.total / macroMonths.length) : 0;
      p.sharePercent = macroGrandTotal.total > 0 ? Math.round((p.totalPeriod.total / macroGrandTotal.total) * 100) : 0;
    }

    const finalProducts = productRows.filter(p => {
      if (p.productId === "unallocated" && p.totalPeriod.total === 0 && p.activeClientsCount === 0) {
        return false;
      }
      return true;
    });

    finalProducts.sort((a, b) => {
      if (b.totalPeriod.total !== a.totalPeriod.total) {
        return b.totalPeriod.total - a.totalPeriod.total;
      }
      return a.productName.localeCompare(b.productName);
    });

    const productMacroReport = {
      months: macroMonths,
      products: finalProducts,
      totalsByMonth,
      grandTotal: macroGrandTotal,
    };

    res.json({
      dashboard: {
        mrr,
        oneTimeContracted,
        contractedReceivable,
        monthInflow, monthInflowPending,
        monthOutflow, monthOutflowPending,
        monthBalance,
        cashRealizedInflow, cashRealizedOutflow, cashRealizedBalance,
        overdueAmount, overdueCount,
        totalCash,
        emergencyReserveTarget: settings.emergencyReserveTarget,
        isBelowReserve,
        taxProvision,
        taxRatePercent: settings.taxRatePercent,
        burnRate,
        runwayMonths,
        pendingApprovalsCount,
        pendingApprovalsList,
        overdueInflowsList,
        overdueOutflowsList,
        todayDueOutflowsList,
        categoryDistribution,
        budgetProgress,
        chartData,
        upcoming,
        productMacroReport,
        selectedMonth: reqMonth + 1,
        selectedYear: reqYear,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BANK ACCOUNTS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/accounts", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const accounts = await db
      .select()
      .from(financialAccountsTable)
      .where(and(eq(financialAccountsTable.workspaceId, workspaceId), eq(financialAccountsTable.isActive, true)))
      .orderBy(financialAccountsTable.name);

    res.json({ accounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/accounts", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const { name, type, color, initialBalance } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }

    const bal = initialBalance ?? 0;
    const [account] = await db
      .insert(financialAccountsTable)
      .values({
        workspaceId,
        name,
        type: type ?? "checking",
        color: color ?? "#7C5AC2",
        initialBalance: bal,
        currentBalance: bal,
      })
      .returning();

    res.status(201).json({ account });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/accounts/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const id = req.params.id as string;

    const { name, type, color } = req.body;
    const [account] = await db
      .update(financialAccountsTable)
      .set({
        ...(name ? { name } : {}),
        ...(type ? { type } : {}),
        ...(color ? { color } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(financialAccountsTable.id, id), eq(financialAccountsTable.workspaceId, workspaceId)))
      .returning();

    if (!account) { res.status(404).json({ error: "Account not found" }); return; }
    res.json({ account });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/accounts/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const id = req.params.id as string;

    // Governança Contábil: verificar se existem lançamentos vinculados
    const [txCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(financialTransactionsTable)
      .where(eq(financialTransactionsTable.accountId, id));

    if (txCount && txCount.count > 0) {
      // Se possui lançamentos, NUNCA exclui fisicamente para manter o histórico e a auditoria
      await db
        .update(financialAccountsTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(financialAccountsTable.id, id), eq(financialAccountsTable.workspaceId, workspaceId)));
      res.json({ success: true, archived: true, message: "Conta bancária desativada (histórico contábil preservado)." });
    } else {
      // Se não possui nenhum lançamento (conta de teste ou criada por engano), remoção limpa
      await db
        .delete(financialAccountsTable)
        .where(and(eq(financialAccountsTable.id, id), eq(financialAccountsTable.workspaceId, workspaceId)));
      res.json({ success: true, archived: false, message: "Conta removida com sucesso." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

router.get("/categories", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const categories = await db
      .select()
      .from(financialCategoriesTable)
      .where(eq(financialCategoriesTable.workspaceId, workspaceId))
      .orderBy(financialCategoriesTable.name);

    res.json({ categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/categories", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const { name, color, type } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }

    const [category] = await db
      .insert(financialCategoriesTable)
      .values({ workspaceId, name, color: color ?? "#7C5AC2", type: type ?? "both" })
      .returning();

    res.status(201).json({ category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/categories/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const id = req.params.id as string;

    await db
      .delete(financialCategoriesTable)
      .where(and(eq(financialCategoriesTable.id, id), eq(financialCategoriesTable.workspaceId, workspaceId), eq(financialCategoriesTable.isDefault, false)));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/clients", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const rows = await db
      .select({
        client: clientsTable,
        projectName: projectsTable.name,
        projectColor: projectsTable.color,
      })
      .from(clientsTable)
      .leftJoin(projectsTable, eq(clientsTable.projectId, projectsTable.id))
      .where(eq(clientsTable.workspaceId, workspaceId))
      .orderBy(clientsTable.name);

    const clients = rows.map(r => ({
      ...r.client,
      projectName: r.projectName ?? undefined,
      projectColor: r.projectColor ?? undefined,
    }));

    res.json({ clients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const { name, document, email, phone, notes, whatsappOptIn, projectId } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    if (whatsappOptIn !== undefined && typeof whatsappOptIn !== "boolean") {
      res.status(400).json({ error: "whatsappOptIn must be a boolean" }); return;
    }

    const [client] = await db
      .insert(clientsTable)
      .values({
        workspaceId, name, document, email, phone, notes,
        whatsappOptIn: whatsappOptIn === true,
        whatsappOptInAt: whatsappOptIn === true ? new Date() : null,
        projectId: projectId || null,
      })
      .returning();

    res.status(201).json({ client });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/clients/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const id = req.params.id as string;

    const { name, document, email, phone, notes, status, whatsappOptIn, projectId } = req.body;
    if (whatsappOptIn !== undefined && typeof whatsappOptIn !== "boolean") {
      res.status(400).json({ error: "whatsappOptIn must be a boolean" }); return;
    }
    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      res.status(400).json({ error: "phone must be a string or null" }); return;
    }
    const [existing] = await db.select({ phone: clientsTable.phone })
      .from(clientsTable)
      .where(and(eq(clientsTable.id, id), eq(clientsTable.workspaceId, workspaceId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Client not found" }); return; }

    const phoneChanged = phone !== undefined
      && normalizeWhatsAppPhone(phone) !== normalizeWhatsAppPhone(existing.phone);
    const optInUpdate = phoneChanged
      ? { whatsappOptIn: false, whatsappOptInAt: null }
      : whatsappOptIn === undefined ? {} : {
        whatsappOptIn,
        whatsappOptInAt: whatsappOptIn ? sql`coalesce(${clientsTable.whatsappOptInAt}, now())` : null,
      };
    const [client] = await db
      .update(clientsTable)
      .set({
        name, document, email, phone, notes, status,
        projectId: projectId ?? undefined,
        ...optInUpdate,
        updatedAt: new Date(),
      })
      .where(and(eq(clientsTable.id, id), eq(clientsTable.workspaceId, workspaceId)))
      .returning();

    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    res.json({ client });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/clients/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const id = req.params.id as string;

    const [client] = await db
      .select({ id: clientsTable.id, name: clientsTable.name })
      .from(clientsTable)
      .where(and(eq(clientsTable.id, id), eq(clientsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!client) { res.status(404).json({ error: "Cliente não encontrado" }); return; }

    // Verifica se possui transações vinculadas no Livro Caixa
    const [txCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(financialTransactionsTable)
      .where(and(eq(financialTransactionsTable.clientId, id), eq(financialTransactionsTable.workspaceId, workspaceId)));

    const hasTransactions = Boolean(txCount && txCount.count > 0);

    if (hasTransactions) {
      // Governança Contábil: mantém o histórico fiscal, cancela o contrato e inativa o cliente
      await db.transaction(async (tx) => {
        await tx
          .update(clientsTable)
          .set({ status: "inactive", whatsappOptIn: false, whatsappOptInAt: null, updatedAt: new Date() })
          .where(and(eq(clientsTable.id, id), eq(clientsTable.workspaceId, workspaceId)));

        await tx
          .update(clientContractsTable)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(and(eq(clientContractsTable.clientId, id), eq(clientContractsTable.workspaceId, workspaceId)));

        await tx
          .update(whatsappMessagesTable)
          .set({ status: "skipped", lastError: "Contrato cancelado / cliente inativado", updatedAt: new Date() })
          .where(and(
            eq(whatsappMessagesTable.workspaceId, workspaceId),
            eq(whatsappMessagesTable.clientId, id),
            inArray(whatsappMessagesTable.status, ["queued", "retry"])
          ));
      });

      res.json({
        ok: true,
        archived: true,
        message: `Contrato de "${client.name}" cancelado com sucesso. Histórico financeiro preservado e cobranças suspensas.`,
      });
    } else {
      // Cliente sem faturas vinculadas: remoção completa e definitiva
      await db.transaction(async (tx) => {
        await tx
          .delete(clientContractsTable)
          .where(and(eq(clientContractsTable.clientId, id), eq(clientContractsTable.workspaceId, workspaceId)));

        await tx
          .delete(whatsappMessagesTable)
          .where(and(eq(whatsappMessagesTable.clientId, id), eq(whatsappMessagesTable.workspaceId, workspaceId)));

        await tx
          .delete(clientsTable)
          .where(and(eq(clientsTable.id, id), eq(clientsTable.workspaceId, workspaceId)));
      });

      res.json({
        ok: true,
        deleted: true,
        message: `Cliente "${client.name}" excluído definitivamente com sucesso.`,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients/:id/reactivate", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const id = req.params.id as string;

    const [client] = await db
      .select({ id: clientsTable.id, name: clientsTable.name })
      .from(clientsTable)
      .where(and(eq(clientsTable.id, id), eq(clientsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!client) { res.status(404).json({ error: "Cliente não encontrado" }); return; }

    await db.transaction(async (tx) => {
      await tx
        .update(clientsTable)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(clientsTable.id, id), eq(clientsTable.workspaceId, workspaceId)));

      await tx
        .update(clientContractsTable)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(clientContractsTable.clientId, id), eq(clientContractsTable.workspaceId, workspaceId)));
    });

    res.json({
      ok: true,
      message: `Cliente "${client.name}" e contrato reativados com sucesso.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT CONTRACTS — Configuração de faturamento por cliente/produto
// ─────────────────────────────────────────────────────────────────────────────

// GET /finance/projects/:projectId/clients — clientes de um projeto com contrato
router.get("/projects/:projectId/clients", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const projectId = req.params.projectId as string;

    // 1. Busca contratos ativos ou existentes deste projeto
    const contracts = await db
      .select()
      .from(clientContractsTable)
      .where(and(
        eq(clientContractsTable.workspaceId, workspaceId),
        eq(clientContractsTable.projectId, projectId),
      ));

    const contractByClientId = new Map(contracts.map(c => [c.clientId, c]));
    const sales = await db.select({ clientId: clientSalesTable.clientId }).from(clientSalesTable)
      .where(and(eq(clientSalesTable.workspaceId, workspaceId), eq(clientSalesTable.projectId, projectId)));
    const clientIdsWithContract = [...new Set([...contracts.map(c => c.clientId), ...sales.map(s => s.clientId)])];

    // 2. Busca clientes vinculados diretamente via clientsTable.projectId OU via clientContractsTable.projectId
    const whereConditions = [
      eq(clientsTable.workspaceId, workspaceId),
      clientIdsWithContract.length > 0
        ? or(eq(clientsTable.projectId, projectId), inArray(clientsTable.id, clientIdsWithContract))
        : eq(clientsTable.projectId, projectId),
    ];

    const clients = await db
      .select()
      .from(clientsTable)
      .where(and(...whereConditions))
      .orderBy(clientsTable.name);

    // 3. Verifica se os clientes possuem faturas em atraso
    const overdueTransactions = await db
      .select({ clientId: financialTransactionsTable.clientId })
      .from(financialTransactionsTable)
      .where(and(
        eq(financialTransactionsTable.workspaceId, workspaceId),
        eq(financialTransactionsTable.type, "inflow"),
        eq(financialTransactionsTable.status, "pending"),
        lt(financialTransactionsTable.dueDate, new Date())
      ));

    const overdueClientIds = new Set(overdueTransactions.map(t => t.clientId).filter(Boolean));

    const result = clients.map(c => ({
      ...c,
      contract: contractByClientId.get(c.id) ?? null,
      pendingOverdue: overdueClientIds.has(c.id),
    }));

    res.json({ clients: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /finance/clients/:id/contract — contrato vigente de um cliente
router.get("/clients/:id/contract", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const id = req.params.id as string;

    const [contract] = await db
      .select()
      .from(clientContractsTable)
      .where(and(eq(clientContractsTable.clientId, id), eq(clientContractsTable.workspaceId, workspaceId)))
      .orderBy(desc(clientContractsTable.createdAt))
      .limit(1);

    res.json({ contract: contract ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /finance/clients/:id/contract — criar ou atualizar contrato de um cliente
router.put("/clients/:id/contract", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const clientId = req.params.id as string;

    const {
      projectId, monthlyAmount, billingDay, billingCycleMonths,
      contractStartDate, contractEndDate, totalInstallments, notes,
    } = req.body;

    if (!projectId) { res.status(400).json({ error: "projectId is required" }); return; }
    if (monthlyAmount === undefined || monthlyAmount < 0) {
      res.status(400).json({ error: "monthlyAmount must be >= 0" }); return;
    }

    // Verifica se o cliente pertence ao workspace
    const [client] = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.workspaceId, workspaceId)))
      .limit(1);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }

    // Upsert: busca contrato existente para aquele cliente/projeto
    const [existing] = await db
      .select({ id: clientContractsTable.id })
      .from(clientContractsTable)
      .where(and(
        eq(clientContractsTable.clientId, clientId),
        eq(clientContractsTable.projectId, projectId),
        eq(clientContractsTable.workspaceId, workspaceId),
      ))
      .limit(1);

    let contract;
    const payload = {
      monthlyAmount: Math.round(monthlyAmount),
      billingDay: billingDay ?? 1,
      billingCycleMonths: billingCycleMonths ?? 1,
      contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
      contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
      totalInstallments: totalInstallments ?? null,
      notes: notes ?? null,
      status: "active" as const,
      updatedAt: new Date(),
    };

    if (existing) {
      [contract] = await db
        .update(clientContractsTable)
        .set(payload)
        .where(eq(clientContractsTable.id, existing.id))
        .returning();
    } else {
      [contract] = await db
        .insert(clientContractsTable)
        .values({ workspaceId, clientId, projectId, ...payload })
        .returning();
    }

    // Garante que o cliente está vinculado ao projeto
    await db
      .update(clientsTable)
      .set({ projectId, updatedAt: new Date() })
      .where(eq(clientsTable.id, clientId));

    res.json({ contract });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /finance/clients/:id/contract/generate-installments — gera parcelas/faturas automáticas
router.post("/clients/:id/contract/generate-installments", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const clientId = req.params.id as string;
    const { months = 3 } = req.body; // quantos meses gerar, default 3

    // Busca contrato ativo
    const [contract] = await db
      .select()
      .from(clientContractsTable)
      .where(and(
        eq(clientContractsTable.clientId, clientId),
        eq(clientContractsTable.workspaceId, workspaceId),
        eq(clientContractsTable.status, "active"),
      ))
      .limit(1);

    if (!contract) { res.status(404).json({ error: "No active contract found for this client" }); return; }

    const [clientData] = await db
      .select({ name: clientsTable.name })
      .from(clientsTable)
      .where(eq(clientsTable.id, clientId))
      .limit(1);

    const created: any[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const dueDate = new Date(now.getFullYear(), now.getMonth() + i, contract.billingDay);
      // Ajusta para dia válido no mês
      while (dueDate.getDate() !== contract.billingDay) {
        dueDate.setDate(dueDate.getDate() - 1);
      }

      const description = `${clientData?.name ?? "Cliente"} — Mensalidade ${String(dueDate.getMonth() + 1).padStart(2, "0")}/${dueDate.getFullYear()}`;

      const [tx] = await db
        .insert(financialTransactionsTable)
        .values({
          workspaceId,
          type: "inflow",
          status: "pending",
          description,
          amount: contract.monthlyAmount,
          dueDate,
          costType: "fixed_operating",
          clientId,
          projectId: contract.projectId,
          isRecurring: contract.totalInstallments === null,
          recurringInterval: contract.totalInstallments === null ? "monthly" : null,
          installmentNumber: contract.totalInstallments ? (contract.installmentsPaid + i + 1) : null,
          installmentsTotal: contract.totalInstallments ?? null,
          approvalStatus: "approved",
        })
        .returning();

      created.push(tx);
    }

    res.json({ created, count: created.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/transactions", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const transactions = await db
      .select({
        transaction: financialTransactionsTable,
        categoryName: financialCategoriesTable.name,
        categoryColor: financialCategoriesTable.color,
        clientName: clientsTable.name,
        projectName: projectsTable.name,
        projectColor: projectsTable.color,
        accountName: financialAccountsTable.name,
        accountColor: financialAccountsTable.color,
        partnerName: usersTable.name,
      })
      .from(financialTransactionsTable)
      .leftJoin(financialCategoriesTable, eq(financialTransactionsTable.categoryId, financialCategoriesTable.id))
      .leftJoin(clientsTable, eq(financialTransactionsTable.clientId, clientsTable.id))
      .leftJoin(projectsTable, eq(financialTransactionsTable.projectId, projectsTable.id))
      .leftJoin(financialAccountsTable, eq(financialTransactionsTable.accountId, financialAccountsTable.id))
      .leftJoin(usersTable, eq(financialTransactionsTable.partnerId, usersTable.id))
      .where(eq(financialTransactionsTable.workspaceId, workspaceId))
      .orderBy(desc(financialTransactionsTable.dueDate));

    const enriched = transactions.map(row => ({
      ...row.transaction,
      computedStatus: computeStatus(row.transaction),
      categoryName: row.categoryName,
      categoryColor: row.categoryColor,
      clientName: row.clientName,
      projectName: row.projectName,
      projectColor: row.projectColor,
      accountName: row.accountName,
      accountColor: row.accountColor,
      partnerName: row.partnerName,
    }));

    res.json({ transactions: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/transactions", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const userInfo = await getUserInfo(req, workspaceId);

    const {
      type, description, amount, dueDate,
      categoryId, clientId, projectId, accountId, partnerId,
      costType, notes, status, paymentMethod, paidAt, receiptUrl,
      isReimbursement, isRecurring, recurringInterval,
      installmentsTotal, isInstallmentBatch, installmentMode,
      pauseBilling,
    } = req.body;

    if (!type || !description || !amount || !dueDate) {
      res.status(400).json({ error: "type, description, amount, dueDate are required" });
      return;
    }

    const [rule] = await db
      .select()
      .from(financialApprovalRulesTable)
      .where(eq(financialApprovalRulesTable.workspaceId, workspaceId))
      .limit(1);

    const maxAuto = rule?.maxAutoApprovalAmount ?? 50000;
    const isExec = userInfo?.role === "ceo" || userInfo?.role === "cto" || userInfo?.role === "owner" || userInfo?.role === "admin";

    // ── CASE 1: Batch Installment Generation (ACID Transaction)
    if (isInstallmentBatch && installmentsTotal && Number(installmentsTotal) > 1) {
      const n = parseInt(installmentsTotal);
      const groupId = randomUUID();
      const baseDueDate = new Date(dueDate);

      const isPerInstallment = installmentMode === "per_installment";
      const perInstallment = isPerInstallment ? amount : Math.floor(amount / n);
      const remainder = isPerInstallment ? 0 : amount - perInstallment * n;

      const createdList = await db.transaction(async (tx) => {
        const list = [];
        for (let i = 1; i <= n; i++) {
          const instDueDate = addMonthsClamped(baseDueDate, i - 1);

          const instAmount = i === n ? perInstallment + remainder : perInstallment;
          const requiresApproval = type === "outflow" && instAmount > maxAuto && !isExec;
          const approvalStatus = requiresApproval ? "pending_approval" : "approved";
          const isFirstPaid = i === 1 && status === "paid" && !requiresApproval;

          const [txRecord] = await tx
            .insert(financialTransactionsTable)
            .values({
              workspaceId,
              type,
              description: `${description} (${i}/${n})`,
              amount: instAmount,
              dueDate: instDueDate,
              categoryId: categoryId || null,
              clientId: clientId || null,
              projectId: projectId || null,
              accountId: accountId || null,
              partnerId: partnerId || null,
              costType: costType || "fixed_operating",
              notes: notes || null,
              status: isFirstPaid ? "paid" : "pending",
              paymentMethod: paymentMethod || null,
              paidAt: isFirstPaid && paidAt ? new Date(paidAt) : isFirstPaid ? new Date() : null,
              receiptUrl: receiptUrl || null,
              approvalStatus,
              isReimbursement: isReimbursement ?? false,
              reimbursementStatus: isReimbursement ? "pending" : null,
              isRecurring: false,
              installmentNumber: i,
              installmentsTotal: n,
              installmentGroupId: groupId,
              pauseBilling: pauseBilling === true,
            })
            .returning();

          list.push(txRecord);

          if (isFirstPaid && accountId) {
            const delta = type === "inflow" ? instAmount : -instAmount;
            await updateAccountBalance(tx, accountId, delta);
          }

          await logAudit(tx, workspaceId, txRecord.id, userInfo?.userId ?? null, "created", { batch: true, installment: i, total: n });
          if (txRecord.type === "outflow" && txRecord.costType === "partner_withdrawal" && txRecord.status === "paid") {
            await enqueueWithdrawalAlert(tx, workspaceId, txRecord, userInfo?.userId ?? null);
          }
          if (txRecord.type === "inflow" && txRecord.status === "paid" && txRecord.clientId) {
            await enqueuePaymentReceipt(tx, workspaceId, txRecord);
          }
        }
        return list;
      });

      res.status(201).json({ transactions: createdList });
      return;
    }

    // ── CASE 2: Single Transaction (ACID Transaction)
    const requiresApproval = type === "outflow" && amount > maxAuto && !isExec;
    const approvalStatus = requiresApproval ? "pending_approval" : "approved";
    const effectiveStatus = requiresApproval ? "pending" : (status ?? "pending");
    const isPaid = effectiveStatus === "paid";

    const transaction = await db.transaction(async (tx) => {
      const [record] = await tx
        .insert(financialTransactionsTable)
        .values({
          workspaceId,
          type,
          description,
          amount,
          dueDate: new Date(dueDate),
          categoryId: categoryId || null,
          clientId: clientId || null,
          projectId: projectId || null,
          accountId: accountId || null,
          partnerId: partnerId || null,
          costType: costType || "fixed_operating",
          notes: notes || null,
          status: effectiveStatus,
          paymentMethod: paymentMethod || null,
          paidAt: isPaid && paidAt ? new Date(paidAt) : isPaid ? new Date() : null,
          receiptUrl: receiptUrl || null,
          approvalStatus,
          isReimbursement: isReimbursement ?? false,
          reimbursementStatus: isReimbursement ? "pending" : null,
          isRecurring: isRecurring ?? false,
          recurringInterval: recurringInterval || null,
          installmentNumber: req.body.installmentNumber ? parseInt(req.body.installmentNumber) : null,
          installmentsTotal: req.body.installmentsTotal ? parseInt(req.body.installmentsTotal) : null,
          pauseBilling: pauseBilling === true,
        })
        .returning();

      if (isPaid && accountId) {
        const delta = type === "inflow" ? amount : -amount;
        await updateAccountBalance(tx, accountId, delta);
      }

      await logAudit(tx, workspaceId, record.id, userInfo?.userId ?? null, "created", record);
      if (record.type === "outflow" && record.costType === "partner_withdrawal" && record.status === "paid") {
        await enqueueWithdrawalAlert(tx, workspaceId, record, userInfo?.userId ?? null);
      }
      if (record.type === "inflow" && record.status === "paid" && record.clientId) {
        await enqueuePaymentReceipt(tx, workspaceId, record);
      }
      return record;
    });

    res.status(201).json({ transaction: { ...transaction, computedStatus: computeStatus(transaction) } });
  } catch (err: any) {
    console.error("Transaction create error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

router.put("/transactions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const userInfo = await getUserInfo(req, workspaceId);
    const id = req.params.id as string;

    const [existing] = await db
      .select()
      .from(financialTransactionsTable)
      .where(and(eq(financialTransactionsTable.id, id), eq(financialTransactionsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Transaction not found" }); return; }

    const {
      type, description, amount, dueDate,
      categoryId, clientId, projectId, accountId, partnerId,
      costType, notes, status, paymentMethod, paidAt, receiptUrl,
      isReimbursement, reimbursementStatus,
      isRecurring, recurringInterval, installmentNumber, installmentsTotal,
      pauseBilling,
    } = req.body;

    // Security: approvalStatus CANNOT be modified directly via PUT /transactions/:id
    // If expense requires approval and is pending, forbid marking as paid directly
    if (existing.approvalStatus === "pending_approval" && status === "paid") {
      res.status(400).json({
        error: "Forbidden",
        message: "Esta despesa requer aprovação de alçada formal antes de ser marcada como paga",
      });
      return;
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (type !== undefined) updateData.type = type;
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = amount;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (categoryId !== undefined) updateData.categoryId = categoryId || null;
    if (clientId !== undefined) updateData.clientId = clientId || null;
    if (projectId !== undefined) updateData.projectId = projectId || null;
    if (accountId !== undefined) updateData.accountId = accountId || null;
    if (partnerId !== undefined) updateData.partnerId = partnerId || null;
    if (costType !== undefined) updateData.costType = costType;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod || null;
    if (paidAt !== undefined) updateData.paidAt = paidAt ? new Date(paidAt) : null;
    if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl || null;
    if (isReimbursement !== undefined) updateData.isReimbursement = isReimbursement;
    if (reimbursementStatus !== undefined) updateData.reimbursementStatus = reimbursementStatus;
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
    if (recurringInterval !== undefined) updateData.recurringInterval = recurringInterval;
    if (installmentNumber !== undefined) updateData.installmentNumber = installmentNumber;
    if (installmentsTotal !== undefined) updateData.installmentsTotal = installmentsTotal;
    if (pauseBilling !== undefined) updateData.pauseBilling = Boolean(pauseBilling);

    const updated = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .update(financialTransactionsTable)
        .set(updateData)
        .where(eq(financialTransactionsTable.id, id))
        .returning();

      // Precise balance adjustment accounting
      const wasPaid = existing.status === "paid" && Boolean(existing.accountId);
      const isNowPaid = transaction.status === "paid" && Boolean(transaction.accountId);
      const oldAccId = existing.accountId;
      const newAccId = transaction.accountId;

      const revertOldDelta = existing.type === "inflow" ? -existing.amount : existing.amount;
      const applyNewDelta = transaction.type === "inflow" ? transaction.amount : -transaction.amount;

      if (wasPaid && isNowPaid) {
        if (oldAccId === newAccId && oldAccId) {
          const netDelta = (transaction.type === existing.type && transaction.amount === existing.amount)
            ? 0
            : revertOldDelta + applyNewDelta;
          if (netDelta !== 0) {
            await updateAccountBalance(tx, oldAccId, netDelta);
          }
        } else {
          // Account was changed while paid: revert on old, credit/debit on new
          if (oldAccId) await updateAccountBalance(tx, oldAccId, revertOldDelta);
          if (newAccId) await updateAccountBalance(tx, newAccId, applyNewDelta);
        }
      } else if (wasPaid && !isNowPaid) {
        // Was paid, now reverted to pending/cancelled: revert on old account
        if (oldAccId) await updateAccountBalance(tx, oldAccId, revertOldDelta);
      } else if (!wasPaid && isNowPaid) {
        // Was pending, now paid: apply to new account
        if (newAccId) await updateAccountBalance(tx, newAccId, applyNewDelta);
      }

      await logAudit(tx, workspaceId, transaction.id, userInfo?.userId ?? null, "updated", {
        before: existing,
        after: transaction,
      });

      if (existing.status !== "paid" && transaction.status === "paid"
          && transaction.type === "outflow" && transaction.costType === "partner_withdrawal") {
        await enqueueWithdrawalAlert(tx, workspaceId, transaction, userInfo?.userId ?? null);
      }
      if (existing.status !== "paid" && transaction.status === "paid"
          && transaction.type === "inflow" && transaction.clientId) {
        await enqueuePaymentReceipt(tx, workspaceId, transaction);
      }

      return transaction;
    });

    res.json({ transaction: { ...updated, computedStatus: computeStatus(updated) } });
  } catch (err: any) {
    console.error("Transaction update error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

router.delete("/transactions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const userInfo = await getUserInfo(req, workspaceId);

    const id = req.params.id as string;
    const [existing] = await db
      .select()
      .from(financialTransactionsTable)
      .where(and(eq(financialTransactionsTable.id, id), eq(financialTransactionsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Transaction not found" }); return; }

    await db.transaction(async (tx) => {
      if (existing.status === "paid" && existing.accountId) {
        const delta = existing.type === "inflow" ? -existing.amount : existing.amount;
        await updateAccountBalance(tx, existing.accountId, delta);
      }

      await tx.delete(financialTransactionsTable).where(eq(financialTransactionsTable.id, id));
      await logAudit(tx, workspaceId, id, userInfo?.userId ?? null, "deleted", existing);
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Transaction delete error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// APPROVALS & ALÇADAS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/approvals", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const pending = await db
      .select({
        transaction: financialTransactionsTable,
        categoryName: financialCategoriesTable.name,
        categoryColor: financialCategoriesTable.color,
        projectName: projectsTable.name,
        clientName: clientsTable.name,
        partnerName: usersTable.name,
      })
      .from(financialTransactionsTable)
      .leftJoin(financialCategoriesTable, eq(financialTransactionsTable.categoryId, financialCategoriesTable.id))
      .leftJoin(projectsTable, eq(financialTransactionsTable.projectId, projectsTable.id))
      .leftJoin(clientsTable, eq(financialTransactionsTable.clientId, clientsTable.id))
      .leftJoin(usersTable, eq(financialTransactionsTable.partnerId, usersTable.id))
      .where(and(eq(financialTransactionsTable.workspaceId, workspaceId), eq(financialTransactionsTable.approvalStatus, "pending_approval")))
      .orderBy(desc(financialTransactionsTable.amount));

    const enriched = pending.map(p => ({
      ...p.transaction,
      categoryName: p.categoryName,
      categoryColor: p.categoryColor,
      projectName: p.projectName,
      clientName: p.clientName,
      partnerName: p.partnerName,
    }));

    res.json({ pending: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/approvals/:id/approve", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const userInfo = await getUserInfo(req, workspaceId);
    const id = req.params.id as string;

    const isExec = userInfo?.role === "ceo" || userInfo?.role === "cto" || userInfo?.role === "owner" || userInfo?.role === "admin";
    if (!isExec) {
      res.status(403).json({ error: "Forbidden", message: "Apenas membros da diretoria podem aprovar despesas" });
      return;
    }

    const [existing] = await db
      .select()
      .from(financialTransactionsTable)
      .where(and(eq(financialTransactionsTable.id, id), eq(financialTransactionsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Transaction not found" }); return; }

    const [rule] = await db
      .select()
      .from(financialApprovalRulesTable)
      .where(eq(financialApprovalRulesTable.workspaceId, workspaceId))
      .limit(1);

    const ceoThreshold = rule?.ceoThresholdAmount ?? 300000; // R$ 3.000,00
    if (existing.amount > ceoThreshold && userInfo?.role !== "ceo" && userInfo?.role !== "owner") {
      res.status(403).json({
        error: "Forbidden",
        message: `Despesas acima de R$ ${(ceoThreshold / 100).toFixed(2)} exigem aprovação exclusiva do CEO`,
      });
      return;
    }

    const updated = await db.transaction(async (tx) => {
      const [approvedTx] = await tx
        .update(financialTransactionsTable)
        .set({
          approvalStatus: "approved",
          approvedBy: userInfo?.userId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(financialTransactionsTable.id, id))
        .returning();

      await logAudit(tx, workspaceId, approvedTx.id, userInfo?.userId ?? null, "approved", { approvedBy: userInfo?.userId });
      return approvedTx;
    });

    res.json({ transaction: updated });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

router.post("/approvals/:id/reject", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const userInfo = await getUserInfo(req, workspaceId);
    const id = req.params.id as string;
    const { reason } = req.body;

    const isExec = userInfo?.role === "ceo" || userInfo?.role === "cto" || userInfo?.role === "owner" || userInfo?.role === "admin";
    if (!isExec) {
      res.status(403).json({ error: "Forbidden", message: "Apenas membros da diretoria podem rejeitar despesas" });
      return;
    }

    const updated = await db.transaction(async (tx) => {
      const [rejectedTx] = await tx
        .update(financialTransactionsTable)
        .set({
          approvalStatus: "rejected",
          rejectionReason: reason || "Rejeitado pela diretoria",
          updatedAt: new Date(),
        })
        .where(and(eq(financialTransactionsTable.id, id), eq(financialTransactionsTable.workspaceId, workspaceId)))
        .returning();

      if (!rejectedTx) return null;

      await logAudit(tx, workspaceId, rejectedTx.id, userInfo?.userId ?? null, "rejected", { reason });
      return rejectedTx;
    });

    if (!updated) { res.status(404).json({ error: "Transaction not found" }); return; }

    res.json({ transaction: updated });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DRE GERENCIAL & UNIT ECONOMICS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/dre", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const now = new Date();
    const reqMonth = req.query.month ? parseInt(req.query.month as string) - 1 : now.getMonth();
    const reqYear = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();

    const start = new Date(reqYear, reqMonth, 1);
    const end = new Date(reqYear, reqMonth + 1, 0, 23, 59, 59);

    const [transactions, settingsList, projects] = await Promise.all([
      db.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.workspaceId, workspaceId)),
      db.select().from(financialSettingsTable).where(eq(financialSettingsTable.workspaceId, workspaceId)).limit(1),
      db.select().from(projectsTable).where(eq(projectsTable.workspaceId, workspaceId)),
    ]);

    const settings = settingsList[0] ?? { taxRatePercent: 600 };
    const monthTxs = transactions.filter(t => {
      const d = new Date(t.dueDate);
      return d >= start && d <= end && t.status === "paid";
    });

    // 1. Receita Bruta
    const grossRevenue = monthTxs.filter(t => t.type === "inflow").reduce((s, t) => s + t.amount, 0);

    // 1.1 Composição da receita por natureza (recorrente x pontual x avulsa)
    const inflowTxs = monthTxs.filter(t => t.type === "inflow");
    const recurringRevenue = inflowTxs.filter(t => t.revenueType === "recurring").reduce((s, t) => s + t.amount, 0);
    const oneTimeRevenue = inflowTxs.filter(t => t.revenueType === "one_time").reduce((s, t) => s + t.amount, 0);
    const otherRevenue = grossRevenue - recurringRevenue - oneTimeRevenue;

    // 2. Impostos Provisionados
    const taxDeductions = Math.round((grossRevenue * settings.taxRatePercent) / 10000);

    // 3. Receita Líquida
    const netRevenue = grossRevenue - taxDeductions;

    // 4. Custos Diretos (COGS) por Projeto
    const projectMap = new Map(projects.map(p => [p.id, { name: p.name, color: p.color, cogs: 0 }]));
    let unallocatedCOGS = 0;

    for (const t of monthTxs.filter(t => t.type === "outflow" && t.costType === "direct_cogs")) {
      if (t.projectId && projectMap.has(t.projectId)) {
        projectMap.get(t.projectId)!.cogs += t.amount;
      } else {
        unallocatedCOGS += t.amount;
      }
    }

    const cogsByProject = Array.from(projectMap.values()).filter(p => p.cogs > 0);
    const totalCOGS = cogsByProject.reduce((s, p) => s + p.cogs, 0) + unallocatedCOGS;

    // 5. Lucro Bruto / Margem de Contribuição
    const grossProfit = netRevenue - totalCOGS;

    // 6. Despesas Operacionais Fixas
    const fixedExpenses = monthTxs
      .filter(t => t.type === "outflow" && (t.costType === "fixed_operating" || t.costType === "tax"))
      .reduce((s, t) => s + t.amount, 0);

    // 7. Retiradas de Sócios (Pró-labore e Dividendos)
    const partnerWithdrawals = monthTxs
      .filter(t => t.type === "outflow" && t.costType === "partner_withdrawal")
      .reduce((s, t) => s + t.amount, 0);

    // 8. Lucro Líquido / Resultado
    const netProfit = grossProfit - fixedExpenses - partnerWithdrawals;

    res.json({
      dre: {
        month: reqMonth + 1,
        year: reqYear,
        grossRevenue,
        recurringRevenue,
        oneTimeRevenue,
        otherRevenue,
        taxDeductions,
        netRevenue,
        totalCOGS,
        cogsByProject,
        unallocatedCOGS,
        grossProfit,
        fixedExpenses,
        partnerWithdrawals,
        netProfit,
        grossMarginPercent: grossRevenue > 0 ? Math.round((grossProfit / grossRevenue) * 100) : 0,
        netMarginPercent: grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LUCRATIVIDADE POR PROJETO / PRODUTO
// ─────────────────────────────────────────────────────────────────────────────

router.get("/project-profitability", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const [projects, transactions] = await Promise.all([
      db.select().from(projectsTable).where(eq(projectsTable.workspaceId, workspaceId)),
      db.select().from(financialTransactionsTable).where(and(eq(financialTransactionsTable.workspaceId, workspaceId), eq(financialTransactionsTable.status, "paid"))),
    ]);

    const profitability = projects.map(p => {
      const projTxs = transactions.filter(t => t.projectId === p.id);
      const revenue = projTxs.filter(t => t.type === "inflow").reduce((s, t) => s + t.amount, 0);
      const cogs = projTxs.filter(t => t.type === "outflow").reduce((s, t) => s + t.amount, 0);
      const margin = revenue - cogs;
      const marginPercent = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;

      return {
        id: p.id,
        name: p.name,
        color: p.color,
        revenue,
        cogs,
        margin,
        marginPercent,
      };
    });

    res.json({ profitability });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SÓCIOS & REEMBOLSOS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/partners", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const [members, transactions] = await Promise.all([
      db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: workspaceMembersTable.role,
        })
        .from(usersTable)
        .leftJoin(workspaceMembersTable, eq(usersTable.id, workspaceMembersTable.userId))
        .where(eq(workspaceMembersTable.workspaceId, workspaceId)),
      db.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.workspaceId, workspaceId)),
    ]);

    const PARTNER_COLORS: Record<string, string> = {
      "tarcisio@teltech.com.br": "#8B5CF6", // Amethyst / Purple
      "lucas@teltech.com.br": "#10B981",    // Emerald Green
    };

    // Only active equal co-founders (Tarcísio and Lucas)
    const validPartners = members.filter(m => m.email !== "spiri@teltech.com.br" && (m.email === "tarcisio@teltech.com.br" || m.email === "lucas@teltech.com.br" || m.role === "ceo" || m.role === "cto" || m.role === "owner" || m.role === "admin"));

    const partners = validPartners.map(m => {
      const partnerTxs = transactions.filter(t => t.partnerId === m.id);
      const withdrawalsPaid = partnerTxs.filter(t => t.costType === "partner_withdrawal" && t.status === "paid").reduce((s, t) => s + t.amount, 0);
      const reimbursementsPending = partnerTxs.filter(t => t.isReimbursement && t.status === "pending").reduce((s, t) => s + t.amount, 0);
      const reimbursementsPaid = partnerTxs.filter(t => t.isReimbursement && t.status === "paid").reduce((s, t) => s + t.amount, 0);

      return {
        id: m.id,
        name: m.name,
        email: m.email,
        role: "Sócio Co-Founder (50%)",
        color: PARTNER_COLORS[m.email] ?? "#8B5CF6",
        withdrawalsPaid,
        reimbursementsPending,
        reimbursementsPaid,
        transactionsCount: partnerTxs.length,
      };
    });

    res.json({ partners });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ORÇAMENTOS (BUDGETS)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/budgets", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const now = new Date();
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();

    const [budgets, categories] = await Promise.all([
      db.select().from(financialBudgetsTable).where(and(eq(financialBudgetsTable.workspaceId, workspaceId), eq(financialBudgetsTable.month, month), eq(financialBudgetsTable.year, year))),
      db.select().from(financialCategoriesTable).where(eq(financialCategoriesTable.workspaceId, workspaceId)),
    ]);

    res.json({ budgets, categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/budgets", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const { department, categoryId, month, year, amount } = req.body;
    if (!department || !month || !year || amount === undefined) {
      res.status(400).json({ error: "department, month, year, amount are required" });
      return;
    }

    const [budget] = await db
      .insert(financialBudgetsTable)
      .values({ workspaceId, department, categoryId: categoryId || null, month, year, amount })
      .returning();

    res.status(201).json({ budget });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAÇÃO CSV
// ─────────────────────────────────────────────────────────────────────────────

router.get("/export", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const transactions = await db
      .select({
        id: financialTransactionsTable.id,
        dueDate: financialTransactionsTable.dueDate,
        paidAt: financialTransactionsTable.paidAt,
        type: financialTransactionsTable.type,
        status: financialTransactionsTable.status,
        description: financialTransactionsTable.description,
        amount: financialTransactionsTable.amount,
        costType: financialTransactionsTable.costType,
        paymentMethod: financialTransactionsTable.paymentMethod,
        categoryName: financialCategoriesTable.name,
        clientName: clientsTable.name,
        projectName: projectsTable.name,
        accountName: financialAccountsTable.name,
        partnerName: usersTable.name,
        notes: financialTransactionsTable.notes,
      })
      .from(financialTransactionsTable)
      .leftJoin(financialCategoriesTable, eq(financialTransactionsTable.categoryId, financialCategoriesTable.id))
      .leftJoin(clientsTable, eq(financialTransactionsTable.clientId, clientsTable.id))
      .leftJoin(projectsTable, eq(financialTransactionsTable.projectId, projectsTable.id))
      .leftJoin(financialAccountsTable, eq(financialTransactionsTable.accountId, financialAccountsTable.id))
      .leftJoin(usersTable, eq(financialTransactionsTable.partnerId, usersTable.id))
      .where(eq(financialTransactionsTable.workspaceId, workspaceId))
      .orderBy(desc(financialTransactionsTable.dueDate));

    const header = [
      "ID",
      "Vencimento",
      "Data Pagamento",
      "Tipo",
      "Status",
      "Descricao",
      "Valor (BRL)",
      "Centro de Custo",
      "Forma Pagamento",
      "Categoria",
      "Cliente",
      "Projeto",
      "Conta Bancaria",
      "Socio",
      "Notas",
    ].join(";");

    const rows = transactions.map(t => {
      const escape = (val?: string | null) => `"${(val ?? "").replace(/"/g, '""')}"`;
      return [
        t.id,
        new Date(t.dueDate).toISOString().slice(0, 10),
        t.paidAt ? new Date(t.paidAt).toISOString().slice(0, 10) : "",
        t.type === "inflow" ? "Entrada" : "Saída",
        t.status,
        escape(t.description),
        (t.amount / 100).toFixed(2).replace(".", ","),
        escape(t.costType),
        escape(t.paymentMethod),
        escape(t.categoryName),
        escape(t.clientName),
        escape(t.projectName),
        escape(t.accountName),
        escape(t.partnerName),
        escape(t.notes),
      ].join(";");
    });

    const csv = [header, ...rows].join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="teltech-financeiro-export.csv"');
    res.send("\uFEFF" + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Configurações Financeiras (Reserva de Emergência e Impostos) ─────────────
router.get("/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const [settings] = await db
      .select()
      .from(financialSettingsTable)
      .where(eq(financialSettingsTable.workspaceId, workspaceId))
      .limit(1);

    res.json({
      settings: settings ?? {
        workspaceId,
        emergencyReserveTarget: 5000000,
        taxRatePercent: 600,
      },
    });
  } catch (err) {
    console.error("Erro ao buscar configurações financeiras:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const { emergencyReserveTarget, taxRatePercent } = req.body || {};

    const [existing] = await db
      .select()
      .from(financialSettingsTable)
      .where(eq(financialSettingsTable.workspaceId, workspaceId))
      .limit(1);

    const updateData: Partial<typeof financialSettingsTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof emergencyReserveTarget === "number" && !isNaN(emergencyReserveTarget) && emergencyReserveTarget >= 0) {
      updateData.emergencyReserveTarget = Math.round(emergencyReserveTarget);
    }
    if (typeof taxRatePercent === "number" && !isNaN(taxRatePercent) && taxRatePercent >= 0) {
      updateData.taxRatePercent = Math.round(taxRatePercent);
    }

    let saved;
    if (existing) {
      [saved] = await db
        .update(financialSettingsTable)
        .set(updateData)
        .where(eq(financialSettingsTable.id, existing.id))
        .returning();
    } else {
      [saved] = await db
        .insert(financialSettingsTable)
        .values({
          workspaceId,
          emergencyReserveTarget: updateData.emergencyReserveTarget ?? 5000000,
          taxRatePercent: updateData.taxRatePercent ?? 600,
        })
        .returning();
    }

    res.json({ success: true, settings: saved });
  } catch (err) {
    console.error("Erro ao atualizar configurações financeiras:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Reset do Módulo Financeiro ──────────────────────────────────────────────
router.post("/reset-all", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const userInfo = await getUserInfo(req, workspaceId);
    if (!userInfo || !["owner", "ceo", "cto", "admin"].includes(userInfo.role)) {
      res.status(403).json({ error: "Apenas administradores ou sócios (CEO/CTO/Owner) podem resetar o financeiro." });
      return;
    }

    const { confirm } = req.body || {};
    if (confirm !== "RESET_FINANCE") {
      res.status(400).json({ error: "Confirmação inválida. Envie { confirm: 'RESET_FINANCE' } para autorizar o reset." });
      return;
    }

    await db.transaction(async (tx) => {
      // 1. Desvincular clientes das tarefas do Kanban
      await tx
        .update(tasksTable)
        .set({ clientId: null })
        .where(isNotNull(tasksTable.clientId));

      // 2. Limpar mensagens de cobrança e clientes no WhatsApp
      await tx
        .delete(whatsappMessagesTable)
        .where(eq(whatsappMessagesTable.workspaceId, workspaceId));

      // 3. Limpar logs de auditoria
      await tx
        .delete(financialAuditLogsTable)
        .where(eq(financialAuditLogsTable.workspaceId, workspaceId));

      // 4. Limpar transações
      await tx
        .delete(financialTransactionsTable)
        .where(eq(financialTransactionsTable.workspaceId, workspaceId));

      // 5. Limpar comissões, módulos, itens de vendas e vendas comerciais
      await tx
        .delete(teamCommissionsTable)
        .where(eq(teamCommissionsTable.workspaceId, workspaceId));

      await tx
        .delete(saleModulesTable)
        .where(eq(saleModulesTable.workspaceId, workspaceId));

      await tx
        .delete(saleItemsTable)
        .where(eq(saleItemsTable.workspaceId, workspaceId));

      await tx
        .delete(clientSalesTable)
        .where(eq(clientSalesTable.workspaceId, workspaceId));

      // 6. Limpar contratos antigos
      await tx
        .delete(clientContractsTable)
        .where(eq(clientContractsTable.workspaceId, workspaceId));

      // 7. Limpar clientes
      await tx
        .delete(clientsTable)
        .where(eq(clientsTable.workspaceId, workspaceId));

      // 8. Limpar orçamentos
      await tx
        .delete(financialBudgetsTable)
        .where(eq(financialBudgetsTable.workspaceId, workspaceId));

      // 9. Zerar saldos das contas bancárias
      await tx
        .update(financialAccountsTable)
        .set({ currentBalance: 0 })
        .where(eq(financialAccountsTable.workspaceId, workspaceId));
    });

    res.json({ success: true, message: "Todos os dados do módulo financeiro foram resetados com sucesso." });
  } catch (err) {
    console.error("Erro ao resetar financeiro:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

