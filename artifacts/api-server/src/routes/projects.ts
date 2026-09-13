import { Router, type IRouter } from "express";
import { db, projectsTable, columnsTable, tasksTable, taskAssigneesTable, taskTagsTable, tagsTable, usersTable, workspaceMembersTable, subtasksTable, commentsTable, activityLogsTable, taskAttachmentsTable, projectMessagesTable } from "@workspace/db";
import { eq, asc, inArray, sql, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { z } from "zod";
import { type Request, type Response } from "express";

const router: IRouter = Router();
router.use(requireAuth);

// ─── GET /api/projects ────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;

  // Get workspaces user belongs to
  const memberships = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId));

  const wsIds = memberships.map(m => m.workspaceId);
  if (wsIds.length === 0) { res.json({ projects: [] }); return; }

  const projects = await db
    .select()
    .from(projectsTable)
    .where(inArray(projectsTable.workspaceId, wsIds))
    .orderBy(asc(projectsTable.createdAt));

  res.json({ projects });
});

// ─── POST /api/projects ───────────────────────────────────────────────────────

const createProjectSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1),
  color: z.string().optional(),
  icon: z.string().optional(),
});

router.post("/", async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", issues: parsed.error.issues }); return; }

  const { workspaceId, name, color, icon } = parsed.data;
  const [project] = await db.insert(projectsTable).values({ workspaceId, name, color: color ?? "#7C5AC2", icon, createdBy: userId }).returning();

  // Auto-create default columns
  await db.insert(columnsTable).values([
    { projectId: project.id, title: "A Fazer", position: 0 },
    { projectId: project.id, title: "Em Andamento", position: 1 },
    { projectId: project.id, title: "Revisão", position: 2 },
    { projectId: project.id, title: "Concluído", position: 3 },
  ]);

  res.status(201).json({ project });
});

// ─── GET /api/projects/:id/board ──────────────────────────────────────────────
// Returns full board: columns + tasks + assignees + tags

router.get("/:id/board", async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const columns = await db
    .select()
    .from(columnsTable)
    .where(eq(columnsTable.projectId, id))
    .orderBy(asc(columnsTable.position));

  const tasks = await db
    .select({
      id: tasksTable.id,
      columnId: tasksTable.columnId,
      title: tasksTable.title,
      description: tasksTable.description,
      priority: tasksTable.priority,
      dueDate: tasksTable.dueDate,
      estimatedHours: tasksTable.estimatedHours,
      coverImageUrl: tasksTable.coverImageUrl,
      position: tasksTable.position,
      createdAt: tasksTable.createdAt,
    })
    .from(tasksTable)
    .where(eq(tasksTable.projectId, id))
    .orderBy(asc(tasksTable.position));

  const taskIds = tasks.map(t => t.id);

  // Fetch assignees for all tasks
  const assignees = taskIds.length > 0
    ? await db
        .select({ taskId: taskAssigneesTable.taskId, userId: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
        .from(taskAssigneesTable)
        .innerJoin(usersTable, eq(taskAssigneesTable.userId, usersTable.id))
    : [];

  // Fetch tags for all tasks
  const taskTags = taskIds.length > 0
    ? await db
        .select({ taskId: taskTagsTable.taskId, tagId: tagsTable.id, label: tagsTable.label, color: tagsTable.color })
        .from(taskTagsTable)
        .innerJoin(tagsTable, eq(taskTagsTable.tagId, tagsTable.id))
    : [];

  // Fetch subtasks for all tasks
  const subtasks = taskIds.length > 0
    ? await db
        .select({ taskId: subtasksTable.taskId, completed: subtasksTable.completed })
        .from(subtasksTable)
        .where(inArray(subtasksTable.taskId, taskIds))
    : [];

  // Group by column
  const columnsWithTasks = columns.map(col => ({
    ...col,
    tasks: tasks
      .filter(t => t.columnId === col.id)
      .map(task => {
        const tSubtasks = subtasks.filter(s => s.taskId === task.id);
        const totalSubtasks = tSubtasks.length;
        const completedSubtasks = tSubtasks.filter(s => s.completed).length;
        return {
          ...task,
          assignees: assignees.filter(a => a.taskId === task.id),
          tags: taskTags.filter(t => t.taskId === task.id),
          subtaskCount: totalSubtasks,
          subtaskCompletedCount: completedSubtasks,
        };
      }),
  }));

  res.json({ columns: columnsWithTasks });
});

// ─── GET /api/projects/:id/stats ──────────────────────────────────────────────

router.get("/:id/stats", async (req: Request, res: Response) => {
  const id = req.params.id as string;

  // 1. Fetch columns
  const columns = await db
    .select()
    .from(columnsTable)
    .where(eq(columnsTable.projectId, id))
    .orderBy(asc(columnsTable.position));

  // 2. Fetch tasks
  const tasks = await db
    .select({
      id: tasksTable.id,
      columnId: tasksTable.columnId,
      priority: tasksTable.priority,
      dueDate: tasksTable.dueDate,
    })
    .from(tasksTable)
    .where(eq(tasksTable.projectId, id));

  const totalTasks = tasks.length;
  
  // Find completed columns (by title containing "conclu" case insensitive, or last column)
  const completedColumnIds = new Set<string>();
  if (columns.length > 0) {
    const lastColId = columns[columns.length - 1].id;
    for (const col of columns) {
      if (col.title.toLowerCase().includes("conclu") || col.id === lastColId) {
        completedColumnIds.add(col.id);
      }
    }
  }

  let completedTasks = 0;
  let overdueTasks = 0;
  
  const tasksByColumn: Record<string, { id: string, title: string, count: number }> = {};
  columns.forEach(col => {
    tasksByColumn[col.id] = { id: col.id, title: col.title, count: 0 };
  });

  const tasksByPriority: Record<string, number> = {
    low: 0,
    normal: 0,
    high: 0,
    urgent: 0
  };

  const now = new Date();

  tasks.forEach(task => {
    if (tasksByColumn[task.columnId]) {
      tasksByColumn[task.columnId].count++;
    }
    
    const isCompleted = completedColumnIds.has(task.columnId);
    if (isCompleted) {
      completedTasks++;
    }

    if (!isCompleted && task.dueDate && new Date(task.dueDate) < now) {
      overdueTasks++;
    }

    if (task.priority && tasksByPriority[task.priority] !== undefined) {
      tasksByPriority[task.priority]++;
    }
  });

  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  res.json({
    totalTasks,
    completedTasks,
    overdueTasks,
    completionPercentage,
    tasksByColumn: Object.values(tasksByColumn),
    tasksByPriority
  });
});

// ─── POST /api/projects/:id/columns ──────────────────────────────────────────
 
router.post("/:id/columns", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { title } = req.body;
  if (!title) { res.status(400).json({ error: "title is required" }); return; }

  const existing = await db.select({ pos: columnsTable.position }).from(columnsTable).where(eq(columnsTable.projectId, id)).orderBy(asc(columnsTable.position));
  const position = existing.length > 0 ? (existing[existing.length - 1]?.pos ?? 0) + 1 : 0;

  const [column] = await db.insert(columnsTable).values({ projectId: id, title, position }).returning();
  res.status(201).json({ column });
});

// ─── PUT /api/projects/:id ───────────────────────────────────────────────────

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isFavorite: z.boolean().optional(),
  status: z.string().optional(),
});

router.put("/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.color) updates.color = parsed.data.color;
  if (parsed.data.icon !== undefined) updates.icon = parsed.data.icon;
  if (parsed.data.isFavorite !== undefined) updates.isFavorite = parsed.data.isFavorite;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const [project] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, id)).returning();
  res.json({ project });
});

// ─── DELETE /api/projects/:id ────────────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.json({ success: true });
});

// ─── PUT /api/projects/:id/columns/:colId ────────────────────────────────────

router.put("/:id/columns/:colId", async (req: Request, res: Response) => {
  const colId = req.params.colId as string;
  const { title, position } = req.body;
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (position !== undefined) updates.position = position;

  const [col] = await db.update(columnsTable).set(updates).where(eq(columnsTable.id, colId)).returning();
  res.json({ column: col });
});

// ─── DELETE /api/projects/:id/columns/:colId ─────────────────────────────────

router.delete("/:id/columns/:colId", async (req: Request, res: Response) => {
  const colId = req.params.colId as string;
  await db.delete(columnsTable).where(eq(columnsTable.id, colId));
  res.json({ success: true });
});

// ─── PUT /api/projects/:id/columns-order ─────────────────────────────────────
// Reorder all columns at once: body = { columns: [{ id, title, position }] }

router.put("/:id/columns-order", async (req: Request, res: Response) => {
  const { columns } = req.body as { columns: { id: string; title: string; position: number }[] };
  if (!columns || !Array.isArray(columns)) { res.status(400).json({ error: "columns array required" }); return; }

  await Promise.all(
    columns.map(c =>
      db.update(columnsTable).set({ title: c.title, position: c.position }).where(eq(columnsTable.id, c.id))
    )
  );
  res.json({ success: true });
});

// ─── POST /api/projects/:id/tasks ────────────────────────────────────────────

const createTaskSchema = z.object({
  columnId: z.string().uuid(),
  title: z.string().optional().default(""),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
});

router.post("/:id/tasks", async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const id = req.params.id as string;
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", issues: parsed.error.issues }); return; }

  const { columnId, title, priority } = parsed.data;

  const existing = await db.select({ pos: tasksTable.position }).from(tasksTable).where(eq(tasksTable.columnId, columnId)).orderBy(asc(tasksTable.position));
  const position = existing.length > 0 ? (existing[existing.length - 1]?.pos ?? 0) + 1 : 0;

  const [task] = await db.insert(tasksTable).values({ columnId, projectId: id, title, priority, position, createdBy: userId }).returning();
  res.status(201).json({ task });
});

// ─── PATCH /api/projects/:projectId/tasks/:taskId ─────────────────────────────

const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().int().positive().nullable().optional(),
  columnId: z.string().uuid().optional(),
  coverImageUrl: z.string().nullable().optional(),
});

router.patch("/:projectId/tasks/:taskId", async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const { userId } = (req as AuthenticatedRequest).user;
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", issues: parsed.error.issues }); return; }

  // Get current state for activity log comparison
  const [currentTask] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (!currentTask) { res.status(404).json({ error: "Task not found" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.dueDate !== undefined) updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (parsed.data.estimatedHours !== undefined) updates.estimatedHours = parsed.data.estimatedHours;
  if (parsed.data.columnId !== undefined) updates.columnId = parsed.data.columnId;
  if (parsed.data.coverImageUrl !== undefined) updates.coverImageUrl = parsed.data.coverImageUrl;

  // Track activities
  const activitiesToLog: { taskId: string, userId: string, action: string, metadata: string }[] = [];

  if (updates.columnId && updates.columnId !== currentTask.columnId) {
    const [col] = await db.select({ title: columnsTable.title }).from(columnsTable).where(eq(columnsTable.id, updates.columnId as string)).limit(1);
    activitiesToLog.push({ taskId, userId, action: "moveu esta tarefa para", metadata: JSON.stringify({ target: col?.title || "Outra coluna" }) });
  }
  if (updates.title && updates.title !== currentTask.title) {
    activitiesToLog.push({ taskId, userId, action: "alterou o título", metadata: JSON.stringify({ old: currentTask.title, new: updates.title }) });
  }
  if (updates.description !== undefined && updates.description !== currentTask.description) {
    activitiesToLog.push({ taskId, userId, action: "atualizou a descrição", metadata: JSON.stringify({}) });
  }
  if (updates.priority && updates.priority !== currentTask.priority) {
    activitiesToLog.push({ taskId, userId, action: "alterou a prioridade", metadata: JSON.stringify({ old: currentTask.priority, new: updates.priority }) });
  }
  if (updates.estimatedHours !== undefined && updates.estimatedHours !== currentTask.estimatedHours) {
    activitiesToLog.push({ taskId, userId, action: "atualizou a estimativa de horas", metadata: JSON.stringify({ old: currentTask.estimatedHours, new: updates.estimatedHours }) });
  }
  if (updates.dueDate !== undefined && (updates.dueDate as Date)?.getTime() !== currentTask.dueDate?.getTime()) {
    activitiesToLog.push({ taskId, userId, action: "alterou o prazo de entrega", metadata: JSON.stringify({ old: currentTask.dueDate, new: updates.dueDate }) });
  }
  if (updates.coverImageUrl !== undefined && updates.coverImageUrl !== currentTask.coverImageUrl) {
    activitiesToLog.push({ taskId, userId, action: "alterou a imagem de capa", metadata: JSON.stringify({ old: currentTask.coverImageUrl, new: updates.coverImageUrl }) });
  }

  const [task] = await db.update(tasksTable).set(updates as any).where(eq(tasksTable.id, taskId)).returning();
  
  // Insert activity logs
  if (activitiesToLog.length > 0) {
    await db.insert(activityLogsTable).values(activitiesToLog);
  }

  res.json({ task });
});

// ─── DELETE /api/projects/:projectId/tasks/:taskId ────────────────────────────

router.delete("/:projectId/tasks/:taskId", async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;

  // Delete related data first (cascade order)
  await db.delete(taskAssigneesTable).where(eq(taskAssigneesTable.taskId, taskId));
  await db.delete(taskTagsTable).where(eq(taskTagsTable.taskId, taskId));
  await db.delete(subtasksTable).where(eq(subtasksTable.taskId, taskId));
  await db.delete(commentsTable).where(eq(commentsTable.taskId, taskId));
  await db.delete(activityLogsTable).where(eq(activityLogsTable.taskId, taskId));
  await db.delete(tasksTable).where(eq(tasksTable.id, taskId));

  res.json({ success: true });
});

// ─── GET /api/projects/:projectId/tasks/:taskId (full detail) ─────────────────

router.get("/:projectId/tasks/:taskId", async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const taskId = req.params.taskId as string;

  const [task] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.projectId, projectId))).limit(1);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  // Column info
  const [column] = await db.select({ id: columnsTable.id, title: columnsTable.title }).from(columnsTable).where(eq(columnsTable.id, task.columnId)).limit(1);

  // All columns of this project (for funil dropdown)
  const projectColumns = await db.select({ id: columnsTable.id, title: columnsTable.title, position: columnsTable.position }).from(columnsTable).where(eq(columnsTable.projectId, projectId)).orderBy(asc(columnsTable.position));

  // Assignees
  const assignees = await db
    .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
    .from(taskAssigneesTable)
    .innerJoin(usersTable, eq(taskAssigneesTable.userId, usersTable.id))
    .where(eq(taskAssigneesTable.taskId, taskId));

  // Tags
  const tags = await db
    .select({ id: tagsTable.id, label: tagsTable.label, color: tagsTable.color })
    .from(taskTagsTable)
    .innerJoin(tagsTable, eq(taskTagsTable.tagId, tagsTable.id))
    .where(eq(taskTagsTable.taskId, taskId));

  // Creator
  const [creator] = await db.select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(eq(usersTable.id, task.createdBy)).limit(1);

  // Subtasks
  const subtasks = await db.select().from(subtasksTable).where(eq(subtasksTable.taskId, taskId)).orderBy(asc(subtasksTable.position));

  res.json({ task, column, columns: projectColumns, assignees, tags, creator, subtasks });
});

// ─── POST /api/projects/:projectId/tasks/:taskId/assignees ────────────────────

router.post("/:projectId/tasks/:taskId/assignees", async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const { userId } = req.body;
  if (!userId) { res.status(400).json({ error: "userId is required" }); return; }

  // Prevent duplicate
  const existing = await db.select({ id: taskAssigneesTable.id }).from(taskAssigneesTable).where(and(eq(taskAssigneesTable.taskId, taskId), eq(taskAssigneesTable.userId, userId))).limit(1);
  if (existing.length > 0) { res.status(409).json({ error: "Already assigned" }); return; }

  await db.insert(taskAssigneesTable).values({ taskId, userId });
  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  res.status(201).json({ assignee: user });
});

// ─── DELETE /api/projects/:projectId/tasks/:taskId/assignees/:userId ──────────

router.delete("/:projectId/tasks/:taskId/assignees/:userId", async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const userId = req.params.userId as string;
  await db.delete(taskAssigneesTable).where(and(eq(taskAssigneesTable.taskId, taskId), eq(taskAssigneesTable.userId, userId)));
  res.status(204).end();
});

// ─── POST /api/projects/:projectId/tasks/:taskId/tags ────────────────────────

router.post("/:projectId/tasks/:taskId/tags", async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const { tagId } = req.body;
  if (!tagId) { res.status(400).json({ error: "tagId is required" }); return; }

  const existing = await db.select({ id: taskTagsTable.id }).from(taskTagsTable).where(and(eq(taskTagsTable.taskId, taskId), eq(taskTagsTable.tagId, tagId))).limit(1);
  if (existing.length > 0) { res.status(409).json({ error: "Tag already added" }); return; }

  await db.insert(taskTagsTable).values({ taskId, tagId });
  res.status(201).json({ success: true });
});

// ─── DELETE /api/projects/:projectId/tasks/:taskId/tags/:tagId ───────────────

router.delete("/:projectId/tasks/:taskId/tags/:tagId", async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const tagId = req.params.tagId as string;
  await db.delete(taskTagsTable).where(and(eq(taskTagsTable.taskId, taskId), eq(taskTagsTable.tagId, tagId)));
  res.status(204).end();
});

// ─── GET /api/projects/:id/tags ───────────────────────────────────────────────

router.get("/:id/tags", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tags = await db.select().from(tagsTable).where(eq(tagsTable.projectId, id)).orderBy(asc(tagsTable.createdAt));
  res.json({ tags });
});

// ─── POST /api/projects/:id/tags ──────────────────────────────────────────────

const createTagSchema = z.object({
  label: z.string().min(1).max(40),
  color: z.enum(["purple", "yellow", "gray", "blue", "pink", "red"]).optional().default("gray"),
});

router.post("/:id/tags", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parsed = createTagSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", issues: parsed.error.issues }); return; }

  const [tag] = await db.insert(tagsTable).values({ projectId: id, label: parsed.data.label, color: parsed.data.color }).returning();
  res.status(201).json({ tag });
});

// ─── PUT /api/projects/:id/tags/:tagId ───────────────────────────────────────

const updateTagSchema = z.object({
  label: z.string().min(1).max(40).optional(),
  color: z.enum(["purple", "yellow", "gray", "blue", "pink", "red"]).optional(),
});

router.put("/:id/tags/:tagId", async (req: Request, res: Response) => {
  const tagId = req.params.tagId as string;
  const parsed = updateTagSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed" }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.label !== undefined) updates.label = parsed.data.label;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;

  const [tag] = await db.update(tagsTable).set(updates as any).where(eq(tagsTable.id, tagId)).returning();
  res.json({ tag });
});

// ─── DELETE /api/projects/:id/tags/:tagId ────────────────────────────────────

router.delete("/:id/tags/:tagId", async (req: Request, res: Response) => {
  const tagId = req.params.tagId as string;
  await db.delete(tagsTable).where(eq(tagsTable.id, tagId));
  res.json({ success: true });
});

// ─── GET /api/projects/:id/members ───────────────────────────────────────────
// Returns all members of the workspace that owns this project

router.get("/:id/members", async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const [project] = await db.select({ workspaceId: projectsTable.workspaceId }).from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const members = await db
    .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl, role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
    .where(eq(workspaceMembersTable.workspaceId, project.workspaceId))
    .orderBy(asc(usersTable.name));

  res.json({ members });
});

// ─── POST /api/projects/:projectId/tasks/:taskId/move ─────────────────────────

const moveTaskSchema = z.object({
  targetColumnId: z.string().uuid(),
  targetIndex: z.number().int().min(0),
});

router.post("/:projectId/tasks/:taskId/move", async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const parsed = moveTaskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", issues: parsed.error.issues }); return; }

  const { targetColumnId, targetIndex } = parsed.data;

  // Get all tasks in target column (excluding the moved task)
  const columnTasks = await db
    .select({ id: tasksTable.id, position: tasksTable.position })
    .from(tasksTable)
    .where(eq(tasksTable.columnId, targetColumnId))
    .orderBy(asc(tasksTable.position));

  const filtered = columnTasks.filter(t => t.id !== taskId);
  filtered.splice(targetIndex, 0, { id: taskId, position: targetIndex });

  // Batch update positions
  await Promise.all(
    filtered.map((t, i) =>
      db.update(tasksTable).set({ position: i, columnId: targetColumnId, updatedAt: new Date() }).where(eq(tasksTable.id, t.id))
    )
  );

  res.json({ success: true });
});

// ─── POST /api/projects/seed-teltech ─────────────────────────────────────────

router.post("/seed-teltech", async (req: Request, res: Response): Promise<void> => {
  const { usersTable, workspacesTable, projectsTable, columnsTable, tasksTable, tagsTable, taskTagsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@workspace/db");

  // 1. Get workspace "Teltech"
  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.name, "Teltech")).limit(1);
  if (!ws) { res.status(404).json({ error: "Teltech workspace not found." }); return; }

  // 2. Get user to assign as owner
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, "tarcisio@teltech.com.br")).limit(1);
  if (!user) { res.status(404).json({ error: "User tarcisio not found." }); return; }

  // 3. Create or get "Teltech" project
  let [project] = await db.select().from(projectsTable).where(eq(projectsTable.name, "Teltech")).limit(1);
  if (!project) {
    [project] = await db.insert(projectsTable).values({
      workspaceId: ws.id, name: "Teltech", color: "#4f2d8a", createdBy: user.id
    }).returning();
  } else {
    await db.delete(columnsTable).where(eq(columnsTable.projectId, project.id));
  }

  // 4. Create columns
  const colsData = [
    { title: "Sem Título", pos: 0 }, { title: "A Fazer", pos: 1 },
    { title: "Em Andamento", pos: 2 }, { title: "Revisão", pos: 3 }, { title: "Concluído", pos: 4 }
  ];
  const cols = [];
  for (const c of colsData) {
    const [col] = await db.insert(columnsTable).values({ projectId: project.id, title: c.title, position: c.pos }).returning();
    cols.push(col);
  }

  // 5. Create tags
  const tagsToCreate = [
    { label: "QA", color: "blue" as const }, { label: "UX/UI", color: "purple" as const },
    { label: "Sem cobrança", color: "gray" as const }, { label: "Gestão", color: "pink" as const }, { label: "Marketing", color: "yellow" as const }
  ];
  for (const t of tagsToCreate) {
    const existing = await db.select().from(tagsTable).where(and(eq(tagsTable.projectId, project.id), eq(tagsTable.label, t.label))).limit(1);
    if (existing.length === 0) await db.insert(tagsTable).values({ projectId: project.id, label: t.label, color: t.color });
  }
  const allTags = await db.select().from(tagsTable).where(eq(tagsTable.projectId, project.id));
  const tagMap = new Map(allTags.map(t => [t.label, t.id]));

  // 6. Create tasks
  const TASKS_MOCK = [
    { colIdx: 0, title: "Testes (Páginas da Plataforma)", est: 0, tags: ["QA"] },
    { colIdx: 0, title: "StrataScratch - Apresentação Dribbble (Versão #4)", est: 8, tags: ["UX/UI", "Sem cobrança"] },
    { colIdx: 0, title: "Coletar feedback de clientes do Clutch", est: 0, tags: [] },
    { colIdx: 0, title: "Retrospectiva do projeto", est: 2, tags: ["Gestão"] },
    { colIdx: 1, title: "StrataScratch - Post para Instagram", est: 1, tags: ["UX/UI", "Marketing", "Sem cobrança"] },
    { colIdx: 1, title: "StrataScratch - Nova Página de Preços", est: 3, tags: ["UX/UI"] },
    { colIdx: 1, title: "StrataScratch - Anúncios Display (#3)", est: 8, tags: ["UX/UI", "Marketing"] },
    { colIdx: 2, title: "StrataScratch - Apresentação Behance", est: 30, tags: ["UX/UI", "Sem cobrança"] },
    { colIdx: 2, title: "StrataScratch - Anúncios Display (#2)", est: 4, tags: ["UX/UI", "Marketing"] },
    { colIdx: 2, title: "Strata Scratch - Animação para tela de carregamento", est: 1, tags: ["UX/UI"] },
    { colIdx: 3, title: "StrataScratch - Anúncios Display", est: 8, tags: ["UX/UI", "Marketing"] },
    { colIdx: 3, title: "StrataScratch - Apresentação Dribbble (Versão #3)", est: 3, tags: ["UX/UI", "Sem cobrança"] },
    { colIdx: 4, title: "Nova página inicial do site", est: 8, tags: ["UX/UI"] },
    { colIdx: 4, title: "Corrigir e testar no Zeplin", est: 3, tags: ["QA"] },
    { colIdx: 4, title: "Corrigir bug no mobile", est: 2, tags: ["QA"] },
  ];

  let posCounter = 0;
  let lastColIdx = 0;
  for (const tm of TASKS_MOCK) {
    if (tm.colIdx !== lastColIdx) { posCounter = 0; lastColIdx = tm.colIdx; }
    const col = cols[tm.colIdx];
    const [task] = await db.insert(tasksTable).values({
      projectId: project.id, columnId: col.id, title: tm.title, position: posCounter++,
      estimatedHours: tm.est > 0 ? tm.est : null, createdBy: user.id
    }).returning();

    for (const tl of tm.tags) {
      const tagId = tagMap.get(tl);
      if (tagId) await db.insert(taskTagsTable).values({ taskId: task.id, tagId });
    }
  }

  res.json({ success: true, project });
});

// ─── GET /api/projects/:id/files ──────────────────────────────────────────────

router.get("/:id/files", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  
  // Get all tasks for this project
  const tasks = await db.select({ id: tasksTable.id, title: tasksTable.title })
    .from(tasksTable)
    .where(eq(tasksTable.projectId, id));
    
  if (tasks.length === 0) {
    res.json({ files: [] });
    return;
  }
  
  const taskIds = tasks.map(t => t.id);
  const taskMap = new Map(tasks.map(t => [t.id, t.title]));
  
  const attachments = await db
    .select({
      id: taskAttachmentsTable.id,
      taskId: taskAttachmentsTable.taskId,
      fileName: taskAttachmentsTable.fileName,
      fileUrl: taskAttachmentsTable.fileUrl,
      fileSize: taskAttachmentsTable.fileSize,
      fileType: taskAttachmentsTable.fileType,
      createdAt: taskAttachmentsTable.createdAt,
      userId: taskAttachmentsTable.userId,
      uploadedBy: usersTable.name
    })
    .from(taskAttachmentsTable)
    .innerJoin(usersTable, eq(taskAttachmentsTable.userId, usersTable.id))
    .where(inArray(taskAttachmentsTable.taskId, taskIds))
    .orderBy(asc(taskAttachmentsTable.createdAt));
    
  const files = attachments.map(a => ({
    ...a,
    taskTitle: taskMap.get(a.taskId) || "Tarefa desconhecida"
  }));
  
  res.json({ files });
});

// ─── GET /api/projects/:id/messages ───────────────────────────────────────────

router.get("/:id/messages", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  
  const messages = await db
    .select({
      id: projectMessagesTable.id,
      body: projectMessagesTable.body,
      createdAt: projectMessagesTable.createdAt,
      user: {
        id: usersTable.id,
        name: usersTable.name,
        avatarUrl: usersTable.avatarUrl
      }
    })
    .from(projectMessagesTable)
    .innerJoin(usersTable, eq(projectMessagesTable.userId, usersTable.id))
    .where(eq(projectMessagesTable.projectId, id))
    .orderBy(asc(projectMessagesTable.createdAt));
    
  res.json({ messages });
});

// ─── POST /api/projects/:id/messages ──────────────────────────────────────────

const createProjectMessageSchema = z.object({
  body: z.string().min(1)
});

router.post("/:id/messages", async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const id = req.params.id as string;
  
  const parsed = createProjectMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }
  
  const [message] = await db.insert(projectMessagesTable).values({
    projectId: id,
    userId,
    body: parsed.data.body
  }).returning();
  
  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
    
  res.status(201).json({ message: { ...message, user } });
});

export default router;
