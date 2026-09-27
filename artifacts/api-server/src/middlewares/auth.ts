import { type Request, type Response, type NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/auth";
import { db, workspaceMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface AuthenticatedUser extends JwtPayload {
  workspaceId?: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

export async function requireWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user || !authReq.user.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const requestedWsId = req.headers["x-workspace-id"] as string | undefined;

  try {
    let membership;
    if (requestedWsId) {
      [membership] = await db
        .select({ workspaceId: workspaceMembersTable.workspaceId, role: workspaceMembersTable.role })
        .from(workspaceMembersTable)
        .where(and(eq(workspaceMembersTable.userId, authReq.user.userId), eq(workspaceMembersTable.workspaceId, requestedWsId)))
        .limit(1);
    } else {
      [membership] = await db
        .select({ workspaceId: workspaceMembersTable.workspaceId, role: workspaceMembersTable.role })
        .from(workspaceMembersTable)
        .where(eq(workspaceMembersTable.userId, authReq.user.userId))
        .limit(1);
    }

    if (!membership) {
      res.status(403).json({ error: "Forbidden", message: "User does not belong to the requested workspace" });
      return;
    }

    authReq.user.workspaceId = membership.workspaceId;
    authReq.user.role = membership.role;
    next();
  } catch (err) {
    res.status(500).json({ error: "Internal server error resolving workspace" });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user?.role) {
      res.status(403).json({ error: "Forbidden", message: "Workspace role not resolved" });
      return;
    }
    if (!allowedRoles.includes(authReq.user.role)) {
      res.status(403).json({ error: "Forbidden", message: "Insufficient privileges for this action" });
      return;
    }
    next();
  };
}
