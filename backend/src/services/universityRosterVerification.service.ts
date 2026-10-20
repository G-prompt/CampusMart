import { UniversityRosterImportStatus } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { normalizeMatricNumber } from "../lib/studentVerification";
import { studentNamesMatch } from "../lib/universityRoster";

/** Active, explicitly certified roster sources are evaluated together. */
export type RosterVerificationOutcome =
  | "verified"
  | "record_not_found"
  | "name_mismatch"
  | "inactive_student"
  | "no_active_roster"
  | "roster_not_yet_valid"
  | "roster_expired"
  | "roster_configuration_conflict";

export type UniversityRosterVerificationResult = {
  matched: boolean;
  outcome: RosterVerificationOutcome;
  definitive: boolean;
  universityId: string;
  rosterImportId: string | null;
  rosterAcademicSession: string | null;
  normalizedMatricNumber: string;
  reason: string;
  rosterRecordId: string | null;
};

export type VerifyUniversityRosterInput = {
  universityId: string;
  matricNumber: string;
  fullName: string;
  now?: Date;
};

export type RosterCandidate = {
  id: string;
  fullName: string;
  isActiveStudent: boolean;
  rosterImport: {
    id: string;
    academicSession: string;
  };
};

export type CandidateDecision = {
  outcome: RosterVerificationOutcome;
  definitive: boolean;
  candidate: RosterCandidate | null;
};

/**
 * Shared, pure decision policy for integration tests and production matching.
 * Multiple sources for the same matric must agree on identity and status.
 * A disagreement is inconclusive, never a random first-match acceptance.
 */
export function decideRosterCandidates(
  candidates: RosterCandidate[],
  submittedName: string
): CandidateDecision {
  if (!candidates.length) {
    return { outcome: "record_not_found", definitive: false, candidate: null };
  }
  const first = candidates[0];
  const disputed = candidates.some((item) =>
    item.isActiveStudent !== first.isActiveStudent ||
    !studentNamesMatch(item.fullName, first.fullName) ||
    !studentNamesMatch(first.fullName, item.fullName)
  );
  if (disputed) {
    return { outcome: "roster_configuration_conflict", definitive: false, candidate: null };
  }
  if (!studentNamesMatch(first.fullName, submittedName)) {
    return { outcome: "name_mismatch", definitive: true, candidate: first };
  }
  if (!first.isActiveStudent) {
    return { outcome: "inactive_student", definitive: true, candidate: first };
  }
  return { outcome: "verified", definitive: true, candidate: first };
}

export async function verifyStudentAgainstUniversityRoster(
  input: VerifyUniversityRosterInput
): Promise<UniversityRosterVerificationResult> {
  const universityId = typeof input.universityId === "string" ? input.universityId.trim() : "";
  const matricNumber = typeof input.matricNumber === "string" ? input.matricNumber.trim() : "";
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  if (!universityId || !matricNumber || !fullName) {
    throw new Error("University ID, matric number and student name are required.");
  }
  const normalizedMatricNumber = normalizeMatricNumber(matricNumber);
  if (!normalizedMatricNumber) throw new Error("Invalid matric number.");
  const now = input.now ?? new Date();
  const result = (outcome: RosterVerificationOutcome, definitive: boolean,
    reason: string, candidate?: RosterCandidate | null): UniversityRosterVerificationResult => ({
      matched: outcome === "verified", outcome, definitive, universityId,
      rosterImportId: candidate?.rosterImport.id ?? null,
      rosterAcademicSession: candidate?.rosterImport.academicSession ?? null,
      normalizedMatricNumber, reason, rosterRecordId: candidate?.id ?? null,
    });

  const allCertified = await prisma.universityRosterImport.findMany({
    where: {
      universityId,
      status: UniversityRosterImportStatus.active,
      trustedForAutomatedVerification: true,
    },
    select: { id: true, academicSession: true, validFrom: true, expiresAt: true },
  });
  if (!allCertified.length) {
    return result("no_active_roster", false, "No authorised active roster source exists.");
  }
  const current = allCertified.filter((source) =>
    (!source.validFrom || source.validFrom <= now) &&
    (!source.expiresAt || source.expiresAt > now)
  );
  if (!current.length) {
    const expired = allCertified.every((source) => source.expiresAt && source.expiresAt <= now);
    return result(expired ? "roster_expired" : "roster_not_yet_valid", false,
      "No certified roster is within its authorised validity period.");
  }

  const candidates = await prisma.universityRosterRecord.findMany({
    where: {
      normalizedMatricNumber,
      rosterImportId: { in: current.map((roster) => roster.id) },
    },
    select: {
      id: true, fullName: true, isActiveStudent: true,
      rosterImport: { select: { id: true, academicSession: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const decision = decideRosterCandidates(candidates, fullName);
  const reasons: Record<RosterVerificationOutcome, string> = {
    verified: "Matric, name and current-student status agree across all matched certified sources.",
    record_not_found: "The matric number was not found among eligible certified sources.",
    name_mismatch: "Submitted student name differs from the authoritative roster name.",
    inactive_student: "All matched certified sources identify this student as inactive.",
    no_active_roster: "No eligible source exists.",
    roster_not_yet_valid: "Authorised roster is not yet valid.",
    roster_expired: "Authorised roster has expired.",
    roster_configuration_conflict: "Certified roster sources disagree for this matric number; manual investigation required.",
  };
  return result(decision.outcome, decision.definitive, reasons[decision.outcome], decision.candidate);
}
