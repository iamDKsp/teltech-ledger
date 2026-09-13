import { Router, type IRouter } from "express";
import { db, usersTable, workspacesTable, workspaceMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken } from "../lib/auth";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/public/users", async (req, res) => {
  const users = await db
    .select({ email: usersTable.email, avatarUrl: usersTable.avatarUrl })
    .from(usersTable);
  res.json({ users });
});


// ─── Register ─────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password required"),
  workspaceName: z.string().min(2, "Workspace name required").optional(),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const { name, email, password, workspaceName } = parsed.data;

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Conflict", message: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash })
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });

  // Create a default personal workspace
  const slug = (workspaceName ?? name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + user.id.slice(0, 8);
  const [workspace] = await db
    .insert(workspacesTable)
    .values({ name: workspaceName ?? `${name}'s Workspace`, slug, ownerId: user.id })
    .returning({ id: workspacesTable.id, name: workspacesTable.name });

  await db.insert(workspaceMembersTable).values({ workspaceId: workspace.id, userId: user.id, role: "owner" });

  const token = signToken({ userId: user.id, email: user.email });

  res.status(201).json({ token, user, workspace });
});

// ─── Login ────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
  });
});

// ─── Me ───────────────────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req, res) => {
  const { userId } = (req as AuthenticatedRequest).user;

  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatarUrl: usersTable.avatarUrl, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Not Found", message: "User not found" });
    return;
  }

  // Return first workspace the user belongs to
  const [membership] = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId))
    .limit(1);

  res.json({ user: { ...user, workspaceId: membership?.workspaceId ?? null } });
});

export default router;
