import {
  UniversityVerificationSourceType,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

const TEST_EMAIL =
  "john.roster.test@campusmart.local";

async function main() {
  console.log("");
  console.log(
    "CampusMart customer verification UI test cleanup"
  );
  console.log(
    "-----------------------------------------------"
  );

  /*
   * Remove the temporary customer.
   */
  const deletedUsers =
    await prisma.user.deleteMany({
      where: {
        email:
          TEST_EMAIL,
      },
    });

  /*
   * Restore University of Uyo to the configuration it had
   * before our temporary browser test:
   *
   * Student verification: enabled
   * Primary source: none
   * Fallback source: none
   * Manual review: enabled
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
    "University of Uyo verification configuration restored."
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
        "Cleanup failed:"
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