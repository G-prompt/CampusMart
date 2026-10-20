import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import {
  stdin as input,
  stdout as output,
} from "node:process";

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
 * CAMPUSMART CUSTOMER VERIFICATION UI TEST SETUP
 * =======================================================
 *
 * This script:
 *
 * 1. Finds University of Uyo.
 * 2. Saves its current verification configuration.
 * 3. Temporarily enables roster_import as primary source.
 * 4. Creates one real login-capable temporary customer.
 * 5. Waits while you test the frontend in the browser.
 * 6. Deletes the temporary customer.
 * 7. Restores the university's ORIGINAL configuration.
 *
 * Keep this terminal open while testing.
 */

const TEST_EMAIL =
  "john.roster.test@campusmart.local";

const TEST_PASSWORD =
  "CampusMart123!";

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
    "CampusMart customer verification UI test"
  );
  console.log(
    "----------------------------------------"
  );

  console.log("");
  console.log(
    "Original university verification configuration:"
  );

  console.log(
    `studentVerificationEnabled: ${originalConfig.studentVerificationEnabled}`
  );

  console.log(
    `primaryVerificationSource: ${originalConfig.primaryVerificationSource}`
  );

  console.log(
    `fallbackVerificationSource: ${originalConfig.fallbackVerificationSource}`
  );

  console.log(
    `manualReviewEnabled: ${originalConfig.manualReviewEnabled}`
  );

  /*
   * Remove a leftover account if a previous UI test was
   * interrupted after user creation.
   */
  await prisma.user.deleteMany({
    where: {
      email:
        TEST_EMAIL,
    },
  });

  try {
    /*
     * ===================================================
     * TEMPORARILY ENABLE ROSTER VERIFICATION
     * ===================================================
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
     * PASSWORD
     * ===================================================
     *
     * Matches normal CampusMart signup:
     *
     * bcrypt.hash(password, 12)
     */

    const passwordHash =
      await bcrypt.hash(
        TEST_PASSWORD,
        12
      );

    /*
     * ===================================================
     * TEMPORARY LOGIN ACCOUNT
     * ===================================================
     *
     * This identity matches the first active development
     * roster record:
     *
     * U2023/100001
     * John Chukwu Okafor
     */

    const testUser =
      await prisma.user.create({
        data: {
          name:
            "John Chukwu Okafor",

          email:
            TEST_EMAIL,

          passwordHash,

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

        select: {
          id:
            true,

          name:
            true,

          email:
            true,

          matricNumber:
            true,

          studentVerificationStatus:
            true,
        },
      });

    console.log("");
    console.log(
      "Temporary customer created."
    );

    console.log("");
    console.log(
      `University: ${university.name} (${university.shortName})`
    );

    console.log(
      `User ID: ${testUser.id}`
    );

    console.log(
      `Name: ${testUser.name}`
    );

    console.log(
      `Matric number: ${testUser.matricNumber}`
    );

    console.log("");
    console.log(
      "LOGIN CREDENTIALS"
    );

    console.log(
      "-----------------"
    );

    console.log(
      `Email: ${TEST_EMAIL}`
    );

    console.log(
      `Password: ${TEST_PASSWORD}`
    );

    console.log("");
    console.log(
      "Temporary university configuration:"
    );

    console.log(
      "studentVerificationEnabled: true"
    );

    console.log(
      "primaryVerificationSource: roster_import"
    );

    console.log(
      "fallbackVerificationSource: none"
    );

    console.log(
      "manualReviewEnabled: true"
    );

    console.log("");
    console.log(
      "DO NOT CLOSE THIS TERMINAL YET."
    );

    console.log("");
    console.log(
      "Open CampusMart in the browser, sign in with the account above, open the Account/Profile page and test student verification."
    );

    console.log("");
    console.log(
      "Expected flow:"
    );

    console.log(
      "Not started"
    );

    console.log(
      "  -> Verify student status"
    );

    console.log(
      "  -> Checking university records..."
    );

    console.log(
      "  -> Verified"
    );

    console.log(
      "  -> Source stored as university_roster_import"
    );

    const rl =
      readline.createInterface({
        input,
        output,
      });

    await rl.question(
      "\nWhen you have FINISHED the browser test, press Enter here to clean up..."
    );

    rl.close();
  } finally {
    /*
     * ===================================================
     * CLEANUP
     * ===================================================
     */

    const deletedUsers =
      await prisma.user.deleteMany({
        where: {
          email:
            TEST_EMAIL,
        },
      });

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

    console.log("");
    console.log(
      "UI test cleanup complete."
    );

    console.log(
      `Temporary users removed: ${deletedUsers.count}`
    );

    console.log(
      "Original University of Uyo verification configuration restored."
    );
  }
}

main()
  .catch(
    (
      error
    ) => {
      console.error("");
      console.error(
        "Customer verification UI test setup failed:"
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