import { Router, type IRouter } from "express";
import { db, tasksTable, taskAssigneesTable, columnsTable, projectsTable, workspaceMembersTable, activityLogsTable, usersTable } from "@workspace/db";
import { eq, and, lte, gte, inArray, desc, asc, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { type Request, type Response } from "express";

const router: IRouter = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

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
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
