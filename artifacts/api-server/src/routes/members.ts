import { Router, type IRouter } from "express";
import { db, usersTable, workspaceMembersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "../lib/auth";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

// ─── List all members ─────────────────────────────────────────────────────────

router.get("/", requireAuth, async (_req, res) => {
  const members = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      avatarUrl: usersTable.avatarUrl,
      phone: usersTable.phone,
      mustChangePassword: usersTable.mustChangePassword,
      createdAt: usersTable.createdAt,
      role: workspaceMembersTable.role,
    })
    .from(usersTable)
    .leftJoin(workspaceMembersTable, eq(usersTable.id, workspaceMembersTable.userId))
    .orderBy(usersTable.createdAt);

  res.json({ members });
});

// ─── Get single member ────────────────────────────────────────────────────────

router.get("/:id", requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const [member] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      avatarUrl: usersTable.avatarUrl,
      phone: usersTable.phone,
      mustChangePassword: usersTable.mustChangePassword,
      createdAt: usersTable.createdAt,
      role: workspaceMembersTable.role,
    })
    .from(usersTable)
    .leftJoin(workspaceMembersTable, eq(usersTable.id, workspaceMembersTable.userId))
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json({ member });
});

// ─── Create member ────────────────────────────────────────────────────────────

const createMemberSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(["owner", "admin", "member", "viewer", "ceo", "cto", "cmo"]).default("member"),
  mustChangePassword: z.boolean().default(false),
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const { name, email, password, phone, role, mustChangePassword } = parsed.data;

  // Check if email already exists
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Conflict", message: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash, phone: phone ?? null, mustChangePassword })
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });

  // Get workspace (first one available)
  const [ws] = await db
    .select({ id: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, (req as AuthenticatedRequest).user.userId))
    .limit(1);

  if (ws) {
    await db.insert(workspaceMembersTable).values({
      workspaceId: ws.id,
      userId: user.id,
      role,
    });
  }

  res.status(201).json({ member: { ...user, role, phone, mustChangePassword } });
});

// ─── Update member ────────────────────────────────────────────────────────────

const updateMemberSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(["owner", "admin", "member", "viewer", "ceo", "cto", "cmo"]).optional(),
  mustChangePassword: z.boolean().optional(),
});

router.put("/:id", requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const parsed = updateMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const { name, email, phone, role, mustChangePassword } = parsed.data;

  // Check if user exists
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  // Check email uniqueness if changing
  if (email) {
    const [emailTaken] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (emailTaken && emailTaken.id !== id) {
      res.status(409).json({ error: "Conflict", message: "Email already in use" });
      return;
    }
  }

  // Update user fields
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (mustChangePassword !== undefined) updates.mustChangePassword = mustChangePassword;
  updates.updatedAt = sql`now()`;

  if (Object.keys(updates).length > 1) {
    await db.update(usersTable).set(updates).where(eq(usersTable.id, id));
  }

  // Update role if provided
  if (role) {
    await db
      .update(workspaceMembersTable)
      .set({ role })
      .where(eq(workspaceMembersTable.userId, id));
  }

  // Return updated member
  const [member] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      avatarUrl: usersTable.avatarUrl,
      phone: usersTable.phone,
      mustChangePassword: usersTable.mustChangePassword,
      role: workspaceMembersTable.role,
    })
    .from(usersTable)
    .leftJoin(workspaceMembersTable, eq(usersTable.id, workspaceMembersTable.userId))
    .where(eq(usersTable.id, id))
    .limit(1);

  res.json({ member });
});

// ─── Change password ──────────────────────────────────────────────────────────

const changePasswordSchema = z.object({
  password: z.string().min(1),
});

router.put("/:id/password", requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db
    .update(usersTable)
    .set({ passwordHash, mustChangePassword: false, updatedAt: sql`now()` })
    .where(eq(usersTable.id, id));

  res.json({ success: true });
});

// ─── Update avatar ────────────────────────────────────────────────────────────

const avatarSchema = z.object({
  avatarUrl: z.string().url().nullable(),
});

router.put("/:id/avatar", requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const parsed = avatarSchema.safeParse(req.body);
  if (!parsed.success) {
    // Also accept base64 data URLs
    const body = req.body as { avatarUrl?: string };
    if (body.avatarUrl && (body.avatarUrl.startsWith("data:image") || body.avatarUrl === null)) {
      await db
        .update(usersTable)
        .set({ avatarUrl: body.avatarUrl, updatedAt: sql`now()` })
        .where(eq(usersTable.id, id));
      res.json({ success: true, avatarUrl: body.avatarUrl });
      return;
    }
    res.status(400).json({ error: "Invalid avatar URL" });
    return;
  }

  await db
    .update(usersTable)
    .set({ avatarUrl: parsed.data.avatarUrl, updatedAt: sql`now()` })
    .where(eq(usersTable.id, id));

  res.json({ success: true, avatarUrl: parsed.data.avatarUrl });
});

// ─── Delete member ────────────────────────────────────────────────────────────

router.delete("/:id", requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  // Don't allow self-delete
  if (existing.id === (req as AuthenticatedRequest).user.userId) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }

  await db.delete(workspaceMembersTable).where(eq(workspaceMembersTable.userId, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));

  res.json({ success: true });
});

export default router;
