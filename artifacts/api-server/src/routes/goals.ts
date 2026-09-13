import { Router, type IRouter } from "express";
import { db, goalsTable, workspaceMembersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { type Request, type Response } from "express";

const router: IRouter = Router();
router.use(requireAuth);

// ─── GET /api/goals ───────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;

    // Get user's workspaces
    const memberships = await db.select({ workspaceId: workspaceMembersTable.workspaceId })
      .from(workspaceMembersTable)
      .where(eq(workspaceMembersTable.userId, userId));
    const wsIds = memberships.map(m => m.workspaceId);
    if (wsIds.length === 0) { res.json([]); return; }

    const allGoals = await db.select().from(goalsTable).where(inArray(goalsTable.workspaceId, wsIds));

    // Group key results under objectives
    const objectives = allGoals.filter(g => g.type === "objective" && !g.parentId);
    const keyResults = allGoals.filter(g => g.type === "key_result" || g.parentId);

    const groupedGoals = objectives.map(obj => ({
      ...obj,
      keyResults: keyResults.filter(kr => kr.parentId === obj.id),
    }));

    res.json(groupedGoals);
  } catch (err) {
    console.error("Failed to fetch goals", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/goals ──────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;

    // Get first workspace
    const [membership] = await db.select({ workspaceId: workspaceMembersTable.workspaceId })
      .from(workspaceMembersTable)
      .where(eq(workspaceMembersTable.userId, userId))
      .limit(1);
    if (!membership) { res.status(400).json({ error: "No workspace" }); return; }

    const { title, description, type, parentId, targetValue, currentValue, unit, startDate, endDate, status } = req.body;

    const [newGoal] = await db.insert(goalsTable).values({
      workspaceId: membership.workspaceId,
      ownerId: userId,
      title,
      description,
      type: type || "objective",
      parentId: parentId || null,
      targetValue: targetValue !== undefined ? targetValue : 100,
      currentValue: currentValue !== undefined ? currentValue : 0,
      unit: unit || "%",
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: status || "active",
    }).returning();

    res.status(201).json(newGoal);
  } catch (err) {
    console.error("Failed to create goal", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── PUT /api/goals/:id ──────────────────────────────────────────────────────

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { title, description, currentValue, targetValue, status, unit } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (currentValue !== undefined) updates.currentValue = currentValue;
    if (targetValue !== undefined) updates.targetValue = targetValue;
    if (status !== undefined) updates.status = status;
    if (unit !== undefined) updates.unit = unit;

    const [updatedGoal] = await db.update(goalsTable).set(updates).where(eq(goalsTable.id, id)).returning();
    if (!updatedGoal) { res.status(404).json({ message: "Goal not found" }); return; }

    res.json(updatedGoal);
  } catch (err) {
    console.error("Failed to update goal", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── DELETE /api/goals/:id ───────────────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const [deletedGoal] = await db.delete(goalsTable).where(eq(goalsTable.id, id)).returning();
    if (!deletedGoal) { res.status(404).json({ message: "Goal not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete goal", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
