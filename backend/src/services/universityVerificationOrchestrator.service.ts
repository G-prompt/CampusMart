import {
  UniversityVerificationSourceType,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

import {
  verifyStudentAgainstUniversityRoster,
  type UniversityRosterVerificationResult,
} from "./universityRosterVerification.service";

/*
 * =======================================================
 * CAMPUSMART UNIVERSITY VERIFICATION ORCHESTRATOR
 * =======================================================
 *
 * This service chooses which university verification
 * source should be consulted and how the results should
 * be interpreted.
 *
 * It deliberately separates:
 *
 * - provider execution
 * - provider authority
 * - fallback behaviour
 * - Manual review eligibility
 *
 * This service does NOT update User verification status.
 *
 * A later application/controller layer will decide when
 * an orchestration result should be persisted onto a User.
 */

/*
 * =======================================================
 * PROVIDER RESULT MODEL
 * =======================================================
 */

export type VerificationProviderOutcome =
  | "verified"
  | "definitive_failure"
  | "inconclusive"
  | "unavailable";

export type VerificationProviderFailureCode =
  | "name_mismatch"
  | "inactive_student"
  | "record_not_found"
  | "provider_not_connected"
  | "provider_unavailable"
  | "source_not_configured"
  | "roster_not_yet_valid"
  | "roster_expired"
  | "roster_configuration_conflict"
  | "unknown_provider_result";

export type VerificationProviderResult = {
  source:
    UniversityVerificationSourceType;

  outcome:
    VerificationProviderOutcome;

  failureCode:
    VerificationProviderFailureCode
    | null;

  /*
   * A definitive result must stop lower-authority
   * fallback paths.
   */
  definitive:
    boolean;

  /*
   * Safe generic message that can eventually be used by
   * authenticated customer-facing logic.
   *
   * It deliberately does not reveal another student's
   * identity or roster information.
   */
  publicMessage:
    string;

  /*
   * Internal operational explanation.
   *
   * Keep detailed provider reasoning inside trusted
   * backend/Admin paths.
   */
  internalReason:
    string;

  /*
   * Optional provider-specific internal reference.
   */
  providerReference:
    string
    | null;
};

/*
 * =======================================================
 * FINAL ORCHESTRATION RESULT
 * =======================================================
 */

export type UniversityVerificationDecision =
  | "verified"
  | "failed"
  | "manual_review_available"
  | "unresolved"
  | "verification_disabled"
  | "university_unavailable";

export type UniversityVerificationAttempt = {
  position:
    "primary"
    | "fallback";

  source:
    UniversityVerificationSourceType;

  result:
    VerificationProviderResult;
};

export type UniversityVerificationResult = {
  decision:
    UniversityVerificationDecision;

  universityId:
    string;

  universityName:
    string
    | null;

  studentVerificationEnabled:
    boolean;

  primarySource:
    UniversityVerificationSourceType;

  fallbackSource:
    UniversityVerificationSourceType;

  manualReviewEnabled:
    boolean;

  /*
   * Source that actually produced the final automated
   * verification result.
   */
  verifiedBy:
    UniversityVerificationSourceType
    | null;

  /*
   * True when an authoritative provider produced a clear
   * rejection such as:
   *
   * - name mismatch
   * - inactive student
   *
   * A definitive failure must not be casually overridden
   * through fallback or Manual review.
   */
  definitiveFailure:
    boolean;

  failureCode:
    VerificationProviderFailureCode
    | null;

  manualReviewAllowed:
    boolean;

  publicMessage:
    string;

  internalReason:
    string;

  attempts:
    UniversityVerificationAttempt[];
};

export type VerifyUniversityStudentInput = {
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
 * MAIN ORCHESTRATOR
 * =======================================================
 */

export async function verifyUniversityStudent(
  input:
    VerifyUniversityStudentInput
): Promise<UniversityVerificationResult> {
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

  if (
    !universityId
  ) {
    throw new Error(
      "University ID is required."
    );
  }

  if (
    !matricNumber
  ) {
    throw new Error(
      "Matric number is required."
    );
  }

  if (
    !fullName
  ) {
    throw new Error(
      "Student name is required."
    );
  }

  const university =
    await prisma.university.findUnique({
      where: {
        id:
          universityId,
      },

      select: {
        id:
          true,

        name:
          true,

        active:
          true,

        studentVerificationEnabled:
          true,

        primaryVerificationSource:
          true,

        fallbackVerificationSource:
          true,

        manualReviewEnabled:
          true,
      },
    });

  if (
    !university ||
    !university.active
  ) {
    return {
      decision:
        "university_unavailable",

      universityId,

      universityName:
        university?.name ??
        null,

      studentVerificationEnabled:
        false,

      primarySource:
        UniversityVerificationSourceType.none,

      fallbackSource:
        UniversityVerificationSourceType.none,

      manualReviewEnabled:
        false,

      verifiedBy:
        null,

      definitiveFailure:
        false,

      failureCode:
        null,

      manualReviewAllowed:
        false,

      publicMessage:
        "Student verification is not currently available for this university.",

      internalReason:
        university
          ? "The managed university exists but is inactive."
          : "The managed university record was not found.",

      attempts:
        [],
    };
  }

  if (
    !university.studentVerificationEnabled
  ) {
    return {
      decision:
        "verification_disabled",

      universityId:
        university.id,

      universityName:
        university.name,

      studentVerificationEnabled:
        false,

      primarySource:
        university.primaryVerificationSource,

      fallbackSource:
        university.fallbackVerificationSource,

      manualReviewEnabled:
        university.manualReviewEnabled,

      verifiedBy:
        null,

      definitiveFailure:
        false,

      failureCode:
        null,

      manualReviewAllowed:
        false,

      publicMessage:
        "Student verification is currently disabled for this university.",

      internalReason:
        "The university studentVerificationEnabled setting is false.",

      attempts:
        [],
    };
  }

  const attempts:
    UniversityVerificationAttempt[] =
    [];

  /*
   * =====================================================
   * PRIMARY SOURCE
   * =====================================================
   */

  if (
    university.primaryVerificationSource !==
    UniversityVerificationSourceType.none
  ) {
    const primaryResult =
      await executeVerificationProvider({
        source:
          university.primaryVerificationSource,

        universityId:
          university.id,

        matricNumber,

        fullName,

        now:
          input.now,
      });

    attempts.push({
      position:
        "primary",

      source:
        university.primaryVerificationSource,

      result:
        primaryResult,
    });

    /*
     * Successful authoritative result.
     */
    if (
      primaryResult.outcome ===
      "verified"
    ) {
      return createVerifiedResult({
        university,

        attempts,

        source:
          primaryResult.source,

        result:
          primaryResult,
      });
    }

    /*
     * A definitive failure from the primary source stops
     * everything.
     *
     * We do NOT:
     *
     * - consult fallback
     * - offer Manual review
     *
     * merely to override an authoritative mismatch.
     */
    if (
      primaryResult.outcome ===
        "definitive_failure" ||
      primaryResult.definitive
    ) {
      return createDefinitiveFailureResult({
        university,

        attempts,

        result:
          primaryResult,
      });
    }
  }

  /*
   * =====================================================
   * FALLBACK SOURCE
   * =====================================================
   *
   * Fallback is reached only if:
   *
   * - primary was not configured
   * - primary was unavailable
   * - primary was inconclusive
   *
   * A definitive primary failure never reaches here.
   */

  if (
    university.fallbackVerificationSource !==
    UniversityVerificationSourceType.none
  ) {
    /*
     * Defensive protection against bad configuration.
     */
    if (
      university.fallbackVerificationSource ===
      university.primaryVerificationSource
    ) {
      return {
        decision:
          university.manualReviewEnabled
            ? "manual_review_available"
            : "unresolved",

        universityId:
          university.id,

        universityName:
          university.name,

        studentVerificationEnabled:
          university.studentVerificationEnabled,

        primarySource:
          university.primaryVerificationSource,

        fallbackSource:
          university.fallbackVerificationSource,

        manualReviewEnabled:
          university.manualReviewEnabled,

        verifiedBy:
          null,

        definitiveFailure:
          false,

        failureCode:
          "source_not_configured",

        manualReviewAllowed:
          university.manualReviewEnabled,

        publicMessage:
          university.manualReviewEnabled
            ? "Automatic verification could not be completed. You may continue through Manual review."
            : "Automatic verification could not be completed.",

        internalReason:
          "Primary and fallback verification sources are configured to the same provider.",

        attempts,
      };
    }

    const fallbackResult =
      await executeVerificationProvider({
        source:
          university.fallbackVerificationSource,

        universityId:
          university.id,

        matricNumber,

        fullName,

        now:
          input.now,
      });

    attempts.push({
      position:
        "fallback",

      source:
        university.fallbackVerificationSource,

      result:
        fallbackResult,
    });

    if (
      fallbackResult.outcome ===
      "verified"
    ) {
      return createVerifiedResult({
        university,

        attempts,

        source:
          fallbackResult.source,

        result:
          fallbackResult,
      });
    }

    /*
     * The fallback source is still authoritative for the
     * identity information it actually returned.
     *
     * Example:
     *
     * roster matric exists
     * + submitted name is wrong
     *
     * That is not a system exception.
     */
    if (
      fallbackResult.outcome ===
        "definitive_failure" ||
      fallbackResult.definitive
    ) {
      return createDefinitiveFailureResult({
        university,

        attempts,

        result:
          fallbackResult,
      });
    }
  }

  /*
   * =====================================================
   * MANUAL REVIEW
   * =====================================================
   *
   * We reach Manual review only when all attempted
   * automated sources were:
   *
   * - unavailable
   * - inconclusive
   *
   * Examples:
   *
   * - roster record not found
   * - roster expired
   * - provider unavailable
   * - newly admitted student not yet in source
   *
   * This is intentionally different from:
   *
   * - name mismatch
   * - inactive student
   */

  if (
    university.manualReviewEnabled
  ) {
    const lastAttempt =
      attempts[
        attempts.length -
        1
      ];

    return {
      decision:
        "manual_review_available",

      universityId:
        university.id,

      universityName:
        university.name,

      studentVerificationEnabled:
        university.studentVerificationEnabled,

      primarySource:
        university.primaryVerificationSource,

      fallbackSource:
        university.fallbackVerificationSource,

      manualReviewEnabled:
        true,

      verifiedBy:
        null,

      definitiveFailure:
        false,

      failureCode:
        lastAttempt
          ?.result
          .failureCode ??
        null,

      manualReviewAllowed:
        true,

      publicMessage:
        "Automatic verification could not be completed. You may continue through Manual review.",

      internalReason:
        buildUnresolvedReason(
          attempts,
          "Automated verification did not produce a definitive result and Manual review is enabled."
        ),

      attempts,
    };
  }

  /*
   * No automated source could verify the student and
   * Manual review is not available.
   */

  const lastAttempt =
    attempts[
      attempts.length -
      1
    ];

  return {
    decision:
      "unresolved",

    universityId:
      university.id,

    universityName:
      university.name,

    studentVerificationEnabled:
      university.studentVerificationEnabled,

    primarySource:
      university.primaryVerificationSource,

    fallbackSource:
      university.fallbackVerificationSource,

    manualReviewEnabled:
      false,

    verifiedBy:
      null,

    definitiveFailure:
      false,

    failureCode:
      lastAttempt
        ?.result
        .failureCode ??
      null,

    manualReviewAllowed:
      false,

    publicMessage:
      "Student verification could not be completed at this time.",

    internalReason:
      buildUnresolvedReason(
        attempts,
        "Automated verification did not produce a definitive result and Manual review is disabled."
      ),

    attempts,
  };
}

/*
 * =======================================================
 * PROVIDER EXECUTION
 * =======================================================
 */

type ExecuteVerificationProviderInput = {
  source:
    UniversityVerificationSourceType;

  universityId:
    string;

  matricNumber:
    string;

  fullName:
    string;

  now?:
    Date;
};

async function executeVerificationProvider(
  input:
    ExecuteVerificationProviderInput
): Promise<VerificationProviderResult> {
  switch (
    input.source
  ) {
    case UniversityVerificationSourceType.roster_import:
      return executeRosterProvider(
        input
      );

    case UniversityVerificationSourceType.university_api:
      /*
       * No real university API integration exists yet.
       *
       * Never pretend success or failure based purely on
       * the university configuration setting.
       */
      return {
        source:
          UniversityVerificationSourceType.university_api,

        outcome:
          "unavailable",

        failureCode:
          "provider_not_connected",

        definitive:
          false,

        publicMessage:
          "The university verification service is temporarily unavailable.",

        internalReason:
          "University API is configured as a source type but no approved live API provider is connected.",

        providerReference:
          null,
      };

    case UniversityVerificationSourceType.university_database:
      /*
       * Same rule as API.
       *
       * A configured enum value does not prove that a
       * database integration exists.
       */
      return {
        source:
          UniversityVerificationSourceType.university_database,

        outcome:
          "unavailable",

        failureCode:
          "provider_not_connected",

        definitive:
          false,

        publicMessage:
          "The university verification service is temporarily unavailable.",

        internalReason:
          "University database is configured as a source type but no approved live database provider is connected.",

        providerReference:
          null,
      };

    case UniversityVerificationSourceType.none:
    default:
      return {
        source:
          UniversityVerificationSourceType.none,

        outcome:
          "unavailable",

        failureCode:
          "source_not_configured",

        definitive:
          false,

        publicMessage:
          "No automatic university verification source is configured.",

        internalReason:
          "Verification provider execution was requested with source=none.",

        providerReference:
          null,
      };
  }
}

/*
 * =======================================================
 * ROSTER PROVIDER ADAPTER
 * =======================================================
 */

async function executeRosterProvider(
  input:
    ExecuteVerificationProviderInput
): Promise<VerificationProviderResult> {
  const rosterResult =
    await verifyStudentAgainstUniversityRoster({
      universityId:
        input.universityId,

      matricNumber:
        input.matricNumber,

      fullName:
        input.fullName,

      now:
        input.now,
    });

  return mapRosterResult(
    rosterResult
  );
}

function mapRosterResult(
  result:
    UniversityRosterVerificationResult
): VerificationProviderResult {
  switch (
    result.outcome
  ) {
    case "verified":
      return {
        source:
          UniversityVerificationSourceType.roster_import,

        outcome:
          "verified",

        failureCode:
          null,

        definitive:
          true,

        publicMessage:
          "Student status verified successfully.",

        internalReason:
          result.reason,

        providerReference:
          result.rosterRecordId,
      };

    case "name_mismatch":
      return {
        source:
          UniversityVerificationSourceType.roster_import,

        outcome:
          "definitive_failure",

        failureCode:
          "name_mismatch",

        definitive:
          true,

        /*
         * Deliberately generic.
         *
         * Do not expose the authoritative roster name.
         */
        publicMessage:
          "The submitted student details could not be verified.",

        internalReason:
          result.reason,

        providerReference:
          result.rosterRecordId,
      };

    case "inactive_student":
      return {
        source:
          UniversityVerificationSourceType.roster_import,

        outcome:
          "definitive_failure",

        failureCode:
          "inactive_student",

        definitive:
          true,

        publicMessage:
          "The submitted student details could not be verified as a current student.",

        internalReason:
          result.reason,

        providerReference:
          result.rosterRecordId,
      };

    case "record_not_found":
      return {
        source:
          UniversityVerificationSourceType.roster_import,

        outcome:
          "inconclusive",

        failureCode:
          "record_not_found",

        definitive:
          false,

        /*
         * Do not expose whether a particular matric number
         * exists in the university roster.
         */
        publicMessage:
          "Automatic verification could not confirm the submitted student details.",

        internalReason:
          result.reason,

        providerReference:
          null,
      };

    case "roster_not_yet_valid":
      return {
        source:
          UniversityVerificationSourceType.roster_import,

        outcome:
          "unavailable",

        failureCode:
          "roster_not_yet_valid",

        definitive:
          false,

        publicMessage:
          "Automatic university verification is not currently available.",

        internalReason:
          result.reason,

        providerReference:
          result.rosterImportId,
      };

    case "roster_expired":
      return {
        source:
          UniversityVerificationSourceType.roster_import,

        outcome:
          "unavailable",

        failureCode:
          "roster_expired",

        definitive:
          false,

        publicMessage:
          "Automatic university verification is temporarily unavailable.",

        internalReason:
          result.reason,

        providerReference:
          result.rosterImportId,
      };

    case "roster_configuration_conflict":
      return {
        source:
          UniversityVerificationSourceType.roster_import,

        outcome:
          "unavailable",

        failureCode:
          "roster_configuration_conflict",

        definitive:
          false,

        publicMessage:
          "Automatic university verification is temporarily unavailable.",

        internalReason:
          result.reason,

        providerReference:
          null,
      };

    case "no_active_roster":
      return {
        source:
          UniversityVerificationSourceType.roster_import,

        outcome:
          "unavailable",

        failureCode:
          "provider_unavailable",

        definitive:
          false,

        publicMessage:
          "Automatic university verification is temporarily unavailable.",

        internalReason:
          result.reason,

        providerReference:
          null,
      };

    default:
      return {
        source:
          UniversityVerificationSourceType.roster_import,

        outcome:
          "unavailable",

        failureCode:
          "unknown_provider_result",

        definitive:
          false,

        publicMessage:
          "Automatic university verification could not be completed.",

        internalReason:
          `Unexpected roster verification outcome: ${String(
            result.outcome
          )}`,

        providerReference:
          null,
      };
  }
}

/*
 * =======================================================
 * RESULT BUILDERS
 * =======================================================
 */

type UniversityConfigForResult = {
  id:
    string;

  name:
    string;

  studentVerificationEnabled:
    boolean;

  primaryVerificationSource:
    UniversityVerificationSourceType;

  fallbackVerificationSource:
    UniversityVerificationSourceType;

  manualReviewEnabled:
    boolean;
};

function createVerifiedResult({
  university,
  attempts,
  source,
  result,
}: {
  university:
    UniversityConfigForResult;

  attempts:
    UniversityVerificationAttempt[];

  source:
    UniversityVerificationSourceType;

  result:
    VerificationProviderResult;
}): UniversityVerificationResult {
  return {
    decision:
      "verified",

    universityId:
      university.id,

    universityName:
      university.name,

    studentVerificationEnabled:
      university.studentVerificationEnabled,

    primarySource:
      university.primaryVerificationSource,

    fallbackSource:
      university.fallbackVerificationSource,

    manualReviewEnabled:
      university.manualReviewEnabled,

    verifiedBy:
      source,

    definitiveFailure:
      false,

    failureCode:
      null,

    manualReviewAllowed:
      false,

    publicMessage:
      result.publicMessage,

    internalReason:
      result.internalReason,

    attempts,
  };
}

function createDefinitiveFailureResult({
  university,
  attempts,
  result,
}: {
  university:
    UniversityConfigForResult;

  attempts:
    UniversityVerificationAttempt[];

  result:
    VerificationProviderResult;
}): UniversityVerificationResult {
  return {
    decision:
      "failed",

    universityId:
      university.id,

    universityName:
      university.name,

    studentVerificationEnabled:
      university.studentVerificationEnabled,

    primarySource:
      university.primaryVerificationSource,

    fallbackSource:
      university.fallbackVerificationSource,

    manualReviewEnabled:
      university.manualReviewEnabled,

    verifiedBy:
      null,

    definitiveFailure:
      true,

    failureCode:
      result.failureCode,

    /*
     * Deliberately false even if university Manual review
     * is enabled.
     *
     * Manual review must not become an override button for
     * a clear authoritative mismatch.
     */
    manualReviewAllowed:
      false,

    publicMessage:
      result.publicMessage,

    internalReason:
      result.internalReason,

    attempts,
  };
}

function buildUnresolvedReason(
  attempts:
    UniversityVerificationAttempt[],

  suffix:
    string
): string {
  if (
    attempts.length ===
    0
  ) {
    return `No automated verification source was attempted. ${suffix}`;
  }

  const attemptSummary =
    attempts
      .map(
        (
          attempt
        ) =>
          `${attempt.position}:${attempt.source}:${attempt.result.outcome}:${attempt.result.failureCode ?? "none"}`
      )
      .join(
        " | "
      );

  return `${attemptSummary}. ${suffix}`;
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