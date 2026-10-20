import type { Response } from "express";
import {
  AdminRole,
  RosterScope,
  UniversityRosterImportStatus,
  UniversityVerificationMethod,
  UniversityVerificationSourceType,
} from "../generated/prisma/client";
import type { AuthenticatedAdminRequest } from "../middleware/adminAuth.middleware";
import { prisma } from "../lib/prisma";

const reasonText = (value: unknown) => typeof value === "string" ? value.trim() : "";
const validReason = (reason: string) => reason.length >= 20 && reason.length <= 2000;

export async function enableOfficialRoster(req: AuthenticatedAdminRequest, res: Response) {
  const admin = req.admin;
  if (!admin || admin.role !== AdminRole.super_admin) return res.status(403).json({success:false,message:"Super Admin required."});
  const universityId = String(req.params.universityId || "");
  const rosterImportId = String(req.params.rosterImportId || "");
  const reason = reasonText(req.body?.reason);
  const scope = req.body?.scope === "department" ? RosterScope.department :
    req.body?.scope === "faculty" ? RosterScope.faculty : RosterScope.institution;
  const sourceUnit = reasonText(req.body?.sourceUnit);
  const confirmed = req.body?.officialSourceConfirmed === true ||
    (scope === RosterScope.institution && req.body?.officialInstitutionWide === true);
  if (!validReason(reason) || !confirmed ||
    (scope !== RosterScope.institution && (sourceUnit.length < 3 || sourceUnit.length > 180))) {
    return res.status(400).json({success:false,message:"Confirm the source authority, scope, unit where applicable, and supply a reason of 20-2000 characters."});
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const university = await tx.university.findUnique({where:{id:universityId}});
      const roster = await tx.universityRosterImport.findFirst({where:{id:rosterImportId,universityId,status:UniversityRosterImportStatus.active}});
      if (!university || !roster) return {error:"Active roster or institution not found."};
      const now = new Date();
      if (!roster.activeRecordCount || (roster.validFrom && roster.validFrom > now) || (roster.expiresAt && roster.expiresAt <= now)) {
        return {error:"Source has no active records or is outside its validity window."};
      }
      const updatedRoster = await tx.universityRosterImport.update({
        where:{id:roster.id},
        data:{trustedForAutomatedVerification:true,rosterScope:scope,sourceUnit:scope===RosterScope.institution?null:sourceUnit},
      });
      await tx.university.update({where:{id:universityId},data:{
        studentVerificationEnabled:true,
        primaryVerificationSource:UniversityVerificationSourceType.roster_import,
        verificationMethod:university.manualReviewEnabled?UniversityVerificationMethod.manual:UniversityVerificationMethod.none,
      }});
      await tx.adminAuditLog.create({data:{actorAdminId:admin.id,
        action:"university_roster_source_certified",targetType:"university_roster_import",targetId:roster.id,reason,
        beforeState:JSON.stringify({universityId,trusted:roster.trustedForAutomatedVerification,scope:roster.rosterScope,unit:roster.sourceUnit}),
        afterState:JSON.stringify({universityId,trusted:updatedRoster.trustedForAutomatedVerification,scope,unit:updatedRoster.sourceUnit}),
      }});
      return {success:true,universityId,rosterImportId,scope,sourceUnit:updatedRoster.sourceUnit};
    });
    if ("error" in result) return res.status(409).json({success:false,message:result.error});
    return res.json(result);
  } catch (error) {
    console.error("Roster source certification:",error);
    return res.status(500).json({success:false,message:"Unable to certify this roster source."});
  }
}

/** Disables ALL roster-based automation, preserving manually reviewable cases. */
export async function disableOfficialRoster(req: AuthenticatedAdminRequest, res: Response) {
  const admin = req.admin;
  if (!admin || admin.role !== AdminRole.super_admin) return res.status(403).json({success:false,message:"Super Admin required."});
  const universityId = String(req.params.universityId || "");
  const reason = reasonText(req.body?.reason);
  if (!validReason(reason)) return res.status(400).json({success:false,message:"Explain the change (20-2000 characters)."});
  try {
    const result = await prisma.$transaction(async tx => {
      const university = await tx.university.findUnique({where:{id:universityId}});
      if (!university) return {error:"Institution not found."};
      const certified = await tx.universityRosterImport.findMany({
        where:{universityId,trustedForAutomatedVerification:true}, select:{id:true},
      });
      await tx.universityRosterImport.updateMany({where:{universityId,trustedForAutomatedVerification:true},data:{trustedForAutomatedVerification:false}});
      await tx.university.update({where:{id:universityId},data:{
        primaryVerificationSource:university.primaryVerificationSource===UniversityVerificationSourceType.roster_import?UniversityVerificationSourceType.none:university.primaryVerificationSource,
        fallbackVerificationSource:university.fallbackVerificationSource===UniversityVerificationSourceType.roster_import?UniversityVerificationSourceType.none:university.fallbackVerificationSource,
        studentVerificationEnabled:university.manualReviewEnabled,
        verificationMethod:university.manualReviewEnabled?UniversityVerificationMethod.manual:UniversityVerificationMethod.none,
      }});
      await tx.adminAuditLog.create({data:{actorAdminId:admin.id,action:"university_roster_automatic_verification_disabled",targetType:"university",targetId:universityId,reason,
        beforeState:JSON.stringify({certifiedRosterIds:certified.map(r=>r.id)}),afterState:JSON.stringify({certifiedRosterIds:[]})}});
      return {success:true};
    });
    if ("error" in result) return res.status(404).json({success:false,message:result.error});
    return res.json(result);
  } catch (error) {
    console.error("Disable roster verification:",error);
    return res.status(500).json({success:false,message:"Unable to disable roster verification."});
  }
}

/** Withdraw one source; its records remain in audit history and cannot be used to verify. */
export async function archiveUniversityRoster(req: AuthenticatedAdminRequest, res: Response) {
  const admin = req.admin;
  if (!admin || admin.role !== AdminRole.super_admin) return res.status(403).json({success:false,message:"Super Admin required."});
  const universityId = String(req.params.universityId || "");
  const rosterImportId = String(req.params.rosterImportId || "");
  const reason = reasonText(req.body?.reason);
  if (!validReason(reason) || req.body?.confirmed !== true) return res.status(400).json({success:false,message:"Explicit confirmation and a reason of at least 20 characters are required."});
  try {
    const result = await prisma.$transaction(async tx => {
      const university = await tx.university.findUnique({where:{id:universityId}});
      const roster = await tx.universityRosterImport.findFirst({where:{id:rosterImportId,universityId,status:UniversityRosterImportStatus.active}});
      if (!university || !roster) return {error:"Active source not found."};
      const changed = await tx.universityRosterImport.update({where:{id:roster.id},data:{
        status:UniversityRosterImportStatus.archived,archivedAt:new Date(),trustedForAutomatedVerification:false,
      }});
      const remaining = await tx.universityRosterImport.count({where:{
        universityId,status:UniversityRosterImportStatus.active,trustedForAutomatedVerification:true,
        OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}],
      }});
      if (remaining===0 && university.primaryVerificationSource===UniversityVerificationSourceType.roster_import) {
        await tx.university.update({where:{id:universityId},data:{
          primaryVerificationSource:UniversityVerificationSourceType.none,
          fallbackVerificationSource:university.fallbackVerificationSource===UniversityVerificationSourceType.roster_import?UniversityVerificationSourceType.none:university.fallbackVerificationSource,
          studentVerificationEnabled:university.manualReviewEnabled,
          verificationMethod:university.manualReviewEnabled?UniversityVerificationMethod.manual:UniversityVerificationMethod.none,
        }});
      }
      await tx.adminAuditLog.create({data:{actorAdminId:admin.id,action:"university_roster_source_archived",targetType:"university_roster_import",targetId:roster.id,reason,
        beforeState:JSON.stringify({universityId,status:roster.status,certified:roster.trustedForAutomatedVerification}),
        afterState:JSON.stringify({universityId,status:changed.status,certified:false,remainingCertifiedSources:remaining}),
      }});
      return {success:true,rosterImportId:roster.id,remainingCertifiedSources:remaining};
    });
    if ("error" in result) return res.status(409).json({success:false,message:result.error});
    return res.json(result);
  } catch (error) {
    console.error("Archive roster:",error);
    return res.status(500).json({success:false,message:"Unable to archive this source."});
  }
}
