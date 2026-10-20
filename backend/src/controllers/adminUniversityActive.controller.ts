import type { Response } from "express";
import { AdminRole } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedAdminRequest } from "../middleware/adminAuth.middleware";

/** University activation and deactivation are single-Super-Admin actions.
 * The change and its audit record share one database transaction. */
export async function changeUniversityActiveAudited(req: AuthenticatedAdminRequest, res: Response) {
  if (!req.admin || req.admin.role !== AdminRole.super_admin) {
    return res.status(403).json({ success: false, code: "SUPER_ADMIN_REQUIRED", message: "Only a Super Admin can change university availability." });
  }
  if (typeof req.body?.active !== "boolean") {
    return res.status(400).json({ success: false, code: "ACTIVE_REQUIRED", message: "Provide active as true or false." });
  }
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (reason.length < 10 || reason.length > 1000) {
    return res.status(400).json({ success: false, code: "REASON_REQUIRED", message: "Enter a reason of 10-1000 characters for this change." });
  }
  const universityId = String(req.params.universityId ?? "").trim();
  if (!universityId) return res.status(400).json({ success: false, message: "University ID is required." });
  try {
    const changed = await prisma.$transaction(async (tx) => {
      const old = await tx.university.findUnique({ where: { id: universityId }, select: { id: true, name: true, active: true } });
      if (!old) return { code: "NOT_FOUND" as const };
      if (old.active === req.body.active) return { code: "UNCHANGED" as const, university: old };
      const result = await tx.university.updateMany({ where: { id: universityId, active: old.active }, data: { active: req.body.active } });
      if (result.count !== 1) return { code: "CONFLICT" as const };
      const current = await tx.university.findUniqueOrThrow({ where: { id: universityId }, select: { id: true, name: true, active: true, updatedAt: true } });
      await tx.adminAuditLog.create({ data: {
        actorAdminId: req.admin!.id,
        action: req.body.active ? "university.activated" : "university.deactivated",
        targetType: "university", targetId: universityId,
        reason,
        beforeState: JSON.stringify({ active: old.active, name: old.name }),
        afterState: JSON.stringify({ active: current.active, name: current.name }),
      } });
      return { code: "UPDATED" as const, university: current };
    });
    if (changed.code === "NOT_FOUND") return res.status(404).json({ success: false, message: "University not found." });
    if (changed.code === "CONFLICT") return res.status(409).json({ success: false, message: "University changed concurrently. Refresh and retry." });
    return res.status(200).json({ success: true, university: changed.university, message: changed.code === "UNCHANGED" ? "Already in the requested state." : "University status updated and audited." });
  } catch (error) {
    console.error("Audited university active update failed:", error);
    return res.status(500).json({ success: false, message: "University status not changed. Please try again." });
  }
}
