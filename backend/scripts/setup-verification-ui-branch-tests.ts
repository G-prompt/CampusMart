import bcrypt from "bcryptjs";

import {
  StudentVerificationSource,
  StudentVerificationStatus,
  UniversityVerificationSourceType,
  UserRole,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

const PASSWORD =
  "CampusMart123!";

const MANUAL_EMAIL =
  "manual.review.test@campusmart.local";

const FAILURE_EMAIL =
  "definitive.failure.test@campusmart.local";

async function main() {
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
      },
    });

  if (!university) {
    throw new Error(
      'University with slug "university-of-uyo" was not found.'
    );
  }

  /*
   * Clean up leftovers from an earlier interrupted test.
   */
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          MANUAL_EMAIL,
          FAILURE_EMAIL,
        ],
      },
    },
  });

  /*
   * Enable the development roster as the automatic
   * verification source for these UI tests.
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

  const passwordHash =
    await bcrypt.hash(
      PASSWORD,
      12
    );

  /*
   * =====================================================
   * ACCOUNT 1
   *
   * UNKNOWN MATRIC
   *
   * Expected:
   *
   * record_not_found
   *      ↓
   * inconclusive
   *      ↓
   * Manual review allowed
   * =====================================================
   */

  await prisma.user.create({
    data: {
      name:
        "Test Student",

      email:
        MANUAL_EMAIL,

      passwordHash,

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
   * =====================================================
   * ACCOUNT 2
   *
   * EXISTING MATRIC + WRONG NAME
   *
   * U2023/100002 belongs to:
   *
   * Ada Grace Nwosu
   *
   * Expected:
   *
   * name_mismatch
   *      ↓
   * definitive failure
   *      ↓
   * NO Manual review
   * =====================================================
   */

  await prisma.user.create({
    data: {
      name:
        "Wrong Student Name",

      email:
        FAILURE_EMAIL,

      passwordHash,

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

  console.log("");
  console.log(
    "CampusMart verification UI branch tests ready"
  );
  console.log(
    "--------------------------------------------"
  );

  console.log("");
  console.log(
    `University: ${university.name} (${university.shortName})`
  );

  console.log("");
  console.log(
    "TEST 1 — MANUAL REVIEW FALLBACK"
  );
  console.log(
    "-------------------------------"
  );
  console.log(
    `Email: ${MANUAL_EMAIL}`
  );
  console.log(
    `Password: ${PASSWORD}`
  );
  console.log(
    "Matric: U2099/999999"
  );

  console.log("");
  console.log(
    "Expected:"
  );
  console.log(
    "Verify student status"
  );
  console.log(
    "  -> automatic check"
  );
  console.log(
    "  -> cannot confirm automatically"
  );
  console.log(
    "  -> Manual review form becomes available"
  );

  console.log("");
  console.log(
    "TEST 2 — DEFINITIVE FAILURE"
  );
  console.log(
    "---------------------------"
  );
  console.log(
    `Email: ${FAILURE_EMAIL}`
  );
  console.log(
    `Password: ${PASSWORD}`
  );
  console.log(
    "Matric: U2023/100002"
  );
  console.log(
    "Name: Wrong Student Name"
  );

  console.log("");
  console.log(
    "Expected:"
  );
  console.log(
    "Verify student status"
  );
  console.log(
    "  -> automatic check"
  );
  console.log(
    "  -> definitive failure"
  );
  console.log(
    "  -> NO Manual review form"
  );

  console.log("");
  console.log(
    "Setup complete."
  );
}

main()
  .catch(
    (
      error
    ) => {
      console.error("");
      console.error(
        "Verification UI branch setup failed:"
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