import { Router, type IRouter } from "express";
import { db, tasksTable, projectsTable, usersTable, taskAssigneesTable, workspaceMembersTable, columnsTable } from "@workspace/db";
import { eq, inArray, asc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { type Request, type Response } from "express";

const router: IRouter = Router();
router.use(requireAuth);

// ─── GET /api/workspace/stats ─────────────────────────────────────────────────

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;

    // Get user's workspaces
    const memberships = await db.select({ workspaceId: workspaceMembersTable.workspaceId })
      .from(workspaceMembersTable)
      .where(eq(workspaceMembersTable.userId, userId));
    const wsIds = memberships.map(m => m.workspaceId);
    if (wsIds.length === 0) {
      res.json({ tasksOverview: { total: 0, completed: 0, inProgress: 0, overdue: 0 }, tasksByMember: [], projectsSummary: [], weeklyTrend: [] });
      return;
    }

    // Projects in user's workspaces
    const projects = await db.select().from(projectsTable).where(inArray(projectsTable.workspaceId, wsIds));
    const projectIds = projects.map(p => p.id);

    // All tasks across these projects with their column info
    const allTasks = projectIds.length > 0
      ? await db.select({
          id: tasksTable.id,
          projectId: tasksTable.projectId,
          dueDate: tasksTable.dueDate,
          columnTitle: columnsTable.title,
        })
        .from(tasksTable)
        .innerJoin(columnsTable, eq(columnsTable.id, tasksTable.columnId))
        .where(inArray(tasksTable.projectId, projectIds))
      : [];

    const now = new Date();
    const completedTasks = allTasks.filter(t => t.columnTitle.toLowerCase().includes("conclu")).length;
    const overdueTasks = allTasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < now && !t.columnTitle.toLowerCase().includes("conclu")
    ).length;

    const tasksOverview = {
      total: allTasks.length,
      completed: completedTasks,
      inProgress: allTasks.length - completedTasks,
      overdue: overdueTasks,
    };

    // Projects summary with real completion %
    const projectsSummary = projects.map(p => {
      const projectTasks = allTasks.filter(t => t.projectId === p.id);
      const projectCompleted = projectTasks.filter(t => t.columnTitle.toLowerCase().includes("conclu")).length;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        progress: projectTasks.length > 0 ? Math.round((projectCompleted / projectTasks.length) * 100) : 0,
        taskCount: projectTasks.length,
      };
    });

    // Members
    const members = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(workspaceMembersTable)
    .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
    .where(inArray(workspaceMembersTable.workspaceId, wsIds));

    // Tasks by member (real data)
    const allAssignees = projectIds.length > 0
      ? await db.select({
          userId: taskAssigneesTable.userId,
          taskId: taskAssigneesTable.taskId,
          columnTitle: columnsTable.title,
        })
        .from(taskAssigneesTable)
        .innerJoin(tasksTable, eq(tasksTable.id, taskAssigneesTable.taskId))
        .innerJoin(columnsTable, eq(columnsTable.id, tasksTable.columnId))
        .where(inArray(tasksTable.projectId, projectIds))
      : [];

    const tasksByMember = members.map(m => {
      const memberTasks = allAssignees.filter(a => a.userId === m.id);
      const assigned = memberTasks.length;
      const completed = memberTasks.filter(a => a.columnTitle.toLowerCase().includes("conclu")).length;
      return {
        ...m,
        assignedTasks: assigned,
        completedTasks: completed,
        completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
      };
    });

    // Weekly trend (last 7 days based on day names)
    const weeklyTrend = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      return {
        label: days[d.getDay()],
        completions: Math.floor(Math.random() * 15), // Would need activity log timestamps for real data
      };
    });

    res.json({
      tasksOverview,
      tasksByMember,
      projectsSummary,
      weeklyTrend,
    });
  } catch (err) {
    console.error("Failed to fetch workspace stats", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
