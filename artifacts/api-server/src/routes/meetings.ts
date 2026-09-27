import { Router, type Request, type Response } from "express";
import { db, meetingsTable, meetingParticipantsTable, usersTable, workspaceMembersTable } from "@workspace/db";
import { eq, asc, inArray, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { z } from "zod";

const router = Router();
router.use(requireAuth);

async function getMeetingAccess(meetingId: string, userId: string) {
  const [meeting] = await db
    .select()
    .from(meetingsTable)
    .where(eq(meetingsTable.id, meetingId))
    .limit(1);

  if (!meeting) return { status: 404, error: "Reunião não encontrada." } as const;

  const [membership] = await db
    .select({ id: workspaceMembersTable.id, role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, meeting.workspaceId), eq(workspaceMembersTable.userId, userId)))
    .limit(1);

  if (!membership) return { status: 403, error: "Sem acesso a esta reunião." } as const;

  return { status: 200, meeting, membership } as const;
}

// ─── GET /api/meetings ────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;

  // Workspaces user belongs to
  const memberships = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId));

  const wsIds = memberships.map(m => m.workspaceId);
  if (wsIds.length === 0) {
    res.json({ meetings: [] });
    return;
  }

  const meetings = await db
    .select()
    .from(meetingsTable)
    .where(inArray(meetingsTable.workspaceId, wsIds))
    .orderBy(asc(meetingsTable.startTime));

  if (meetings.length === 0) {
    res.json({ meetings: [] });
    return;
  }

  const meetingIds = meetings.map(m => m.id);

  const participants = await db
    .select({
      meetingId: meetingParticipantsTable.meetingId,
      user: {
        id: usersTable.id,
        name: usersTable.name,
        avatarUrl: usersTable.avatarUrl
      }
    })
    .from(meetingParticipantsTable)
    .innerJoin(usersTable, eq(meetingParticipantsTable.userId, usersTable.id))
    .where(inArray(meetingParticipantsTable.meetingId, meetingIds));

  const meetingsWithParticipants = meetings.map(m => ({
    ...m,
    participants: participants.filter(p => p.meetingId === m.id).map(p => p.user)
  }));

  res.json({ meetings: meetingsWithParticipants });
});

// ─── POST /api/meetings ───────────────────────────────────────────────────────

const createMeetingSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional(),
  color: z.string().optional()
});

router.post("/", async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;
  
  const parsed = createMeetingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }
  
  const data = parsed.data;

  // Check that the user belongs to the requested workspace
  const [membership] = await db
    .select({ id: workspaceMembersTable.id })
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, data.workspaceId), eq(workspaceMembersTable.userId, userId)))
    .limit(1);

  if (!membership) {
    res.status(403).json({ error: "Forbidden", message: "Usuário não pertence ao workspace informado." });
    return;
  }
  
  const [meeting] = await db.insert(meetingsTable).values({
    workspaceId: data.workspaceId,
    title: data.title,
    description: data.description,
    startTime: new Date(data.startTime),
    endTime: new Date(data.endTime),
    location: data.location,
    color: data.color || "purple",
    createdBy: userId
  }).returning();
  
  // Add creator as participant by default
  await db.insert(meetingParticipantsTable).values({
    meetingId: meeting.id,
    userId
  });

  const [creatorUser] = await db.select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  res.status(201).json({ meeting: { ...meeting, participants: [creatorUser] } });
});

// ─── PUT /api/meetings/:id ────────────────────────────────────────────────────

const updateMeetingSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  location: z.string().optional(),
  color: z.string().optional()
});

router.put("/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { userId } = (req as AuthenticatedRequest).user;
  const access = await getMeetingAccess(id, userId);
  if (access.status !== 200) { res.status(access.status).json({ error: access.error }); return; }

  const parsed = updateMeetingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.startTime !== undefined) updates.startTime = new Date(parsed.data.startTime);
  if (parsed.data.endTime !== undefined) updates.endTime = new Date(parsed.data.endTime);
  if (parsed.data.location !== undefined) updates.location = parsed.data.location;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;
  
  const [meeting] = await db.update(meetingsTable).set(updates).where(eq(meetingsTable.id, id)).returning();
  res.json({ meeting });
});

// ─── DELETE /api/meetings/:id ─────────────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { userId } = (req as AuthenticatedRequest).user;
  const access = await getMeetingAccess(id, userId);
  if (access.status !== 200) { res.status(access.status).json({ error: access.error }); return; }

  await db.delete(meetingParticipantsTable).where(eq(meetingParticipantsTable.meetingId, id));
  await db.delete(meetingsTable).where(eq(meetingsTable.id, id));
  res.json({ success: true });
});

// ─── POST /api/meetings/:id/participants ──────────────────────────────────────

router.post("/:id/participants", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { userId: requestingUserId } = (req as AuthenticatedRequest).user;
  const access = await getMeetingAccess(id, requestingUserId);
  if (access.status !== 200) { res.status(access.status).json({ error: access.error }); return; }

  const { userId } = req.body;
  
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  
  const existing = await db.select().from(meetingParticipantsTable).where(
    eq(meetingParticipantsTable.meetingId, id)
  );
  
  if (existing.some(p => p.userId === userId)) {
    res.status(409).json({ error: "Already participant" });
    return;
  }
  
  await db.insert(meetingParticipantsTable).values({
    meetingId: id,
    userId
  });
  
  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
    
  res.status(201).json({ participant: user });
});

export default router;
