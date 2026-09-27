import { Router, type IRouter } from "express";
import { db, goalsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireWorkspace, type AuthenticatedRequest } from "../middlewares/auth";
import { type Request, type Response } from "express";

const router: IRouter = Router();
router.use(requireAuth, requireWorkspace);

// ─── GET /api/goals ───────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  try {
    const wsId = (req as AuthenticatedRequest).user.workspaceId!;

    const allGoals = await db.select().from(goalsTable).where(eq(goalsTable.workspaceId, wsId));

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
    const { userId, workspaceId } = (req as AuthenticatedRequest).user;
    const wsId = workspaceId!;

    const { title, description, type, parentId, targetValue, currentValue, unit, startDate, endDate, status } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ message: "Título é obrigatório" });
      return;
    }

    // If parentId is provided, verify it exists in this workspace
    if (parentId) {
      const [parent] = await db
        .select({ id: goalsTable.id })
        .from(goalsTable)
        .where(and(eq(goalsTable.id, parentId), eq(goalsTable.workspaceId, wsId)))
        .limit(1);
      if (!parent) {
        res.status(400).json({ message: "Objetivo pai não encontrado no workspace" });
        return;
      }
    }

    const [newGoal] = await db.insert(goalsTable).values({
      workspaceId: wsId,
      ownerId: userId,
      title: title.trim(),
      description: description ?? null,
      type: type || (parentId ? "key_result" : "objective"),
      parentId: parentId || null,
      targetValue: targetValue !== undefined ? Number(targetValue) : 100,
      currentValue: currentValue !== undefined ? Number(currentValue) : 0,
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
    const wsId = (req as AuthenticatedRequest).user.workspaceId!;
    const id = req.params.id as string;
    const { title, description, currentValue, targetValue, status, unit, startDate, endDate } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (currentValue !== undefined) updates.currentValue = Number(currentValue);
    if (targetValue !== undefined) updates.targetValue = Number(targetValue);
    if (status !== undefined) updates.status = status;
    if (unit !== undefined) updates.unit = unit;
    if (startDate !== undefined) updates.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updates.endDate = endDate ? new Date(endDate) : null;

    const [updatedGoal] = await db
      .update(goalsTable)
      .set(updates)
      .where(and(eq(goalsTable.id, id), eq(goalsTable.workspaceId, wsId)))
      .returning();

    if (!updatedGoal) { res.status(404).json({ message: "Meta não encontrada" }); return; }

    res.json(updatedGoal);
  } catch (err) {
    console.error("Failed to update goal", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── DELETE /api/goals/:id ───────────────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const wsId = (req as AuthenticatedRequest).user.workspaceId!;
    const id = req.params.id as string;

    // Delete any key results under this objective first
    await db.delete(goalsTable).where(and(eq(goalsTable.parentId, id), eq(goalsTable.workspaceId, wsId)));

    const [deletedGoal] = await db
      .delete(goalsTable)
      .where(and(eq(goalsTable.id, id), eq(goalsTable.workspaceId, wsId)))
      .returning();

    if (!deletedGoal) { res.status(404).json({ message: "Meta não encontrada" }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete goal", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
