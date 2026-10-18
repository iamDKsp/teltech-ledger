import { Router, type IRouter } from "express";
import { 
  db, 
  tasksTable, 
  taskAssigneesTable, 
  columnsTable, 
  projectsTable, 
  workspaceMembersTable, 
  activityLogsTable, 
  usersTable,
  financialTransactionsTable,
  clientsTable
} from "@workspace/db";
import { eq, and, lte, inArray, desc, asc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { type Request, type Response } from "express";

const router: IRouter = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get current user info
    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    // Find workspaces user belongs to
    const userWorkspaces = await db.select({ workspaceId: workspaceMembersTable.workspaceId })
      .from(workspaceMembersTable)
      .where(eq(workspaceMembersTable.userId, userId));
    const workspaceIds = userWorkspaces.map(w => w.workspaceId);

    // Total active projects count
    const activeProjects = workspaceIds.length > 0
      ? await db.select({ id: projectsTable.id }).from(projectsTable).where(inArray(projectsTable.workspaceId, workspaceIds))
      : [];
    const projectIds = activeProjects.map(p => p.id);

    // All tasks across user's active workspace projects
    const allUserTasks = projectIds.length > 0
      ? await db.select({
          taskId: tasksTable.id,
          taskTitle: tasksTable.title,
          taskPriority: tasksTable.priority,
          taskDueDate: tasksTable.dueDate,
          taskCreatedAt: tasksTable.createdAt,
          taskUpdatedAt: tasksTable.updatedAt,
          columnTitle: columnsTable.title,
          projectId: projectsTable.id,
          projectColor: projectsTable.color,
          projectName: projectsTable.name,
        })
        .from(tasksTable)
        .innerJoin(columnsTable, eq(columnsTable.id, tasksTable.columnId))
        .innerJoin(projectsTable, eq(projectsTable.id, tasksTable.projectId))
        .where(inArray(tasksTable.projectId, projectIds))
      : [];

    const isCompletedColumn = (colTitle: string) => {
      const lower = (colTitle || "").toLowerCase();
      return lower.includes("conclu") || lower.includes("done") || lower.includes("finaliz");
    };

    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const toDateKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

    const priorityWeight: Record<string, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    const pendingTasks = allUserTasks.filter(t => !isCompletedColumn(t.columnTitle));

    // Tasks explicitly scheduled for today
    const strictTodaysTasks = pendingTasks
      .filter(t => t.taskDueDate && toDateKey(t.taskDueDate) === todayKey)
      .sort((a, b) => (priorityWeight[a.taskPriority] ?? 2) - (priorityWeight[b.taskPriority] ?? 2));

    // All pending tasks ordered from closest to expire (earliest dueDate) to farthest,
    // with tasks without a dueDate placed at the end
    const sortedPendingTasks = [...pendingTasks].sort((a, b) => {
      if (a.taskDueDate && b.taskDueDate) {
        const diff = new Date(a.taskDueDate).getTime() - new Date(b.taskDueDate).getTime();
        if (diff !== 0) return diff;
      }
      if (a.taskDueDate && !b.taskDueDate) return -1;
      if (!a.taskDueDate && b.taskDueDate) return 1;
      const pDiff = (priorityWeight[a.taskPriority] ?? 2) - (priorityWeight[b.taskPriority] ?? 2);
      if (pDiff !== 0) return pDiff;
      return new Date(a.taskCreatedAt).getTime() - new Date(b.taskCreatedAt).getTime();
    });

    const mapDashboardTask = (t: typeof allUserTasks[number]) => {
      const dueKey = t.taskDueDate ? toDateKey(t.taskDueDate) : null;
      const urgencyGroup = !dueKey
        ? ("no_date" as const)
        : dueKey < todayKey
          ? ("overdue" as const)
          : dueKey === todayKey
            ? ("today" as const)
            : ("upcoming" as const);

      return {
        id: t.taskId,
        title: t.taskTitle,
        priority: t.taskPriority,
        dueDate: t.taskDueDate,
        columnTitle: t.columnTitle,
        projectId: t.projectId,
        projectColor: t.projectColor,
        projectName: t.projectName,
        urgencyGroup,
      };
    };

    // If there are tasks scheduled for today, show them; otherwise show all pending tasks ordered from closest due date to farthest
    const todaysTasks = (strictTodaysTasks.length > 0 ? strictTodaysTasks : sortedPendingTasks).map(mapDashboardTask);
    const allPendingTasksMapped = sortedPendingTasks.map(mapDashboardTask);

    // Overdue tasks count
    const overdueCount = pendingTasks.filter(t =>
      t.taskDueDate && toDateKey(t.taskDueDate) < todayKey
    ).length;

    // Completed today count
    const completedTodayCount = allUserTasks.filter(t =>
      t.taskUpdatedAt >= todayStart &&
      isCompletedColumn(t.columnTitle)
    ).length;

    // Recent Activity (last 10)
    let recentActivity: any[] = [];
    if (projectIds.length > 0) {
      recentActivity = await db.select({
        id: activityLogsTable.id,
        action: activityLogsTable.action,
        metadata: activityLogsTable.metadata,
        createdAt: activityLogsTable.createdAt,
        user: {
          id: usersTable.id,
          name: usersTable.name,
          avatarUrl: usersTable.avatarUrl,
        },
        task: {
          id: tasksTable.id,
          title: tasksTable.title,
        },
      })
      .from(activityLogsTable)
      .leftJoin(usersTable, eq(usersTable.id, activityLogsTable.userId))
      .leftJoin(tasksTable, eq(tasksTable.id, activityLogsTable.taskId))
      .where(inArray(tasksTable.projectId, projectIds))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(10);
    }

    // ─── Financial Inflows / Receivables (Vencimentos a entrar) ────────────
    let incomingInstallments: any[] = [];
    let overdueInflows: any[] = [];
    let todayInflows: any[] = [];
    let monthUpcomingInflows: any[] = [];
    let futureLaterInflows: any[] = [];

    if (workspaceIds.length > 0) {
      // Fetch pending inflow transactions up to end of current month
      const rawInflows = await db
        .select({
          id: financialTransactionsTable.id,
          description: financialTransactionsTable.description,
          amount: financialTransactionsTable.amount,
          dueDate: financialTransactionsTable.dueDate,
          status: financialTransactionsTable.status,
          installmentNumber: financialTransactionsTable.installmentNumber,
          installmentsTotal: financialTransactionsTable.installmentsTotal,
          revenueType: financialTransactionsTable.revenueType,
          paymentMethod: financialTransactionsTable.paymentMethod,
          clientName: clientsTable.name,
          projectName: projectsTable.name,
          projectColor: projectsTable.color,
        })
        .from(financialTransactionsTable)
        .leftJoin(clientsTable, eq(financialTransactionsTable.clientId, clientsTable.id))
        .leftJoin(projectsTable, eq(financialTransactionsTable.projectId, projectsTable.id))
        .where(
          and(
            inArray(financialTransactionsTable.workspaceId, workspaceIds),
            eq(financialTransactionsTable.type, "inflow"),
            eq(financialTransactionsTable.status, "pending"),
            lte(financialTransactionsTable.dueDate, monthEnd)
          )
        )
        .orderBy(asc(financialTransactionsTable.dueDate));

      // 1. Já venceram (overdue): dueDate < todayStart
      // Ordenadas da que já venceu primeiro (mais antiga) para a mais recente
      overdueInflows = rawInflows
        .filter(t => new Date(t.dueDate) < todayStart)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .map(t => ({ ...t, urgencyGroup: "overdue" as const }));

      // 2. Vencem hoje (due today): todayStart <= dueDate <= todayEnd
      todayInflows = rawInflows
        .filter(t => new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .map(t => ({ ...t, urgencyGroup: "today" as const }));

      // 3. Futuras a vencer dentro do mesmo mês: dueDate > todayEnd && dueDate <= monthEnd
      monthUpcomingInflows = rawInflows
        .filter(t => new Date(t.dueDate) > todayEnd && new Date(t.dueDate) <= monthEnd)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .map(t => ({ ...t, urgencyGroup: "upcoming_month" as const }));

      // Se não houver nada atrasado, hoje ou no mês, buscar as próximas futuras gerais
      if (overdueInflows.length === 0 && todayInflows.length === 0 && monthUpcomingInflows.length === 0) {
        const nextFuture = await db
          .select({
            id: financialTransactionsTable.id,
            description: financialTransactionsTable.description,
            amount: financialTransactionsTable.amount,
            dueDate: financialTransactionsTable.dueDate,
            status: financialTransactionsTable.status,
            installmentNumber: financialTransactionsTable.installmentNumber,
            installmentsTotal: financialTransactionsTable.installmentsTotal,
            revenueType: financialTransactionsTable.revenueType,
            paymentMethod: financialTransactionsTable.paymentMethod,
            clientName: clientsTable.name,
            projectName: projectsTable.name,
            projectColor: projectsTable.color,
          })
          .from(financialTransactionsTable)
          .leftJoin(clientsTable, eq(financialTransactionsTable.clientId, clientsTable.id))
          .leftJoin(projectsTable, eq(financialTransactionsTable.projectId, projectsTable.id))
          .where(
            and(
              inArray(financialTransactionsTable.workspaceId, workspaceIds),
              eq(financialTransactionsTable.type, "inflow"),
              eq(financialTransactionsTable.status, "pending")
            )
          )
          .orderBy(asc(financialTransactionsTable.dueDate))
          .limit(5);

        futureLaterInflows = nextFuture.map(t => ({ ...t, urgencyGroup: "future_later" as const }));
      }

      // Regra de ordenação e cascata estrita solicitada:
      // "sempre mostrando da que ja venceu primeiro até a que vai vencer depois.
      // se não tiver que ja venceu, mostra a que ta vendendo hoje, se nao tiver a que ta vencendo hoje, mostra as que vão vencer futuras dentro do mesmo mes"
      incomingInstallments = [
        ...overdueInflows,
        ...todayInflows,
        ...monthUpcomingInflows,
        ...futureLaterInflows
      ];
    }

    res.json({
      welcomeData: {
        name: user?.name ?? "Usuário",
        date: today,
      },
      todaysTasks,
      allPendingTasks: allPendingTasksMapped,
      todaysStrictCount: strictTodaysTasks.length,
      showingFallbackTasks: strictTodaysTasks.length === 0 && sortedPendingTasks.length > 0,
      overdueTasksCount: overdueCount,
      completedTodayCount,
      totalActiveProjectsCount: projectIds.length,
      recentActivity,
      incomingInstallments,
      incomingInstallmentsSummary: {
        overdueCount: overdueInflows.length,
        todayCount: todayInflows.length,
        monthUpcomingCount: monthUpcomingInflows.length,
        futureLaterCount: futureLaterInflows.length,
        totalCount: incomingInstallments.length,
        totalAmountCents: incomingInstallments.reduce((sum, item) => sum + (item.amount || 0), 0)
      }
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
