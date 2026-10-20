import type { Response } from "express";
import type { AuthenticatedAdminRequest } from "../middleware/adminAuth.middleware";
import { AdminRole, UniversityVerificationMethod } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

export async function updateInstitutionRollout(req: AuthenticatedAdminRequest, res: Response) {
  const admin = req.admin;
  if (!admin || admin.role !== AdminRole.super_admin) return res.status(403).json({ success: false, message: "Super Admin required." });
  const universityId = String(req.params.universityId || "");
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const featured = req.body?.featuredInSignup;
  const sellers = req.body?.sellerApplicationsOpen;
  if (reason.length < 15 || reason.length > 2000 ||
    (featured === undefined && sellers === undefined) ||
    (featured !== undefined && typeof featured !== "boolean") ||
    (sellers !== undefined && typeof sellers !== "boolean")) return res.status(400).json({ success: false, message: "Provide a valid setting and a reason of at least 15 characters." });
  try {
    const result = await prisma.$transaction(async tx => {
      const before = await tx.university.findUnique({ where: { id: universityId } });
      if (!before) return { error: "Institution not found." };
      const after = await tx.university.update({ where: { id: universityId }, data: {
        ...(featured !== undefined ? { featuredInSignup: featured } : {}),
        ...(sellers !== undefined ? { sellerApplicationsOpen: sellers } : {}),
        // One explicit policy: opening applications also opens manual identity review.
        // Closing applications does not invalidate existing pending reviews.
        ...(sellers === true ? {
          manualReviewEnabled: true,
          studentVerificationEnabled: true,
          verificationMethod: before.verificationMethod === UniversityVerificationMethod.none ? UniversityVerificationMethod.manual : before.verificationMethod,
        } : {}),
      }});
      await tx.adminAuditLog.create({ data: { actorAdminId: admin.id, action: "institution_rollout_changed", targetType: "university", targetId: before.id, reason,
        beforeState: JSON.stringify({ featured: before.featuredInSignup, sellerApplicationsOpen: before.sellerApplicationsOpen, manualReviewEnabled: before.manualReviewEnabled, studentVerificationEnabled: before.studentVerificationEnabled }),
        afterState: JSON.stringify({ featured: after.featuredInSignup, sellerApplicationsOpen: after.sellerApplicationsOpen, manualReviewEnabled: after.manualReviewEnabled, studentVerificationEnabled: after.studentVerificationEnabled }) } });
      return { after: { id: after.id, featuredInSignup: after.featuredInSignup, sellerApplicationsOpen: after.sellerApplicationsOpen, manualReviewEnabled: after.manualReviewEnabled, studentVerificationEnabled: after.studentVerificationEnabled } };
    });
    if ("error" in result) return res.status(404).json({ success: false, message: result.error });
    return res.json({ success: true, institution: result.after });
  } catch (error) {
    console.error("Institution rollout update:", error);
    return res.status(500).json({ success: false, message: "Unable to update institution rollout." });
  }
}
