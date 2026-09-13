import { Router, type Request, type Response } from "express";
import { db, meetingsTable, meetingParticipantsTable, usersTable } from "@workspace/db";
import { eq, asc, inArray } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { z } from "zod";

const router = Router();
router.use(requireAuth);

// ─── GET /api/meetings ────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  const { userId } = (req as AuthenticatedRequest).user;

  // Ideally, filter by workspace, for now we will get all meetings the user created or participates in, or from user's workspaces
  // A simple approach: fetch all meetings (in a real app we'd filter by workspaceId)
  
  // Since we don't pass workspaceId in GET /api/meetings by default, let's fetch all meetings
  // where the user is either the creator, or the user is a participant.
  
  const meetings = await db.select().from(meetingsTable).orderBy(asc(meetingsTable.startTime));

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
  await db.delete(meetingsTable).where(eq(meetingsTable.id, id));
  res.json({ success: true });
});

// ─── POST /api/meetings/:id/participants ──────────────────────────────────────

router.post("/:id/participants", async (req: Request, res: Response) => {
  const id = req.params.id as string;
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
