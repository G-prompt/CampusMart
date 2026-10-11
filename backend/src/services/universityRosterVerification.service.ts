import {
  UniversityRosterImportStatus,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

import {
  normalizeMatricNumber,
} from "../lib/studentVerification";

import {
  studentNamesMatch,
} from "../lib/universityRoster";

/*
 * =======================================================
 * CAMPUSMART UNIVERSITY ROSTER VERIFICATION PROVIDER
 * =======================================================
 *
 * This service answers one narrow question:
 *
 * "Does this submitted student identity match the
 * currently-authoritative imported roster for this
 * university?"
 *
 * It DOES NOT:
 *
 * - update a User
 * - mark anyone verified
 * - create an appeal
 * - choose between API/database/roster providers
 * - override authoritative mismatches
 *
 * Those responsibilities belong to the verification
 * orchestration layer we will build afterwards.
 */

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
  matched:
    boolean;

  outcome:
    RosterVerificationOutcome;

  definitive:
    boolean;

  universityId:
    string;

  rosterImportId:
    | string
    | null;

  rosterAcademicSession:
    | string
    | null;

  normalizedMatricNumber:
    string;

  /*
   * Internal explanation intended for backend/Admin
   * logic.
   *
   * Do not expose detailed mismatch information directly
   * to unauthenticated/public clients.
   */
  reason:
    string;

  /*
   * The matched database record ID is useful internally
   * for audit/debugging.
   *
   * We deliberately do not return the student's roster
   * name/email here.
   */
  rosterRecordId:
    | string
    | null;
};

export type VerifyUniversityRosterInput = {
  universityId:
    string;

  matricNumber:
    string;

  fullName:
    string;

  /*
   * Optional deterministic clock for tests.
   */
  now?:
    Date;
};

/*
 * =======================================================
 * MAIN MATCHER
 * =======================================================
 */

export async function verifyStudentAgainstUniversityRoster(
  input:
    VerifyUniversityRosterInput
): Promise<UniversityRosterVerificationResult> {
  const universityId =
    cleanRequiredText(
      input.universityId
    );

  const matricNumber =
    cleanRequiredText(
      input.matricNumber
    );

  const fullName =
    cleanRequiredText(
      input.fullName
    );

  const now =
    input.now
      ? new Date(
          input.now.getTime()
        )
      : new Date();

  if (
    !universityId
  ) {
    throw new Error(
      "University ID is required for roster verification."
    );
  }

  if (
    !matricNumber
  ) {
    throw new Error(
      "Matric number is required for roster verification."
    );
  }

  if (
    !fullName
  ) {
    throw new Error(
      "Student name is required for roster verification."
    );
  }

  const normalizedMatricNumber =
    normalizeMatricNumber(
      matricNumber
    );

  if (
    !normalizedMatricNumber
  ) {
    throw new Error(
      "A normalized matric number could not be produced."
    );
  }

  /*
   * There should normally be exactly one active roster.
   *
   * We deliberately fetch up to two instead of blindly
   * using findFirst so corruption/configuration mistakes
   * fail closed rather than silently choosing one source.
   */
  const activeRosters =
    await prisma.universityRosterImport.findMany({
      where: {
        universityId,

        status:
          UniversityRosterImportStatus.active,
      },

      orderBy: [
        {
          activatedAt:
            "desc",
        },

        {
          importedAt:
            "desc",
        },
      ],

      take:
        2,

      select: {
        id:
          true,

        academicSession:
          true,

        validFrom:
          true,

        expiresAt:
          true,

        activatedAt:
          true,
      },
    });

  if (
    activeRosters.length ===
    0
  ) {
    return {
      matched:
        false,

      outcome:
        "no_active_roster",

      definitive:
        false,

      universityId,

      rosterImportId:
        null,

      rosterAcademicSession:
        null,

      normalizedMatricNumber,

      reason:
        "No active university roster is available.",

      rosterRecordId:
        null,
    };
  }

  if (
    activeRosters.length >
    1
  ) {
    return {
      matched:
        false,

      outcome:
        "roster_configuration_conflict",

      definitive:
        false,

      universityId,

      rosterImportId:
        null,

      rosterAcademicSession:
        null,

      normalizedMatricNumber,

      reason:
        "More than one active roster exists for this university. Automatic verification has been stopped until the configuration is corrected.",

      rosterRecordId:
        null,
    };
  }

  const roster =
    activeRosters[0];

  /*
   * -----------------------------------------------------
   * ROSTER VALIDITY
   * -----------------------------------------------------
   */

  if (
    roster.validFrom &&
    roster.validFrom.getTime() >
      now.getTime()
  ) {
    return {
      matched:
        false,

      outcome:
        "roster_not_yet_valid",

      definitive:
        false,

      universityId,

      rosterImportId:
        roster.id,

      rosterAcademicSession:
        roster.academicSession,

      normalizedMatricNumber,

      reason:
        "The active roster has a future valid-from date.",

      rosterRecordId:
        null,
    };
  }

  if (
    roster.expiresAt &&
    roster.expiresAt.getTime() <=
      now.getTime()
  ) {
    return {
      matched:
        false,

      outcome:
        "roster_expired",

      definitive:
        false,

      universityId,

      rosterImportId:
        roster.id,

      rosterAcademicSession:
        roster.academicSession,

      normalizedMatricNumber,

      reason:
        "The active roster has expired and cannot be used for automatic verification.",

      rosterRecordId:
        null,
    };
  }

  /*
   * -----------------------------------------------------
   * MATRIC LOOKUP
   * -----------------------------------------------------
   *
   * Matric/student number identifies the candidate
   * authoritative row first.
   *
   * We do NOT search by name and then try to infer which
   * student the user meant.
   */

  const record =
    await prisma.universityRosterRecord.findUnique({
      where: {
        rosterImportId_normalizedMatricNumber: {
          rosterImportId:
            roster.id,

          normalizedMatricNumber,
        },
      },

      select: {
        id:
          true,

        fullName:
          true,

        isActiveStudent:
          true,
      },
    });

  if (
    !record
  ) {
    return {
      matched:
        false,

      outcome:
        "record_not_found",

      /*
       * A missing record is not treated as a definitive
       * identity mismatch.
       *
       * The roster may not yet contain a very recent
       * admission/transfer.
       *
       * The orchestration layer may therefore decide
       * whether Manual review is allowed by university
       * policy.
       */
      definitive:
        false,

      universityId,

      rosterImportId:
        roster.id,

      rosterAcademicSession:
        roster.academicSession,

      normalizedMatricNumber,

      reason:
        "No student record with this matric number exists in the active university roster.",

      rosterRecordId:
        null,
    };
  }

  /*
   * -----------------------------------------------------
   * NAME MATCH
   * -----------------------------------------------------
   *
   * studentNamesMatch already:
   *
   * - ignores harmless case differences
   * - ignores punctuation
   * - ignores token order
   * - permits genuine middle-name omission
   * - does NOT perform fuzzy spelling correction
   */

  const nameMatches =
    studentNamesMatch(
      record.fullName,
      fullName
    );

  if (
    !nameMatches
  ) {
    return {
      matched:
        false,

      outcome:
        "name_mismatch",

      /*
       * A matric number that resolves to one authoritative
       * record but whose name does not match is a clear
       * identity mismatch.
       *
       * This should NOT automatically fall into Manual
       * review merely to override the authoritative
       * failure.
       */
      definitive:
        true,

      universityId,

      rosterImportId:
        roster.id,

      rosterAcademicSession:
        roster.academicSession,

      normalizedMatricNumber,

      reason:
        "The submitted student name does not match the authoritative roster record for this matric number.",

      rosterRecordId:
        record.id,
    };
  }

  /*
   * -----------------------------------------------------
   * CURRENT STUDENT STATUS
   * -----------------------------------------------------
   */

  if (
    !record.isActiveStudent
  ) {
    return {
      matched:
        false,

      outcome:
        "inactive_student",

      definitive:
        true,

      universityId,

      rosterImportId:
        roster.id,

      rosterAcademicSession:
        roster.academicSession,

      normalizedMatricNumber,

      reason:
        "The university roster record exists and the name matches, but the record is not currently marked as an active student.",

      rosterRecordId:
        record.id,
    };
  }

  /*
   * -----------------------------------------------------
   * VERIFIED MATCH
   * -----------------------------------------------------
   */

  return {
    matched:
      true,

    outcome:
      "verified",

    definitive:
      true,

    universityId,

    rosterImportId:
      roster.id,

    rosterAcademicSession:
      roster.academicSession,

    normalizedMatricNumber,

    reason:
      "Matric number, student name, and current-student status match the active university roster.",

    rosterRecordId:
      record.id,
  };
}

/*
 * =======================================================
 * HELPERS
 * =======================================================
 */

function cleanRequiredText(
  value:
    unknown
): string {
  return typeof value ===
    "string"
    ? value
        .normalize(
          "NFKC"
        )
        .trim()
    : "";
}