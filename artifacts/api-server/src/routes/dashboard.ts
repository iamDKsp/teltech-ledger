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

    // All user tasks (assigned to user)
    const allUserTasks = await db.select({
      taskId: tasksTable.id,
      taskTitle: tasksTable.title,
      taskPriority: tasksTable.priority,
      taskDueDate: tasksTable.dueDate,
      taskUpdatedAt: tasksTable.updatedAt,
      columnTitle: columnsTable.title,
      projectColor: projectsTable.color,
      projectName: projectsTable.name,
    })
    .from(tasksTable)
    .innerJoin(taskAssigneesTable, eq(taskAssigneesTable.taskId, tasksTable.id))
    .innerJoin(columnsTable, eq(columnsTable.id, tasksTable.columnId))
    .innerJoin(projectsTable, eq(projectsTable.id, tasksTable.projectId))
    .where(eq(taskAssigneesTable.userId, userId));

    // Today's tasks
    const todaysTasks = allUserTasks.filter(t =>
      t.taskDueDate &&
      new Date(t.taskDueDate) >= todayStart &&
      new Date(t.taskDueDate) <= todayEnd
    ).map(t => ({
      id: t.taskId,
      title: t.taskTitle,
      priority: t.taskPriority,
      dueDate: t.taskDueDate,
      projectColor: t.projectColor,
      projectName: t.projectName,
    }));

    // Overdue tasks count
    const overdueCount = allUserTasks.filter(t =>
      t.taskDueDate &&
      new Date(t.taskDueDate) < todayStart &&
      !t.columnTitle.toLowerCase().includes("conclu")
    ).length;

    // Completed today count
    const completedTodayCount = allUserTasks.filter(t =>
      t.taskUpdatedAt >= todayStart &&
      t.columnTitle.toLowerCase().includes("conclu")
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
