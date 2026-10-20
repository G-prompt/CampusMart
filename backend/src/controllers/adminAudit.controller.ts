import type { Response } from "express";
import { prisma } from "../lib/prisma";
import type { AuthenticatedAdminRequest } from "../middleware/adminAuth.middleware";

export async function getAdminAudit(req: AuthenticatedAdminRequest, res: Response) {
  try {
    const actorId = typeof req.query.actorId === "string" ? req.query.actorId.trim() : undefined;
    const targetType = typeof req.query.targetType === "string" ? req.query.targetType.trim() : undefined;
    const targetId = typeof req.query.targetId === "string" ? req.query.targetId.trim() : undefined;
    const action = typeof req.query.action === "string" ? req.query.action.trim() : undefined;
    const take = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const events = await prisma.adminAuditLog.findMany({
      where: {
        ...(actorId ? { actorAdminId: actorId } : {}),
        ...(targetType ? { targetType } : {}),
        ...(targetId ? { targetId } : {}),
        ...(action ? { action } : {}),
      },
      select: {
        id: true, action: true, targetType: true, targetId: true,
        reason: true, beforeState: true, afterState: true,
        outcome: true, createdAt: true,
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    const hasMore = events.length > take;
    const page = events.slice(0, take);
    return res.status(200).json({
      success: true,
      events: page,
      nextCursor: hasMore ? page[page.length - 1]?.id : null,
    });
  } catch (error) {
    console.error("Admin audit query failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load audit records." });
  }
}
