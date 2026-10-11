import assert from "node:assert/strict";

import {
  StudentVerificationSource,
  StudentVerificationStatus,
  UniversityVerificationSourceType,
  UserRole,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

import {
  runAutomaticStudentVerification,
} from "../src/services/studentAutomaticVerification.service";

/*
 * =======================================================
 * CAMPUSMART AUTOMATIC STUDENT VERIFICATION TEST
 * =======================================================
 *
 * This test creates temporary development users only.
 *
 * It DOES NOT touch normal/demo accounts.
 *
 * It proves:
 *
 * 1. valid roster identity → User becomes verified
 * 2. definitive name mismatch → User becomes failed
 * 3. missing roster record → Manual review may be offered
 *    without falsely setting verified/failed
 * 4. already-verified account is not rewritten
 *
 * All temporary users are deleted afterwards.
 *
 * University verification configuration is also restored.
 */

const TEST_EMAIL_PREFIX =
  "campusmart-auto-verification-test-";

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

async function main() {
  /*
   * Clean up leftovers from an interrupted previous run.
   */
  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith:
          TEST_EMAIL_PREFIX,
      },
    },
  });

  const university =
    await prisma.university.findUnique({
      where: {
        slug:
          "university-of-uyo",
      },

      select: {
        id:
          true,

        name:
          true,

        shortName:
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
    "CampusMart automatic student verification test"
  );
  console.log(
    "---------------------------------------------"
  );
  console.log(
    `University: ${university.name} (${university.shortName})`
  );
  console.log("");

  try {
    /*
     * ===================================================
     * TEST CONFIGURATION
     * ===================================================
     *
     * Use the already-tested development roster as the
     * primary automated source.
     *
     * Manual review remains enabled so we can prove that
     * record_not_found is allowed to fall through.
     */

    await prisma.university.update({
      where: {
        id:
          university.id,
      },

      data: {
        studentVerificationEnabled:
          true,

        primaryVerificationSource:
          UniversityVerificationSourceType.roster_import,

        fallbackVerificationSource:
          UniversityVerificationSourceType.none,

        manualReviewEnabled:
          true,
      },
    });

    /*
     * ===================================================
     * CREATE TEMPORARY USERS
     * ===================================================
     */

    const timestamp =
      Date.now();

    const verifiedCandidate =
      await prisma.user.create({
        data: {
          name:
            "John Chukwu Okafor",

          email:
            `${TEST_EMAIL_PREFIX}verified-${timestamp}@example.com`,

          /*
           * No login occurs in this test.
           *
           * We only need a non-empty stored value to
           * satisfy the User model.
           */
          passwordHash:
            "AUTOMATED_TEST_ONLY",

          role:
            UserRole.client,

          universityId:
            university.id,

          matricNumber:
            "U2023/100001",

          studentVerificationStatus:
            StudentVerificationStatus.not_started,

          studentVerificationSource:
            StudentVerificationSource.none,

          studentVerifiedAt:
            null,
        },
      });

    const mismatchCandidate =
      await prisma.user.create({
        data: {
          name:
            "Emeka Okafor",

          email:
            `${TEST_EMAIL_PREFIX}mismatch-${timestamp}@example.com`,

          passwordHash:
            "AUTOMATED_TEST_ONLY",

          role:
            UserRole.client,

          universityId:
            university.id,

          matricNumber:
            "U2023/100002",

          studentVerificationStatus:
            StudentVerificationStatus.not_started,

          studentVerificationSource:
            StudentVerificationSource.none,

          studentVerifiedAt:
            null,
        },
      });

    const missingCandidate =
      await prisma.user.create({
        data: {
          name:
            "Test Student",

          email:
            `${TEST_EMAIL_PREFIX}missing-${timestamp}@example.com`,

          passwordHash:
            "AUTOMATED_TEST_ONLY",

          role:
            UserRole.client,

          universityId:
            university.id,

          matricNumber:
            "U2099/999999",

          studentVerificationStatus:
            StudentVerificationStatus.not_started,

          studentVerificationSource:
            StudentVerificationSource.none,

          studentVerifiedAt:
            null,
        },
      });

    /*
     * ===================================================
     * 1. SUCCESSFUL AUTOMATED VERIFICATION
     * ===================================================
     */

    await test(
      "Correct roster identity persists verified state",
      async () => {
        const result =
          await runAutomaticStudentVerification(
            verifiedCandidate.id
          );

        assert.equal(
          result.decision,
          "verified"
        );

        assert.equal(
          result.studentVerificationStatus,
          StudentVerificationStatus.verified
        );

        assert.equal(
          result.studentVerificationSource,
          StudentVerificationSource.university_roster_import
        );

        assert.ok(
          result.studentVerifiedAt
        );

        assert.equal(
          result.manualReviewAllowed,
          false
        );

        const stored =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                verifiedCandidate.id,
            },

            select: {
              studentVerificationStatus:
                true,

              studentVerificationSource:
                true,

              studentVerifiedAt:
                true,
            },
          });

        assert.equal(
          stored.studentVerificationStatus,
          StudentVerificationStatus.verified
        );

        assert.equal(
          stored.studentVerificationSource,
          StudentVerificationSource.university_roster_import
        );

        assert.ok(
          stored.studentVerifiedAt
        );
      }
    );

    /*
     * ===================================================
     * 2. ALREADY VERIFIED MUST NOT BE REWRITTEN
     * ===================================================
     */

    await test(
      "Already-verified student is not reprocessed or rewritten",
      async () => {
        const before =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                verifiedCandidate.id,
            },

            select: {
              studentVerifiedAt:
                true,

              studentVerificationSource:
                true,
            },
          });

        const result =
          await runAutomaticStudentVerification(
            verifiedCandidate.id
          );

        assert.equal(
          result.decision,
          "already_verified"
        );

        assert.equal(
          result.studentVerificationSource,
          StudentVerificationSource.university_roster_import
        );

        const after =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                verifiedCandidate.id,
            },

            select: {
              studentVerifiedAt:
                true,

              studentVerificationSource:
                true,
            },
          });

        assert.equal(
          after.studentVerificationSource,
          before.studentVerificationSource
        );

        assert.equal(
          after.studentVerifiedAt?.getTime(),
          before.studentVerifiedAt?.getTime()
        );
      }
    );

    /*
     * ===================================================
     * 3. DEFINITIVE NAME MISMATCH
     * ===================================================
     *
     * The matric number belongs to Ada Grace Nwosu in
     * the development roster.
     *
     * This temporary user claims the same matric with a
     * different name.
     */

    await test(
      "Definitive roster mismatch persists failed state",
      async () => {
        const result =
          await runAutomaticStudentVerification(
            mismatchCandidate.id
          );

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
          result.studentVerificationStatus,
          StudentVerificationStatus.failed
        );

        assert.equal(
          result.studentVerificationSource,
          StudentVerificationSource.none
        );

        assert.equal(
          result.studentVerifiedAt,
          null
        );

        const stored =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                mismatchCandidate.id,
            },

            select: {
              studentVerificationStatus:
                true,

              studentVerificationSource:
                true,

              studentVerifiedAt:
                true,
            },
          });

        assert.equal(
          stored.studentVerificationStatus,
          StudentVerificationStatus.failed
        );

        assert.equal(
          stored.studentVerificationSource,
          StudentVerificationSource.none
        );

        assert.equal(
          stored.studentVerifiedAt,
          null
        );
      }
    );

    /*
     * ===================================================
     * 4. RECORD NOT FOUND → MANUAL REVIEW AVAILABLE
     * ===================================================
     *
     * Important:
     *
     * This must NOT automatically write:
     *
     * pending
     * failed
     * verified
     *
     * because no Manual review case has actually been
     * created/submitted yet.
     */

    await test(
      "Missing roster record offers Manual review without changing user state",
      async () => {
        const before =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                missingCandidate.id,
            },

            select: {
              studentVerificationStatus:
                true,

              studentVerificationSource:
                true,

              studentVerifiedAt:
                true,
            },
          });

        const result =
          await runAutomaticStudentVerification(
            missingCandidate.id
          );

        assert.equal(
          result.decision,
          "manual_review_available"
        );

        assert.equal(
          result.failureCode,
          "record_not_found"
        );

        assert.equal(
          result.manualReviewAllowed,
          true
        );

        assert.equal(
          result.definitiveFailure,
          false
        );

        const after =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                missingCandidate.id,
            },

            select: {
              studentVerificationStatus:
                true,

              studentVerificationSource:
                true,

              studentVerifiedAt:
                true,
            },
          });

        assert.equal(
          after.studentVerificationStatus,
          before.studentVerificationStatus
        );

        assert.equal(
          after.studentVerificationSource,
          before.studentVerificationSource
        );

        assert.equal(
          after.studentVerifiedAt,
          before.studentVerifiedAt
        );
      }
    );
  } finally {
    /*
     * ===================================================
     * RESTORE UNIVERSITY CONFIGURATION
     * ===================================================
     */

    await prisma.university.update({
      where: {
        id:
          university.id,
      },

      data: {
        studentVerificationEnabled:
          originalConfig.studentVerificationEnabled,

        primaryVerificationSource:
          originalConfig.primaryVerificationSource,

        fallbackVerificationSource:
          originalConfig.fallbackVerificationSource,

        manualReviewEnabled:
          originalConfig.manualReviewEnabled,
      },
    });

    /*
     * ===================================================
     * DELETE TEMPORARY USERS
     * ===================================================
     */

    const cleanup =
      await prisma.user.deleteMany({
        where: {
          email: {
            startsWith:
              TEST_EMAIL_PREFIX,
          },
        },
      });

    console.log("");
    console.log(
      "Original University of Uyo verification configuration restored."
    );

    console.log(
      `Temporary test users removed: ${cleanup.count}`
    );
  }

  console.log("");
  console.log(
    "Automatic verification persistence test summary"
  );
  console.log(
    "-----------------------------------------------"
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
      "Automatic verification persistence tests failed."
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    "All automatic verification persistence tests passed."
  );
}

main()
  .catch(
    (
      error
    ) => {
      console.error("");

      console.error(
        "Automatic verification persistence test setup failed:"
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