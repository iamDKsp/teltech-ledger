import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  financialTransactionsTable,
  financialCategoriesTable,
  clientsTable,
  workspaceMembersTable,
  projectsTable,
  usersTable,
  financialAccountsTable,
  financialApprovalRulesTable,
  financialBudgetsTable,
  financialAuditLogsTable,
  financialSettingsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getWorkspaceId(req: Request): Promise<string | null> {
  const userId = (req as AuthenticatedRequest).user?.userId;
  if (!userId) return null;
  const member = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId))
    .limit(1);
  return member.length > 0 ? member[0].workspaceId : null;
}

async function getUserInfo(req: Request): Promise<{ userId: string; role: string } | null> {
  const userId = (req as AuthenticatedRequest).user?.userId;
  if (!userId) return null;
  const member = await db
    .select({ role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId))
    .limit(1);
  return { userId, role: member.length > 0 ? member[0].role : "member" };
}

function computeStatus(tx: { status: string; dueDate: Date }): string {
  if (tx.status !== "pending") return tx.status;
  if (new Date(tx.dueDate) < new Date()) return "overdue";
  return "pending";
}

async function updateAccountBalance(accountId: string, deltaCents: number) {
  if (!accountId || deltaCents === 0) return;
  await db
    .update(financialAccountsTable)
    .set({
      currentBalance: sql`${financialAccountsTable.currentBalance} + ${deltaCents}`,
      updatedAt: new Date(),
    })
    .where(eq(financialAccountsTable.id, accountId));
}

async function logAudit(
  workspaceId: string,
  transactionId: string | null,
  userId: string | null,
  action: string,
  details: any
) {
  try {
    await db.insert(financialAuditLogsTable).values({
      workspaceId,
      transactionId,
      userId,
      action,
      details: typeof details === "string" ? details : JSON.stringify(details),
    });
  } catch (err) {
    console.error("Failed to log audit:", err);
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

    const [transactions, accounts, categories, settingsList, budgets, users, clients] = await Promise.all([
      db.select().from(financialTransactionsTable).where(eq(financialTransactionsTable.workspaceId, workspaceId)),
      db.select().from(financialAccountsTable).where(and(eq(financialAccountsTable.workspaceId, workspaceId), eq(financialAccountsTable.isActive, true))),
      db.select().from(financialCategoriesTable).where(eq(financialCategoriesTable.workspaceId, workspaceId)),
      db.select().from(financialSettingsTable).where(eq(financialSettingsTable.workspaceId, workspaceId)).limit(1),
      db.select().from(financialBudgetsTable).where(and(eq(financialBudgetsTable.workspaceId, workspaceId), eq(financialBudgetsTable.year, reqYear), eq(financialBudgetsTable.month, reqMonth + 1))),
      db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email }).from(usersTable),
      db.select().from(clientsTable).where(eq(clientsTable.workspaceId, workspaceId)),
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

    // ── MRR: Sum of inflow due this month (not cancelled)
    const mrr = monthTxs.filter(t => t.type === "inflow" && t.status !== "cancelled").reduce((s, t) => s + t.amount, 0);

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
    const pastOutflows = transactions.filter(t => t.type === "outflow" && t.status === "paid" && new Date(t.dueDate) >= threeMonthsAgo);
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

    res.json({
      dashboard: {
        mrr,
        monthInflow, monthInflowPending,
        monthOutflow, monthOutflowPending,
        monthBalance,
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

    const { name, type, color, currentBalance } = req.body;
    const [account] = await db
      .update(financialAccountsTable)
      .set({ name, type, color, currentBalance, updatedAt: new Date() })
      .where(and(eq(financialAccountsTable.id, id), eq(financialAccountsTable.workspaceId, workspaceId)))
      .returning();

    if (!account) { res.status(404).json({ error: "Account not found" }); return; }
    res.json({ account });
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

    const clients = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.workspaceId, workspaceId))
      .orderBy(clientsTable.name);

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

    const { name, document, email, phone, notes } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }

    const [client] = await db
      .insert(clientsTable)
      .values({ workspaceId, name, document, email, phone, notes })
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

    const { name, document, email, phone, notes, status } = req.body;
    const [client] = await db
      .update(clientsTable)
      .set({ name, document, email, phone, notes, status, updatedAt: new Date() })
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

    // Soft-delete by setting status to 'inactive'
    const [client] = await db
      .update(clientsTable)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(and(eq(clientsTable.id, id), eq(clientsTable.workspaceId, workspaceId)))
      .returning();

    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    res.json({ ok: true, client });
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
    const userInfo = await getUserInfo(req);

    const {
      type, description, amount, dueDate,
      categoryId, clientId, projectId, accountId, partnerId,
      costType, notes, status, paymentMethod, paidAt, receiptUrl,
      isReimbursement, isRecurring, recurringInterval,
      installmentsTotal, isInstallmentBatch,
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

    // ── CASE 1: Batch Installment Generation
    if (isInstallmentBatch && installmentsTotal && Number(installmentsTotal) > 1) {
      const n = parseInt(installmentsTotal);
      const groupId = randomUUID();
      const baseDueDate = new Date(dueDate);
      const perInstallment = Math.floor(amount / n);
      const remainder = amount - perInstallment * n;

      const createdList = [];
      for (let i = 1; i <= n; i++) {
        const instDueDate = new Date(baseDueDate);
        instDueDate.setMonth(instDueDate.getMonth() + (i - 1));

        const instAmount = i === n ? perInstallment + remainder : perInstallment;
        const requiresApproval = type === "outflow" && instAmount > maxAuto && !isExec;
        const approvalStatus = requiresApproval ? "pending_approval" : "approved";

        const [tx] = await db
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
            status: i === 1 && status === "paid" ? "paid" : "pending",
            paymentMethod: paymentMethod || null,
            paidAt: i === 1 && status === "paid" && paidAt ? new Date(paidAt) : null,
            receiptUrl: receiptUrl || null,
            approvalStatus,
            isReimbursement: isReimbursement ?? false,
            reimbursementStatus: isReimbursement ? "pending" : null,
            isRecurring: false,
            installmentNumber: i,
            installmentsTotal: n,
            installmentGroupId: groupId,
          })
          .returning();

        createdList.push(tx);
        await logAudit(workspaceId, tx.id, userInfo?.userId ?? null, "created", { batch: true, installment: i, total: n });

        if (i === 1 && status === "paid" && accountId) {
          const delta = type === "inflow" ? instAmount : -instAmount;
          await updateAccountBalance(accountId, delta);
        }
      }

      res.status(201).json({ transactions: createdList });
      return;
    }

    // ── CASE 2: Single Transaction
    const requiresApproval = type === "outflow" && amount > maxAuto && !isExec;
    const approvalStatus = requiresApproval ? "pending_approval" : "approved";

    const [transaction] = await db
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
        status: status ?? "pending",
        paymentMethod: paymentMethod || null,
        paidAt: paidAt ? new Date(paidAt) : null,
        receiptUrl: receiptUrl || null,
        approvalStatus,
        isReimbursement: isReimbursement ?? false,
        reimbursementStatus: isReimbursement ? "pending" : null,
        isRecurring: isRecurring ?? false,
        recurringInterval: recurringInterval || null,
        installmentNumber: req.body.installmentNumber ? parseInt(req.body.installmentNumber) : null,
        installmentsTotal: req.body.installmentsTotal ? parseInt(req.body.installmentsTotal) : null,
      })
      .returning();

    if (status === "paid" && accountId) {
      const delta = type === "inflow" ? amount : -amount;
      await updateAccountBalance(accountId, delta);
    }

    await logAudit(workspaceId, transaction.id, userInfo?.userId ?? null, "created", transaction);

    res.status(201).json({ transaction: { ...transaction, computedStatus: computeStatus(transaction) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/transactions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const userInfo = await getUserInfo(req);
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
      approvalStatus, isReimbursement, reimbursementStatus,
      isRecurring, recurringInterval, installmentNumber, installmentsTotal,
    } = req.body;

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
    if (approvalStatus !== undefined) updateData.approvalStatus = approvalStatus;
    if (isReimbursement !== undefined) updateData.isReimbursement = isReimbursement;
    if (reimbursementStatus !== undefined) updateData.reimbursementStatus = reimbursementStatus;
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
    if (recurringInterval !== undefined) updateData.recurringInterval = recurringInterval;
    if (installmentNumber !== undefined) updateData.installmentNumber = installmentNumber;
    if (installmentsTotal !== undefined) updateData.installmentsTotal = installmentsTotal;

    const [transaction] = await db
      .update(financialTransactionsTable)
      .set(updateData)
      .where(eq(financialTransactionsTable.id, id))
      .returning();

    // Handle balance adjustment if paid status or amount changed
    const targetAccountId = transaction.accountId || existing.accountId;
    if (targetAccountId) {
      const wasPaid = existing.status === "paid";
      const isNowPaid = transaction.status === "paid";

      if (!wasPaid && isNowPaid) {
        const delta = transaction.type === "inflow" ? transaction.amount : -transaction.amount;
        await updateAccountBalance(targetAccountId, delta);
      } else if (wasPaid && !isNowPaid) {
        const delta = existing.type === "inflow" ? -existing.amount : existing.amount;
        await updateAccountBalance(targetAccountId, delta);
      } else if (wasPaid && isNowPaid && (transaction.amount !== existing.amount || transaction.type !== existing.type)) {
        const revertDelta = existing.type === "inflow" ? -existing.amount : existing.amount;
        const newDelta = transaction.type === "inflow" ? transaction.amount : -transaction.amount;
        await updateAccountBalance(targetAccountId, revertDelta + newDelta);
      }
    }

    await logAudit(workspaceId, transaction.id, userInfo?.userId ?? null, "updated", {
      before: existing,
      after: transaction,
    });

    res.json({ transaction: { ...transaction, computedStatus: computeStatus(transaction) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/transactions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const userInfo = await getUserInfo(req);

    const id = req.params.id as string;
    const [existing] = await db
      .select()
      .from(financialTransactionsTable)
      .where(and(eq(financialTransactionsTable.id, id), eq(financialTransactionsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Transaction not found" }); return; }

    if (existing.status === "paid" && existing.accountId) {
      const delta = existing.type === "inflow" ? -existing.amount : existing.amount;
      await updateAccountBalance(existing.accountId, delta);
    }

    await db.delete(financialTransactionsTable).where(eq(financialTransactionsTable.id, id));
    await logAudit(workspaceId, id, userInfo?.userId ?? null, "deleted", existing);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
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
    const userInfo = await getUserInfo(req);
    const id = req.params.id as string;

    const [tx] = await db
      .update(financialTransactionsTable)
      .set({
        approvalStatus: "approved",
        approvedBy: userInfo?.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(financialTransactionsTable.id, id), eq(financialTransactionsTable.workspaceId, workspaceId)))
      .returning();

    if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }

    await logAudit(workspaceId, tx.id, userInfo?.userId ?? null, "approved", { approvedBy: userInfo?.userId });
    res.json({ transaction: tx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/approvals/:id/reject", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const userInfo = await getUserInfo(req);
    const id = req.params.id as string;
    const { reason } = req.body;

    const [tx] = await db
      .update(financialTransactionsTable)
      .set({
        approvalStatus: "rejected",
        rejectionReason: reason || "Rejeitado pela diretoria",
        updatedAt: new Date(),
      })
      .where(and(eq(financialTransactionsTable.id, id), eq(financialTransactionsTable.workspaceId, workspaceId)))
      .returning();

    if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }

    await logAudit(workspaceId, tx.id, userInfo?.userId ?? null, "rejected", { reason });
    res.json({ transaction: tx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
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

export default router;

