import assert from "node:assert/strict";

import jwt from "jsonwebtoken";

import {
  StudentVerificationSource,
  StudentVerificationStatus,
  UniversityVerificationSourceType,
  UserRole,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

/*
 * =======================================================
 * CAMPUSMART AUTOMATIC VERIFICATION HTTP TEST
 * =======================================================
 *
 * This test exercises the REAL route:
 *
 * POST /api/verification/automatic
 *
 * Through:
 *
 * JWT
 *   ↓
 * requireAuth
 *   ↓
 * automaticVerification.controller
 *   ↓
 * studentAutomaticVerification.service
 *   ↓
 * universityVerificationOrchestrator.service
 *   ↓
 * roster provider
 *   ↓
 * Prisma
 *
 * Temporary users are deleted afterwards.
 */

const API_URL =
  process.env.TEST_API_URL ||
  "http://localhost:5000";

const TEST_EMAIL_PREFIX =
  "campusmart-http-verification-test-";

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

function createToken(
  userId: string
) {
  const jwtSecret =
    process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error(
      "JWT_SECRET is not available. Run this script from the backend environment where your .env is loaded."
    );
  }

  return jwt.sign(
    {
      userId,

      role:
        UserRole.client,
    },
    jwtSecret,
    {
      expiresIn:
        "15m",
    }
  );
}

async function callAutomaticVerification(
  token: string
) {
  const response =
    await fetch(
      `${API_URL}/api/verification/automatic`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },
      }
    );

  const body =
    await response
      .json()
      .catch(
        () =>
          null
      );

  return {
    status:
      response.status,

    body,
  };
}

async function main() {
  /*
   * Remove leftovers from an interrupted previous run.
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
    "CampusMart automatic verification HTTP test"
  );
  console.log(
    "------------------------------------------"
  );
  console.log(
    `API: ${API_URL}`
  );
  console.log(
    `University: ${university.name} (${university.shortName})`
  );
  console.log("");

  try {
    /*
     * Use the development roster as the live test source.
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

    const timestamp =
      Date.now();

    /*
     * ===================================================
     * TEMP USER 1 — SHOULD VERIFY
     * ===================================================
     */

    const verifiedCandidate =
      await prisma.user.create({
        data: {
          name:
            "John Chukwu Okafor",

          email:
            `${TEST_EMAIL_PREFIX}verified-${timestamp}@example.com`,

          passwordHash:
            "HTTP_TEST_ONLY",

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

    /*
     * ===================================================
     * TEMP USER 2 — DEFINITIVE FAILURE
     * ===================================================
     */

    const mismatchCandidate =
      await prisma.user.create({
        data: {
          name:
            "Wrong Student Name",

          email:
            `${TEST_EMAIL_PREFIX}mismatch-${timestamp}@example.com`,

          passwordHash:
            "HTTP_TEST_ONLY",

          role:
            UserRole.client,

          universityId:
            university.id,

          /*
           * This belongs to Ada Grace Nwosu in our
           * development roster.
           */
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

    /*
     * ===================================================
     * TEMP USER 3 — MANUAL REVIEW AVAILABLE
     * ===================================================
     */

    const missingCandidate =
      await prisma.user.create({
        data: {
          name:
            "Test Student",

          email:
            `${TEST_EMAIL_PREFIX}missing-${timestamp}@example.com`,

          passwordHash:
            "HTTP_TEST_ONLY",

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
     * 1. AUTHENTICATED SUCCESS
     * ===================================================
     */

    await test(
      "Authenticated automatic endpoint verifies correct roster student",
      async () => {
        const token =
          createToken(
            verifiedCandidate.id
          );

        const response =
          await callAutomaticVerification(
            token
          );

        assert.equal(
          response.status,
          200
        );

        assert.equal(
          response.body?.success,
          true
        );

        assert.equal(
          response.body
            ?.verification
            ?.decision,
          "verified"
        );

        assert.equal(
          response.body
            ?.verification
            ?.studentVerificationStatus,
          StudentVerificationStatus.verified
        );

        assert.equal(
          response.body
            ?.verification
            ?.studentVerificationSource,
          StudentVerificationSource.university_roster_import
        );

        assert.equal(
          response.body
            ?.verification
            ?.manualReviewAllowed,
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
     * 2. DEFINITIVE FAILURE
     * ===================================================
     */

    await test(
      "Authenticated endpoint returns definitive failure without Manual review",
      async () => {
        const token =
          createToken(
            mismatchCandidate.id
          );

        const response =
          await callAutomaticVerification(
            token
          );

        assert.equal(
          response.status,
          200
        );

        assert.equal(
          response.body?.success,
          true
        );

        assert.equal(
          response.body
            ?.verification
            ?.decision,
          "failed"
        );

        assert.equal(
          response.body
            ?.verification
            ?.failureCode,
          "name_mismatch"
        );

        assert.equal(
          response.body
            ?.verification
            ?.definitiveFailure,
          true
        );

        assert.equal(
          response.body
            ?.verification
            ?.manualReviewAllowed,
          false
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
     * 3. INCONCLUSIVE → MANUAL REVIEW OFFERED
     * ===================================================
     */

    await test(
      "Authenticated endpoint offers Manual review for inconclusive roster result",
      async () => {
        const token =
          createToken(
            missingCandidate.id
          );

        const response =
          await callAutomaticVerification(
            token
          );

        assert.equal(
          response.status,
          200
        );

        assert.equal(
          response.body?.success,
          true
        );

        assert.equal(
          response.body
            ?.verification
            ?.decision,
          "manual_review_available"
        );

        assert.equal(
          response.body
            ?.verification
            ?.failureCode,
          "record_not_found"
        );

        assert.equal(
          response.body
            ?.verification
            ?.manualReviewAllowed,
          true
        );

        assert.equal(
          response.body
            ?.verification
            ?.definitiveFailure,
          false
        );

        /*
         * The HTTP endpoint must not create a pending
         * verification state simply because Manual review
         * is available.
         */
        const stored =
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
          stored.studentVerificationStatus,
          StudentVerificationStatus.not_started
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
     * 4. NO AUTHENTICATION
     * ===================================================
     */

    await test(
      "Automatic endpoint rejects unauthenticated requests",
      async () => {
        const response =
          await fetch(
            `${API_URL}/api/verification/automatic`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },
            }
          );

        const body =
          await response
            .json()
            .catch(
              () =>
                null
            );

        assert.equal(
          response.status,
          401
        );

        assert.equal(
          body?.success,
          false
        );
      }
    );

    /*
     * ===================================================
     * 5. VERIFIED USER RE-RUN
     * ===================================================
     */

    await test(
      "Already-verified account remains verified on repeat endpoint call",
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

        const token =
          createToken(
            verifiedCandidate.id
          );

        const response =
          await callAutomaticVerification(
            token
          );

        assert.equal(
          response.status,
          200
        );

        assert.equal(
          response.body
            ?.verification
            ?.decision,
          "already_verified"
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
  } finally {
    /*
     * ===================================================
     * RESTORE UNIVERSITY CONFIG
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
     * DELETE TEMP USERS
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
      `Temporary HTTP test users removed: ${cleanup.count}`
    );
  }

  console.log("");
  console.log(
    "Automatic verification HTTP test summary"
  );
  console.log(
    "----------------------------------------"
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
      "Automatic verification HTTP tests failed."
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    "All automatic verification HTTP tests passed."
  );
}

main()
  .catch(
    (
      error
    ) => {
      console.error("");

      console.error(
        "Automatic verification HTTP test setup failed:"
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