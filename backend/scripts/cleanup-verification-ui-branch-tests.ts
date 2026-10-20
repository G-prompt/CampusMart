import {
  UniversityVerificationSourceType,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

const TEST_EMAILS = [
  "manual.review.test@campusmart.local",
  "definitive.failure.test@campusmart.local",
];

async function main() {
  console.log("");
  console.log(
    "CampusMart verification UI branch cleanup"
  );
  console.log(
    "----------------------------------------"
  );

  /*
   * Locate our temporary users first.
   */
  const testUsers =
    await prisma.user.findMany({
      where: {
        email: {
          in:
            TEST_EMAILS,
        },
      },

      select: {
        id:
          true,

        email:
          true,
      },
    });

  console.log(
    `Temporary users found: ${testUsers.length}`
  );

  /*
   * Delete the temporary accounts.
   *
   * CampusMart's related test data should follow the
   * configured database relation behaviour.
   */
  const deletedUsers =
    await prisma.user.deleteMany({
      where: {
        email: {
          in:
            TEST_EMAILS,
        },
      },
    });

  /*
   * Restore University of Uyo to the normal configuration
   * it had before our browser tests.
   */
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
      },
    });

  if (!university) {
    throw new Error(
      'University with slug "university-of-uyo" was not found.'
    );
  }

  await prisma.university.update({
    where: {
      id:
        university.id,
    },

    data: {
      studentVerificationEnabled:
        true,

      primaryVerificationSource:
        UniversityVerificationSourceType.none,

      fallbackVerificationSource:
        UniversityVerificationSourceType.none,

      manualReviewEnabled:
        true,
    },
  });

  console.log("");
  console.log(
    `Temporary users removed: ${deletedUsers.count}`
  );

  console.log(
    "University of Uyo configuration restored:"
  );

  console.log(
    "  Student verification: enabled"
  );

  console.log(
    "  Primary source: none"
  );

  console.log(
    "  Fallback source: none"
  );

  console.log(
    "  Manual review: enabled"
  );

  console.log("");
  console.log(
    "Cleanup complete."
  );
}

main()
  .catch(
    (
      error
    ) => {
      console.error("");

      console.error(
        "Verification UI cleanup failed:"
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