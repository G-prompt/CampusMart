import "dotenv/config";

import {
  UniversityVerificationMethod,
  UniversityVerificationSourceType,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

/*
 * CampusMart
 * -------------------------------------------------------
 * University verification configuration backfill
 * -------------------------------------------------------
 *
 * Purpose:
 *
 * We previously stored one mutually-exclusive field:
 *
 *   verificationMethod
 *
 * CampusMart now supports:
 *
 *   primaryVerificationSource
 *   fallbackVerificationSource
 *   manualReviewEnabled
 *
 * This script safely carries existing university settings
 * into the new architecture.
 *
 * IMPORTANT:
 *
 * We currently have NO confirmed live university API or
 * direct university database integration.
 *
 * Therefore legacy "api" and "database" values are NOT
 * automatically promoted into active automated sources.
 *
 * Manual verification, however, is already implemented
 * and tested, so legacy "manual" can safely become:
 *
 *   primaryVerificationSource  = none
 *   fallbackVerificationSource = none
 *   manualReviewEnabled        = true
 */

async function main() {
  console.log("");
  console.log(
    "CampusMart university verification backfill"
  );
  console.log(
    "-------------------------------------------"
  );
  console.log("");

  const universities =
    await prisma.university.findMany({
      orderBy: [
        {
          state:
            "asc",
        },
        {
          name:
            "asc",
        },
      ],

      select: {
        id:
          true,

        name:
          true,

        shortName:
          true,

        verificationMethod:
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
    universities.length ===
    0
  ) {
    console.log(
      "No universities were found."
    );

    return;
  }

  let updatedCount =
    0;

  let skippedCount =
    0;

  let warningCount =
    0;

  for (
    const university
    of universities
  ) {
    /*
     * Do not overwrite a university that has
     * already been configured using the new model.
     */
    const alreadyConfigured =
      university
        .primaryVerificationSource !==
        UniversityVerificationSourceType.none ||
      university
        .fallbackVerificationSource !==
        UniversityVerificationSourceType.none ||
      university
        .manualReviewEnabled;

    if (
      alreadyConfigured
    ) {
      console.log(
        `SKIP  ${university.shortName} - new verification configuration already exists.`
      );

      skippedCount +=
        1;

      continue;
    }

    /*
     * Existing manual verification is real and
     * operational, so it can safely be carried over.
     */
    if (
      university
        .verificationMethod ===
      UniversityVerificationMethod.manual
    ) {
      await prisma.university.update({
        where: {
          id:
            university.id,
        },

        data: {
          primaryVerificationSource:
            UniversityVerificationSourceType.none,

          fallbackVerificationSource:
            UniversityVerificationSourceType.none,

          manualReviewEnabled:
            true,
        },
      });

      console.log(
        `OK    ${university.shortName} - manual review enabled.`
      );

      updatedCount +=
        1;

      continue;
    }

    /*
     * We deliberately do NOT activate legacy API
     * configuration automatically.
     *
     * CampusMart has no confirmed live university
     * API integration yet.
     */
    if (
      university
        .verificationMethod ===
      UniversityVerificationMethod.api
    ) {
      console.log(
        `WARN  ${university.shortName} - legacy API setting found, but no confirmed live API integration exists. Left automated sources disabled.`
      );

      warningCount +=
        1;

      continue;
    }

    /*
     * Same rule for direct database verification.
     *
     * A database label in old configuration must
     * not be treated as proof that CampusMart has a
     * working authorized database connection.
     */
    if (
      university
        .verificationMethod ===
      UniversityVerificationMethod.database
    ) {
      console.log(
        `WARN  ${university.shortName} - legacy database setting found, but no confirmed live database integration exists. Left automated sources disabled.`
      );

      warningCount +=
        1;

      continue;
    }

    /*
     * verificationMethod = none
     *
     * The new defaults are already correct.
     */
    console.log(
      `SKIP  ${university.shortName} - no existing verification method to migrate.`
    );

    skippedCount +=
      1;
  }

  console.log("");
  console.log(
    "Backfill complete."
  );

  console.log(
    `Updated:  ${updatedCount}`
  );

  console.log(
    `Skipped:  ${skippedCount}`
  );

  console.log(
    `Warnings: ${warningCount}`
  );

  console.log("");

  if (
    warningCount > 0
  ) {
    console.log(
      "Any API/database warnings require a real integration review before those sources may be enabled."
    );

    console.log("");
  }
}

main()
  .catch(
    (error) => {
      console.error("");
      console.error(
        "University verification backfill failed:"
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