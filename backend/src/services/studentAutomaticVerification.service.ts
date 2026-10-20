import {
  StudentVerificationSource,
  StudentVerificationStatus,
  UniversityVerificationSourceType,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

import {
  verifyUniversityStudent,
  type UniversityVerificationResult,
} from "./universityVerificationOrchestrator.service";

/*
 * =======================================================
 * CAMPUSMART AUTOMATIC STUDENT VERIFICATION
 * =======================================================
 *
 * This is the application layer that connects:
 *
 * User account
 *      ↓
 * university verification orchestrator
 *      ↓
 * persisted student verification state
 *
 * Responsibilities:
 *
 * - load the authenticated user's identity inputs
 * - prevent accidental re-verification of an already
 *   verified account
 * - run the university source orchestrator
 * - persist successful automated verification
 * - persist definitive automated failure
 * - leave inconclusive/manual-review cases for the
 *   existing appeal workflow
 *
 * This service does NOT:
 *
 * - create an appeal automatically
 * - upload evidence
 * - approve Manual review
 * - activate seller access
 * - modify Vendor Verification
 *
 * Student verification and vendor verification remain
 * separate trust systems.
 */

export type AutomaticStudentVerificationDecision =
  | "verified"
  | "failed"
  | "manual_review_available"
  | "unresolved"
  | "verification_disabled"
  | "university_unavailable"
  | "profile_incomplete"
  | "already_verified";

export type AutomaticStudentVerificationResult = {
  decision:
    AutomaticStudentVerificationDecision;

  userId:
    string;

  universityId:
    string
    | null;

  studentVerificationStatus:
    StudentVerificationStatus;

  studentVerificationSource:
    StudentVerificationSource;

  studentVerifiedAt:
    Date
    | null;

  manualReviewAllowed:
    boolean;

  definitiveFailure:
    boolean;

  failureCode:
    string
    | null;

  publicMessage:
    string;

  /*
   * Returned for trusted backend/controller logic.
   *
   * Do not expose provider internals blindly through a
   * public endpoint.
   */
  orchestration:
    UniversityVerificationResult
    | null;
};

/*
 * =======================================================
 * MAIN APPLICATION SERVICE
 * =======================================================
 */

export async function runAutomaticStudentVerification(
  userId:
    string
): Promise<AutomaticStudentVerificationResult> {
  const normalizedUserId =
    cleanRequiredText(
      userId
    );

  if (
    !normalizedUserId
  ) {
    throw new Error(
      "User ID is required for automatic student verification."
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id:
          normalizedUserId,
      },

      select: {
        id:
          true,

        name:
          true,

        universityId:
          true,

        matricNumber:
          true,

        studentVerificationStatus:
          true,

        studentVerificationSource:
          true,

        studentVerifiedAt:
          true,
      },
    });

  if (
    !user
  ) {
    throw new AutomaticStudentVerificationError(
      "USER_NOT_FOUND",
      "User account not found.",
      404
    );
  }

  /*
   * =====================================================
   * ALREADY VERIFIED
   * =====================================================
   *
   * Automatic verification must not casually replace an
   * existing successful verification source.
   *
   * Example:
   *
   * A student already approved through private Manual
   * review must not suddenly be rewritten to roster
   * verification because they press Verify again.
   */

  if (
    user.studentVerificationStatus ===
    StudentVerificationStatus.verified
  ) {
    return {
      decision:
        "already_verified",

      userId:
        user.id,

      universityId:
        user.universityId,

      studentVerificationStatus:
        user.studentVerificationStatus,

      studentVerificationSource:
        user.studentVerificationSource,

      studentVerifiedAt:
        user.studentVerifiedAt,

      manualReviewAllowed:
        false,

      definitiveFailure:
        false,

      failureCode:
        null,

      publicMessage:
        "Your student status is already verified.",

      orchestration:
        null,
    };
  }

  /*
   * =====================================================
   * REQUIRED PROFILE INPUTS
   * =====================================================
   */

  if (
    !user.universityId ||
    !cleanRequiredText(
      user.matricNumber
    ) ||
    !cleanRequiredText(
      user.name
    )
  ) {
    return {
      decision:
        "profile_incomplete",

      userId:
        user.id,

      universityId:
        user.universityId,

      studentVerificationStatus:
        user.studentVerificationStatus,

      studentVerificationSource:
        user.studentVerificationSource,

      studentVerifiedAt:
        user.studentVerifiedAt,

      manualReviewAllowed:
        false,

      definitiveFailure:
        false,

      failureCode:
        null,

      publicMessage:
        "Complete your university, matric number, and official name before starting student verification.",

      orchestration:
        null,
    };
  }

  /*
   * =====================================================
   * ORCHESTRATION
   * =====================================================
   */

  const orchestration =
    await verifyUniversityStudent({
      universityId:
        user.universityId,

      matricNumber:
        user.matricNumber!,

      fullName:
        user.name,
    });

  /*
   * =====================================================
   * SUCCESSFUL AUTOMATED VERIFICATION
   * =====================================================
   */

  if (
    orchestration.decision ===
    "verified"
  ) {
    const verificationSource =
      mapAutomatedVerificationSource(
        orchestration.verifiedBy
      );

    /*
     * The orchestrator should never return verified
     * without a real automated source.
     *
     * Fail closed if that invariant is ever broken.
     */
    if (
      verificationSource ===
      StudentVerificationSource.none
    ) {
      throw new AutomaticStudentVerificationError(
        "VERIFIED_WITHOUT_SOURCE",
        "Automatic verification returned success without a valid verification source.",
        500
      );
    }

    const verifiedAt =
      new Date();

    const updatedUser =
      await prisma.user.update({
        where: {
          id:
            user.id,
        },

        data: {
          studentVerificationStatus:
            StudentVerificationStatus.verified,

          studentVerificationSource:
            verificationSource,

          studentVerifiedAt:
            verifiedAt,
        },

        select: {
          id:
            true,

          universityId:
            true,

          studentVerificationStatus:
            true,

          studentVerificationSource:
            true,

          studentVerifiedAt:
            true,
        },
      });

    return {
      decision:
        "verified",

      userId:
        updatedUser.id,

      universityId:
        updatedUser.universityId,

      studentVerificationStatus:
        updatedUser.studentVerificationStatus,

      studentVerificationSource:
        updatedUser.studentVerificationSource,

      studentVerifiedAt:
        updatedUser.studentVerifiedAt,

      manualReviewAllowed:
        false,

      definitiveFailure:
        false,

      failureCode:
        null,

      publicMessage:
        orchestration.publicMessage,

      orchestration,
    };
  }

  /*
   * =====================================================
   * DEFINITIVE AUTHORITATIVE FAILURE
   * =====================================================
   *
   * Examples:
   *
   * - matric resolves to a record but the name is wrong
   * - matched record is not a current student
   *
   * These are real identity/status failures.
   *
   * They are persisted as failed and are NOT converted
   * into a Manual review shortcut.
   */

  if (
    orchestration.decision ===
      "failed" &&
    orchestration.definitiveFailure
  ) {
    const updatedUser =
      await prisma.user.update({
        where: {
          id:
            user.id,
        },

        data: {
          studentVerificationStatus:
            StudentVerificationStatus.failed,

          studentVerificationSource:
            StudentVerificationSource.none,

          studentVerifiedAt:
            null,
        },

        select: {
          id:
            true,

          universityId:
            true,

          studentVerificationStatus:
            true,

          studentVerificationSource:
            true,

          studentVerifiedAt:
            true,
        },
      });

    return {
      decision:
        "failed",

      userId:
        updatedUser.id,

      universityId:
        updatedUser.universityId,

      studentVerificationStatus:
        updatedUser.studentVerificationStatus,

      studentVerificationSource:
        updatedUser.studentVerificationSource,

      studentVerifiedAt:
        updatedUser.studentVerifiedAt,

      manualReviewAllowed:
        false,

      definitiveFailure:
        true,

      failureCode:
        orchestration.failureCode,

      publicMessage:
        orchestration.publicMessage,

      orchestration,
    };
  }

  /*
   * =====================================================
   * MANUAL REVIEW AVAILABLE
   * =====================================================
   *
   * Important:
   *
   * We do NOT set pending here.
   *
   * "Manual review is available" does not mean a review
   * case has actually been created/submitted.
   *
   * The existing appeal workflow remains responsible for
   * creating the draft, evidence upload, submission, and
   * the pending state.
   */

  if (
    orchestration.decision ===
    "manual_review_available"
  ) {
    return {
      decision:
        "manual_review_available",

      userId:
        user.id,

      universityId:
        user.universityId,

      studentVerificationStatus:
        user.studentVerificationStatus,

      studentVerificationSource:
        user.studentVerificationSource,

      studentVerifiedAt:
        user.studentVerifiedAt,

      manualReviewAllowed:
        true,

      definitiveFailure:
        false,

      failureCode:
        orchestration.failureCode,

      publicMessage:
        orchestration.publicMessage,

      orchestration,
    };
  }

  /*
   * =====================================================
   * VERIFICATION DISABLED
   * =====================================================
   */

  if (
    orchestration.decision ===
    "verification_disabled"
  ) {
    return {
      decision:
        "verification_disabled",

      userId:
        user.id,

      universityId:
        user.universityId,

      studentVerificationStatus:
        user.studentVerificationStatus,

      studentVerificationSource:
        user.studentVerificationSource,

      studentVerifiedAt:
        user.studentVerifiedAt,

      manualReviewAllowed:
        false,

      definitiveFailure:
        false,

      failureCode:
        orchestration.failureCode,

      publicMessage:
        orchestration.publicMessage,

      orchestration,
    };
  }

  /*
   * =====================================================
   * UNIVERSITY UNAVAILABLE
   * =====================================================
   */

  if (
    orchestration.decision ===
    "university_unavailable"
  ) {
    return {
      decision:
        "university_unavailable",

      userId:
        user.id,

      universityId:
        user.universityId,

      studentVerificationStatus:
        user.studentVerificationStatus,

      studentVerificationSource:
        user.studentVerificationSource,

      studentVerifiedAt:
        user.studentVerifiedAt,

      manualReviewAllowed:
        false,

      definitiveFailure:
        false,

      failureCode:
        orchestration.failureCode,

      publicMessage:
        orchestration.publicMessage,

      orchestration,
    };
  }

  /*
   * =====================================================
   * UNRESOLVED
   * =====================================================
   *
   * No provider produced a definitive answer and Manual
   * review is not available.
   *
   * Do not manufacture a failed identity state.
   */

  return {
    decision:
      "unresolved",

    userId:
      user.id,

    universityId:
      user.universityId,

    studentVerificationStatus:
      user.studentVerificationStatus,

    studentVerificationSource:
      user.studentVerificationSource,

    studentVerifiedAt:
      user.studentVerifiedAt,

    manualReviewAllowed:
      false,

    definitiveFailure:
      false,

    failureCode:
      orchestration.failureCode,

    publicMessage:
      orchestration.publicMessage,

    orchestration,
  };
}

/*
 * =======================================================
 * SOURCE MAPPING
 * =======================================================
 *
 * The orchestration layer speaks in university provider
 * types.
 *
 * User verification history speaks in the existing
 * StudentVerificationSource enum.
 */

function mapAutomatedVerificationSource(
  source:
    UniversityVerificationSourceType
    | null
): StudentVerificationSource {
  switch (
    source
  ) {
    case UniversityVerificationSourceType.roster_import:
      return StudentVerificationSource.university_roster_import;

    case UniversityVerificationSourceType.university_api:
      return StudentVerificationSource.university_api;

    case UniversityVerificationSourceType.university_database:
      return StudentVerificationSource.university_database;

    case UniversityVerificationSourceType.none:
    default:
      return StudentVerificationSource.none;
  }
}

/*
 * =======================================================
 * SERVICE ERROR
 * =======================================================
 */

export class AutomaticStudentVerificationError
  extends Error {
  code:
    string;

  statusCode:
    number;

  constructor(
    code:
      string,

    message:
      string,

    statusCode =
      400
  ) {
    super(
      message
    );

    this.name =
      "AutomaticStudentVerificationError";

    this.code =
      code;

    this.statusCode =
      statusCode;
  }
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