import assert from "node:assert/strict";

import {
  UniversityVerificationSourceType,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

import {
  verifyUniversityStudent,
} from "../src/services/universityVerificationOrchestrator.service";

/*
 * =======================================================
 * CAMPUSMART VERIFICATION ORCHESTRATOR TEST
 * =======================================================
 *
 * This script temporarily changes University of Uyo's
 * verification-source configuration.
 *
 * It restores the original configuration afterwards.
 *
 * It DOES NOT:
 *
 * - update User verification status
 * - create Manual review appeals
 * - alter roster records
 * - delete roster imports
 */

let passed = 0;

let failed = 0;

async function test(
  name: string,
  callback: () => Promise<void>
) {
  try {
    await callback();

    passed += 1;

    console.log(
      `PASS  ${name}`
    );
  } catch (error) {
    failed += 1;

    console.error(
      `FAIL  ${name}`
    );

    console.error(
      error
    );
  }
}

async function configureUniversity(
  universityId: string,
  config: {
    studentVerificationEnabled: boolean;

    primaryVerificationSource:
      UniversityVerificationSourceType;

    fallbackVerificationSource:
      UniversityVerificationSourceType;

    manualReviewEnabled: boolean;
  }
) {
  await prisma.university.update({
    where: {
      id: universityId,
    },

    data: {
      studentVerificationEnabled:
        config.studentVerificationEnabled,

      primaryVerificationSource:
        config.primaryVerificationSource,

      fallbackVerificationSource:
        config.fallbackVerificationSource,

      manualReviewEnabled:
        config.manualReviewEnabled,
    },
  });
}

async function main() {
  const university =
    await prisma.university.findUnique({
      where: {
        slug: "university-of-uyo",
      },

      select: {
        id: true,

        name: true,

        shortName: true,

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

  if (!university) {
    throw new Error(
      'University with slug "university-of-uyo" was not found.'
    );
  }

  const originalConfig = {
    studentVerificationEnabled:
      university.studentVerificationEnabled,

    primaryVerificationSource:
      university.primaryVerificationSource,

    fallbackVerificationSource:
      university.fallbackVerificationSource,

    manualReviewEnabled:
      university.manualReviewEnabled,
  };

  console.log("");
  console.log(
    "CampusMart verification orchestrator test"
  );
  console.log(
    "----------------------------------------"
  );
  console.log(
    `University: ${university.name} (${university.shortName})`
  );
  console.log("");

  try {
    /*
     * ===================================================
     * 1. ROSTER PRIMARY — SUCCESS
     * ===================================================
     */

    await configureUniversity(
      university.id,
      {
        studentVerificationEnabled:
          true,

        primaryVerificationSource:
          UniversityVerificationSourceType.roster_import,

        fallbackVerificationSource:
          UniversityVerificationSourceType.none,

        manualReviewEnabled:
          true,
      }
    );

    await test(
      "Roster primary verifies a correct active student",
      async () => {
        const result =
          await verifyUniversityStudent({
            universityId:
              university.id,

            matricNumber:
              "U2023/100001",

            fullName:
              "John Chukwu Okafor",
          });

        assert.equal(
          result.decision,
          "verified"
        );

        assert.equal(
          result.verifiedBy,
          UniversityVerificationSourceType.roster_import
        );

        assert.equal(
          result.definitiveFailure,
          false
        );

        assert.equal(
          result.manualReviewAllowed,
          false
        );

        assert.equal(
          result.attempts.length,
          1
        );

        assert.equal(
          result.attempts[0].position,
          "primary"
        );
      }
    );

    /*
     * ===================================================
     * 2. DEFINITIVE NAME MISMATCH
     * ===================================================
     */

    await test(
      "Definitive roster name mismatch blocks Manual review",
      async () => {
        const result =
          await verifyUniversityStudent({
            universityId:
              university.id,

            matricNumber:
              "U2023/100001",

            fullName:
              "Emeka Okafor",
          });

        assert.equal(
          result.decision,
          "failed"
        );

        assert.equal(
          result.failureCode,
          "name_mismatch"
        );

        assert.equal(
          result.definitiveFailure,
          true
        );

        assert.equal(
          result.manualReviewAllowed,
          false
        );

        assert.equal(
          result.attempts.length,
          1
        );
      }
    );

    /*
     * ===================================================
     * 3. DEFINITIVE INACTIVE STUDENT
     * ===================================================
     */

    await test(
      "Inactive roster student blocks Manual review",
      async () => {
        const result =
          await verifyUniversityStudent({
            universityId:
              university.id,

            matricNumber:
              "U2020/100004",

            fullName:
              "Chiamaka Rose Eze",
          });

        assert.equal(
          result.decision,
          "failed"
        );

        assert.equal(
          result.failureCode,
          "inactive_student"
        );

        assert.equal(
          result.definitiveFailure,
          true
        );

        assert.equal(
          result.manualReviewAllowed,
          false
        );
      }
    );

    /*
     * ===================================================
     * 4. INCONCLUSIVE ROSTER RESULT → MANUAL
     * ===================================================
     */

    await test(
      "Missing roster record permits Manual review when enabled",
      async () => {
        const result =
          await verifyUniversityStudent({
            universityId:
              university.id,

            matricNumber:
              "U2099/999999",

            fullName:
              "Test Student",
          });

        assert.equal(
          result.decision,
          "manual_review_available"
        );

        assert.equal(
          result.failureCode,
          "record_not_found"
        );

        assert.equal(
          result.definitiveFailure,
          false
        );

        assert.equal(
          result.manualReviewAllowed,
          true
        );

        assert.equal(
          result.attempts.length,
          1
        );
      }
    );

    /*
     * ===================================================
     * 5. PRIMARY API UNAVAILABLE → FALLBACK ROSTER
     * ===================================================
     *
     * We do not have a real API provider.
     *
     * The orchestrator must therefore treat API as
     * unavailable rather than pretending a response.
     */

    await configureUniversity(
      university.id,
      {
        studentVerificationEnabled:
          true,

        primaryVerificationSource:
          UniversityVerificationSourceType.university_api,

        fallbackVerificationSource:
          UniversityVerificationSourceType.roster_import,

        manualReviewEnabled:
          true,
      }
    );

    await test(
      "Unavailable API falls back to roster",
      async () => {
        const result =
          await verifyUniversityStudent({
            universityId:
              university.id,

            matricNumber:
              "U2023/100002",

            fullName:
              "Ada Grace Nwosu",
          });

        assert.equal(
          result.decision,
          "verified"
        );

        assert.equal(
          result.verifiedBy,
          UniversityVerificationSourceType.roster_import
        );

        assert.equal(
          result.attempts.length,
          2
        );

        assert.equal(
          result.attempts[0].source,
          UniversityVerificationSourceType.university_api
        );

        assert.equal(
          result.attempts[0].result.outcome,
          "unavailable"
        );

        assert.equal(
          result.attempts[0].result.failureCode,
          "provider_not_connected"
        );

        assert.equal(
          result.attempts[1].source,
          UniversityVerificationSourceType.roster_import
        );

        assert.equal(
          result.attempts[1].result.outcome,
          "verified"
        );
      }
    );

    /*
     * ===================================================
     * 6. FALLBACK DEFINITIVE FAILURE
     * ===================================================
     */

    await test(
      "Fallback roster definitive mismatch still blocks Manual review",
      async () => {
        const result =
          await verifyUniversityStudent({
            universityId:
              university.id,

            matricNumber:
              "U2023/100002",

            fullName:
              "Wrong Student Name",
          });

        assert.equal(
          result.decision,
          "failed"
        );

        assert.equal(
          result.failureCode,
          "name_mismatch"
        );

        assert.equal(
          result.definitiveFailure,
          true
        );

        assert.equal(
          result.manualReviewAllowed,
          false
        );

        assert.equal(
          result.attempts.length,
          2
        );
      }
    );

    /*
     * ===================================================
     * 7. NO MANUAL REVIEW
     * ===================================================
     */

    await configureUniversity(
      university.id,
      {
        studentVerificationEnabled:
          true,

        primaryVerificationSource:
          UniversityVerificationSourceType.roster_import,

        fallbackVerificationSource:
          UniversityVerificationSourceType.none,

        manualReviewEnabled:
          false,
      }
    );

    await test(
      "Inconclusive roster result stays unresolved when Manual review is disabled",
      async () => {
        const result =
          await verifyUniversityStudent({
            universityId:
              university.id,

            matricNumber:
              "U2099/999999",

            fullName:
              "Test Student",
          });

        assert.equal(
          result.decision,
          "unresolved"
        );

        assert.equal(
          result.failureCode,
          "record_not_found"
        );

        assert.equal(
          result.manualReviewAllowed,
          false
        );

        assert.equal(
          result.definitiveFailure,
          false
        );
      }
    );

    /*
     * ===================================================
     * 8. VERIFICATION DISABLED
     * ===================================================
     */

    await configureUniversity(
      university.id,
      {
        studentVerificationEnabled:
          false,

        primaryVerificationSource:
          UniversityVerificationSourceType.none,

        fallbackVerificationSource:
          UniversityVerificationSourceType.none,

        manualReviewEnabled:
          false,
      }
    );

    await test(
      "Disabled university verification stops before provider execution",
      async () => {
        const result =
          await verifyUniversityStudent({
            universityId:
              university.id,

            matricNumber:
              "U2023/100001",

            fullName:
              "John Chukwu Okafor",
          });

        assert.equal(
          result.decision,
          "verification_disabled"
        );

        assert.equal(
          result.attempts.length,
          0
        );

        assert.equal(
          result.verifiedBy,
          null
        );

        assert.equal(
          result.manualReviewAllowed,
          false
        );
      }
    );
  } finally {
    /*
     * ===================================================
     * RESTORE ORIGINAL UNIVERSITY CONFIGURATION
     * ===================================================
     *
     * This runs even when an assertion fails.
     */

    await configureUniversity(
      university.id,
      originalConfig
    );

    console.log("");
    console.log(
      "Original University of Uyo verification configuration restored."
    );
  }

  console.log("");
  console.log(
    "Verification orchestrator test summary"
  );
  console.log(
    "--------------------------------------"
  );
  console.log(
    `Passed: ${passed}`
  );
  console.log(
    `Failed: ${failed}`
  );
  console.log("");

  if (
    failed >
    0
  ) {
    console.error(
      "Verification orchestrator tests failed."
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    "All verification orchestrator tests passed."
  );
}

main()
  .catch(
    (
      error
    ) => {
      console.error("");
      console.error(
        "Verification orchestrator test setup failed:"
      );
      console.error(
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    }
  );