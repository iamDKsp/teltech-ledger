import { Router, type IRouter } from "express";
import { db, commentsTable, subtasksTable, activityLogsTable, usersTable, tasksTable, taskTimersTable, commentLikesTable, taskAttachmentsTable, columnsTable, projectsTable, taskAssigneesTable } from "@workspace/db";
import { eq, asc, isNull, sql, inArray, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { z } from "zod";
import { type Request, type Response } from "express";

const router: IRouter = Router();
router.use(requireAuth);

// ─── GET /api/tasks/my-tasks ──────────────────────────────────────────────────

router.get("/my-tasks", async (req: Request, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;

    const tasks = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        columnTitle: columnsTable.title,
        projectName: projectsTable.name,
        projectColor: projectsTable.color,
        projectId: projectsTable.id,
      })
      .from(taskAssigneesTable)
      .innerJoin(tasksTable, eq(taskAssigneesTable.taskId, tasksTable.id))
      .innerJoin(columnsTable, eq(tasksTable.columnId, columnsTable.id))
      .innerJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .where(eq(taskAssigneesTable.userId, userId))
      .orderBy(sql`${tasksTable.dueDate} ASC NULLS LAST`);

    if (tasks.length === 0) {
      res.json({ tasks: [] }); return;
    }

    const taskIds = tasks.map(t => t.id);
    const subtasks = await db.select().from(subtasksTable).where(inArray(subtasksTable.taskId, taskIds));

    const enrichedTasks = tasks.map(t => {
      const taskSubtasks = subtasks.filter(s => s.taskId === t.id);
      return {
        ...t,
        subtasksTotal: taskSubtasks.length,
        subtasksCompleted: taskSubtasks.filter(s => s.completed).length,
      };
    });

    res.json({ tasks: enrichedTasks });
  } catch (err) {
    console.error("my-tasks error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json({ task });
});

// ─── GET /api/tasks/:id/comments ─────────────────────────────────────────────

router.get("/:id/comments", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { userId } = (req as AuthenticatedRequest).user;
  
  const comments = await db
    .select({
      id: commentsTable.id,
      body: commentsTable.body,
      attachmentUrl: commentsTable.attachmentUrl,
      createdAt: commentsTable.createdAt,
      updatedAt: commentsTable.updatedAt,
      user: { id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl },
    })
    .from(commentsTable)
    .innerJoin(usersTable, eq(commentsTable.userId, usersTable.id))
    .where(eq(commentsTable.taskId, id))
    .orderBy(asc(commentsTable.createdAt));
    
  // Fetch likes for these comments
  const commentIds = comments.map(c => c.id);
  let likes: any[] = [];
  if (commentIds.length > 0) {
    likes = await db.select().from(commentLikesTable).where(inArray(commentLikesTable.commentId, commentIds));
  }

  const enrichedComments = comments.map(c => {
    const commentLikes = likes.filter(l => l.commentId === c.id);
    const likeCount = commentLikes.filter(l => l.isLike).length;
    const dislikeCount = commentLikes.filter(l => !l.isLike).length;
    const userLike = commentLikes.find(l => l.userId === userId);
    return {
      ...c,
      likes: likeCount,
      dislikes: dislikeCount,
      userVote: userLike ? (userLike.isLike ? "like" : "dislike") : null,
    };
  });

  res.json({ comments: enrichedComments });
});

// ─── POST /api/tasks/:id/comments ────────────────────────────────────────────

router.post("/:id/comments", async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const id = req.params.id as string;
  const { body, attachmentUrl } = req.body;
  if (!body?.trim() && !attachmentUrl) { res.status(400).json({ error: "body or attachment is required" }); return; }

  const [comment] = await db.insert(commentsTable).values({ taskId: id, userId, body: body?.trim() || "", attachmentUrl: attachmentUrl || null }).returning();

  // Log activity
  await db.insert(activityLogsTable).values({ taskId: id, userId, action: "added_comment", metadata: JSON.stringify({ commentId: comment.id }) });

  res.status(201).json({ comment });
});

// ─── DELETE /api/tasks/:id/comments/:commentId ───────────────────────────────

router.delete("/:id/comments/:commentId", async (req: Request, res: Response) => {
  const commentId = req.params.commentId as string;
  await db.delete(commentsTable).where(eq(commentsTable.id, commentId));
  res.status(204).end();
});

// ─── POST /api/tasks/:id/comments/:commentId/like ────────────────────────────

router.post("/:id/comments/:commentId/like", async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const commentId = req.params.commentId as string;
  const { isLike } = req.body; // boolean: true for like, false for dislike, null to remove

  if (isLike === null) {
    await db.delete(commentLikesTable).where(sql`${commentLikesTable.commentId} = ${commentId} AND ${commentLikesTable.userId} = ${userId}`);
  } else {
    const existing = await db.select().from(commentLikesTable).where(sql`${commentLikesTable.commentId} = ${commentId} AND ${commentLikesTable.userId} = ${userId}`);
    if (existing.length > 0) {
      await db.update(commentLikesTable).set({ isLike }).where(eq(commentLikesTable.id, existing[0].id));
    } else {
      await db.insert(commentLikesTable).values({ commentId, userId, isLike });
    }
  }

  res.json({ success: true });
});

// ─── GET /api/tasks/:id/subtasks ─────────────────────────────────────────────

router.get("/:id/subtasks", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const subtasks = await db.select().from(subtasksTable).where(eq(subtasksTable.taskId, id)).orderBy(asc(subtasksTable.position));
  res.json({ subtasks });
});

// ─── POST /api/tasks/:id/subtasks ────────────────────────────────────────────

router.post("/:id/subtasks", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { title } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }

  const existing = await db.select({ pos: subtasksTable.position }).from(subtasksTable).where(eq(subtasksTable.taskId, id)).orderBy(asc(subtasksTable.position));
  const position = existing.length > 0 ? (existing[existing.length - 1]?.pos ?? 0) + 1 : 0;

  const [subtask] = await db.insert(subtasksTable).values({ taskId: id, title: title.trim(), position }).returning();
  res.status(201).json({ subtask });
});

// ─── PATCH /api/tasks/:id/subtasks/:subtaskId ────────────────────────────────

router.patch("/:id/subtasks/:subtaskId", async (req: Request, res: Response) => {
  const subtaskId = req.params.subtaskId as string;
  const { title, completed } = req.body;
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (completed !== undefined) updates.completed = completed;
  const [subtask] = await db.update(subtasksTable).set(updates as any).where(eq(subtasksTable.id, subtaskId)).returning();
  res.json({ subtask });
});

// ─── DELETE /api/tasks/:id/subtasks/:subtaskId ───────────────────────────────

router.delete("/:id/subtasks/:subtaskId", async (req: Request, res: Response) => {
  const subtaskId = req.params.subtaskId as string;
  await db.delete(subtasksTable).where(eq(subtasksTable.id, subtaskId));
  res.status(204).end();
});

// ─── GET /api/tasks/:id/activities ───────────────────────────────────────────

router.get("/:id/activities", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const activities = await db
    .select({
      id: activityLogsTable.id,
      action: activityLogsTable.action,
      metadata: activityLogsTable.metadata,
      createdAt: activityLogsTable.createdAt,
      user: { id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl },
    })
    .from(activityLogsTable)
    .innerJoin(usersTable, eq(activityLogsTable.userId, usersTable.id))
    .where(eq(activityLogsTable.taskId, id))
    .orderBy(asc(activityLogsTable.createdAt));
  res.json({ activities });
});

// ─── Timer: POST /api/tasks/:id/timer/start ──────────────────────────────────

router.post("/:id/timer/start", async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const id = req.params.id as string;

  // Stop any running timer first
  await db
    .update(taskTimersTable)
    .set({
      stoppedAt: new Date(),
      durationSeconds: sql`EXTRACT(EPOCH FROM (NOW() - started_at))::int`,
    })
    .where(and(eq(taskTimersTable.taskId, id), isNull(taskTimersTable.stoppedAt)));

  const [timer] = await db.insert(taskTimersTable).values({ taskId: id, userId }).returning();
  res.status(201).json({ timer });
});

// ─── Timer: POST /api/tasks/:id/timer/stop ───────────────────────────────────

router.post("/:id/timer/stop", async (req: Request, res: Response) => {
  const id = req.params.id as string;

  await db
    .update(taskTimersTable)
    .set({
      stoppedAt: new Date(),
      durationSeconds: sql`EXTRACT(EPOCH FROM (NOW() - started_at))::int`,
    })
    .where(and(eq(taskTimersTable.taskId, id), isNull(taskTimersTable.stoppedAt)));

  // Return total time
  const timers = await db.select({ duration: taskTimersTable.durationSeconds }).from(taskTimersTable).where(eq(taskTimersTable.taskId, id));
  const totalSeconds = timers.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  res.json({ stopped: true, totalSeconds });
});

// ─── GET /api/tasks/:id/timer ─────────────────────────────────────────────────

router.get("/:id/timer", async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const timers = await db.select().from(taskTimersTable).where(eq(taskTimersTable.taskId, id)).orderBy(asc(taskTimersTable.startedAt));
  const running = timers.find(t => !t.stoppedAt) ?? null;
  const totalSeconds = timers.filter(t => t.durationSeconds).reduce((sum, t) => sum + (t.durationSeconds ?? 0), 0);

  res.json({ running, totalSeconds, entries: timers });
});

// ─── GET /api/tasks/:id/attachments ──────────────────────────────────────────

router.get("/:id/attachments", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const attachments = await db.select().from(taskAttachmentsTable).where(eq(taskAttachmentsTable.taskId, id)).orderBy(asc(taskAttachmentsTable.createdAt));
  res.json({ attachments });
});

// ─── POST /api/tasks/:id/attachments ─────────────────────────────────────────

router.post("/:id/attachments", async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const id = req.params.id as string;
  const { fileName, fileUrl, fileType } = req.body;
  if (!fileName || !fileUrl || !fileType) {
    res.status(400).json({ error: "fileName, fileUrl, and fileType are required" });
    return;
  }
  const [attachment] = await db.insert(taskAttachmentsTable).values({
    taskId: id,
    userId,
    fileName,
    fileUrl,
    fileType,
  }).returning();

  // Log activity
  await db.insert(activityLogsTable).values({
    taskId: id,
    userId,
    action: "anexou o arquivo",
    metadata: JSON.stringify({ target: fileName }),
  });

  res.status(201).json({ attachment });
});

export default router;
