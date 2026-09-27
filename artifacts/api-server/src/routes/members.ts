import { Router, type IRouter } from "express";
import { db, usersTable, workspaceMembersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/auth";
import { requireAuth, requireWorkspace, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const ADMIN_ROLES = ["owner", "admin", "ceo", "cto"];

// ─── List members of caller workspace ────────────────────────────────────────

router.get("/", requireAuth, requireWorkspace, async (req, res) => {
  const wsId = (req as AuthenticatedRequest).user.workspaceId!;

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
    .from(workspaceMembersTable)
    .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
    .where(eq(workspaceMembersTable.workspaceId, wsId))
    .orderBy(usersTable.createdAt);

  res.json({ members });
});

// ─── Get single member ────────────────────────────────────────────────────────

router.get("/:id", requireAuth, requireWorkspace, async (req, res) => {
  const wsId = (req as AuthenticatedRequest).user.workspaceId!;
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
    .from(workspaceMembersTable)
    .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
    .where(and(eq(workspaceMembersTable.workspaceId, wsId), eq(usersTable.id, id)))
    .limit(1);

  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json({ member });
});

// ─── Create member (Admins/Execs only) ─────────────────────────────────────────

const createMemberSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  role: z.enum(["owner", "admin", "member", "viewer", "ceo", "cto", "cmo"]).default("member"),
  mustChangePassword: z.boolean().default(true),
});

router.post("/", requireAuth, requireWorkspace, requireRole(ADMIN_ROLES), async (req, res) => {
  const parsed = createMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const wsId = (req as AuthenticatedRequest).user.workspaceId!;
  const { name, email, password, phone, role, mustChangePassword } = parsed.data;

  // Check if email already exists
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  let userId: string;

  if (existing) {
    userId = existing.id;
    // Check if already in workspace
    const [inWs] = await db
      .select({ id: workspaceMembersTable.id })
      .from(workspaceMembersTable)
      .where(and(eq(workspaceMembersTable.workspaceId, wsId), eq(workspaceMembersTable.userId, userId)))
      .limit(1);
    if (inWs) {
      res.status(409).json({ error: "Conflict", message: "User already belongs to this workspace" });
      return;
    }
  } else {
    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(usersTable)
      .values({ name, email, passwordHash, phone: phone ?? null, mustChangePassword })
      .returning({ id: usersTable.id });
    userId = user.id;
  }

  await db.insert(workspaceMembersTable).values({
    workspaceId: wsId,
    userId,
    role,
  });

  res.status(201).json({ member: { id: userId, name, email, role, phone, mustChangePassword } });
});

// ─── Update member ────────────────────────────────────────────────────────────

const updateMemberSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
  role: z.enum(["owner", "admin", "member", "viewer", "ceo", "cto", "cmo"]).optional(),
  mustChangePassword: z.boolean().optional(),
});

router.put("/:id", requireAuth, requireWorkspace, async (req, res) => {
  const wsId = (req as AuthenticatedRequest).user.workspaceId!;
  const caller = (req as AuthenticatedRequest).user;
  const targetId = req.params.id as string;

  const parsed = updateMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const { name, email, phone, avatarUrl, role, mustChangePassword } = parsed.data;

  // Verify target is member of current workspace
  const [membership] = await db
    .select({ id: workspaceMembersTable.id, role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, wsId), eq(workspaceMembersTable.userId, targetId)))
    .limit(1);

  if (!membership) {
    res.status(404).json({ error: "Member not found in workspace" });
    return;
  }

  const isSelf = caller.userId === targetId;
  const isCallerAdmin = ADMIN_ROLES.includes(caller.role || "");

  // Non-admins can only update their own record and cannot change role or mustChangePassword
  if (!isCallerAdmin) {
    if (!isSelf) {
      res.status(403).json({ error: "Forbidden", message: "Apenas administradores podem editar outros membros" });
      return;
    }
    if (role !== undefined || mustChangePassword !== undefined) {
      res.status(403).json({ error: "Forbidden", message: "Não é permitido alterar o próprio cargo ou status de senha" });
      return;
    }
  }

  // Check email uniqueness if changing
  if (email) {
    const [emailTaken] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (emailTaken && emailTaken.id !== targetId) {
      res.status(409).json({ error: "Conflict", message: "Email already in use" });
      return;
    }
  }

  // Update user fields
  const updates: Record<string, unknown> = { updatedAt: sql`now()` };
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (mustChangePassword !== undefined && isCallerAdmin) updates.mustChangePassword = mustChangePassword;

  if (Object.keys(updates).length > 1) {
    await db.update(usersTable).set(updates).where(eq(usersTable.id, targetId));
  }

  // Update role if requested by admin
  if (role && isCallerAdmin) {
    await db
      .update(workspaceMembersTable)
      .set({ role })
      .where(and(eq(workspaceMembersTable.workspaceId, wsId), eq(workspaceMembersTable.userId, targetId)));
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
    .from(workspaceMembersTable)
    .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
    .where(and(eq(workspaceMembersTable.workspaceId, wsId), eq(usersTable.id, targetId)))
    .limit(1);

  res.json({ member });
});

// ─── Change password ──────────────────────────────────────────────────────────

router.put("/:id/password", requireAuth, requireWorkspace, async (req, res) => {
  const wsId = (req as AuthenticatedRequest).user.workspaceId!;
  const caller = (req as AuthenticatedRequest).user;
  const targetId = req.params.id as string;

  // Verify target is member of workspace
  const [targetUser] = await db
    .select({ id: usersTable.id, passwordHash: usersTable.passwordHash })
    .from(workspaceMembersTable)
    .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
    .where(and(eq(workspaceMembersTable.workspaceId, wsId), eq(usersTable.id, targetId)))
    .limit(1);

  if (!targetUser) {
    res.status(404).json({ error: "Member not found in workspace" });
    return;
  }

  const isSelf = caller.userId === targetId;
  const isCallerAdmin = ADMIN_ROLES.includes(caller.role || "");

  if (isSelf) {
    // Self-service password change: requires current password
    const body = req.body as { currentPassword?: string; newPassword?: string; password?: string };
    const currentPassword = body.currentPassword;
    const newPassword = body.newPassword || body.password;

    if (!currentPassword) {
      res.status(400).json({ error: "Validation failed", message: "Senha atual é obrigatória para alterar sua senha" });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: "Validation failed", message: "Nova senha deve ter pelo menos 6 caracteres" });
      return;
    }

    const matches = await verifyPassword(currentPassword, targetUser.passwordHash);
    if (!matches) {
      res.status(400).json({ error: "Unauthorized", message: "Senha atual incorreta" });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await db
      .update(usersTable)
      .set({ passwordHash, mustChangePassword: false, updatedAt: sql`now()` })
      .where(eq(usersTable.id, targetId));

    res.json({ success: true, message: "Senha alterada com sucesso" });
    return;
  }

  // Admin password reset
  if (!isCallerAdmin) {
    res.status(403).json({ error: "Forbidden", message: "Apenas administradores podem redefinir a senha de outros membros" });
    return;
  }

  const body = req.body as { newPassword?: string; password?: string; mustChangePassword?: boolean };
  const newPassword = body.newPassword || body.password;
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Validation failed", message: "Nova senha deve ter pelo menos 6 caracteres" });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(usersTable)
    .set({
      passwordHash,
      mustChangePassword: body.mustChangePassword ?? true,
      updatedAt: sql`now()`,
    })
    .where(eq(usersTable.id, targetId));

  res.json({ success: true, message: "Senha redefinida com sucesso (troca obrigatória no próximo login)" });
});

// ─── Update avatar ────────────────────────────────────────────────────────────

router.put("/:id/avatar", requireAuth, requireWorkspace, async (req, res) => {
  const wsId = (req as AuthenticatedRequest).user.workspaceId!;
  const caller = (req as AuthenticatedRequest).user;
  const targetId = req.params.id as string;

  const isSelf = caller.userId === targetId;
  const isCallerAdmin = ADMIN_ROLES.includes(caller.role || "");

  if (!isSelf && !isCallerAdmin) {
    res.status(403).json({ error: "Forbidden", message: "Permissão insuficiente para alterar avatar de outro membro" });
    return;
  }

  const [membership] = await db
    .select({ id: workspaceMembersTable.id })
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, wsId), eq(workspaceMembersTable.userId, targetId)))
    .limit(1);

  if (!membership) {
    res.status(404).json({ error: "Member not found in workspace" });
    return;
  }

  const body = req.body as { avatarUrl?: string | null };
  const avatarUrl = body.avatarUrl;

  await db
    .update(usersTable)
    .set({ avatarUrl: avatarUrl ?? null, updatedAt: sql`now()` })
    .where(eq(usersTable.id, targetId));

  res.json({ success: true, avatarUrl: avatarUrl ?? null });
});

// ─── Delete member ────────────────────────────────────────────────────────────

router.delete("/:id", requireAuth, requireWorkspace, requireRole(ADMIN_ROLES), async (req, res) => {
  const wsId = (req as AuthenticatedRequest).user.workspaceId!;
  const caller = (req as AuthenticatedRequest).user;
  const targetId = req.params.id as string;

  if (targetId === caller.userId) {
    res.status(400).json({ error: "Bad Request", message: "Você não pode excluir sua própria conta de membro" });
    return;
  }

  const [membership] = await db
    .select({ id: workspaceMembersTable.id })
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, wsId), eq(workspaceMembersTable.userId, targetId)))
    .limit(1);

  if (!membership) {
    res.status(404).json({ error: "Member not found in workspace" });
    return;
  }

  // Remove from workspace
  await db
    .delete(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, wsId), eq(workspaceMembersTable.userId, targetId)));

  // If user has no remaining workspaces, remove user
  const otherWs = await db
    .select({ id: workspaceMembersTable.id })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, targetId))
    .limit(1);

  if (otherWs.length === 0) {
    await db.delete(usersTable).where(eq(usersTable.id, targetId));
  }

  res.json({ success: true });
});

export default router;

