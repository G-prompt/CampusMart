import assert from "node:assert/strict";

import {
  prisma,
} from "../src/lib/prisma";

import {
  verifyStudentAgainstUniversityRoster,
} from "../src/services/universityRosterVerification.service";

/*
 * =======================================================
 * CAMPUSMART ROSTER VERIFICATION TEST
 * =======================================================
 *
 * This script tests the real development roster already
 * imported for University of Uyo.
 *
 * It is READ-ONLY.
 *
 * It does NOT:
 *
 * - update User verification status
 * - create appeals
 * - activate verification sources
 * - modify roster records
 */

let passed =
  0;

let failed =
  0;

async function test(
  name:
    string,

  callback:
    () => Promise<void>
) {
  try {
    await callback();

    passed +=
      1;

    console.log(
      `PASS  ${name}`
    );
  } catch (
    error
  ) {
    failed +=
      1;

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
   * Find the managed University of Uyo row instead of
   * hard-coding a database UUID.
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

        shortName:
          true,
      },
    });

  if (
    !university
  ) {
    throw new Error(
      'University with slug "university-of-uyo" was not found.'
    );
  }

  console.log(
    ""
  );

  console.log(
    "CampusMart university roster verification test"
  );

  console.log(
    "----------------------------------------------"
  );

  console.log(
    `University: ${university.name} (${university.shortName})`
  );

  console.log(
    `University ID: ${university.id}`
  );

  console.log(
    ""
  );

  /*
   * =====================================================
   * 1. CORRECT ACTIVE STUDENT
   * =====================================================
   */

  await test(
    "Correct matric + correct name + active status verifies",
    async () => {
      const result =
        await verifyStudentAgainstUniversityRoster({
          universityId:
            university.id,

          matricNumber:
            "U2023/100001",

          fullName:
            "John Chukwu Okafor",
        });

      assert.equal(
        result.matched,
        true
      );

      assert.equal(
        result.outcome,
        "verified"
      );

      assert.equal(
        result.definitive,
        true
      );

      assert.equal(
        result.rosterAcademicSession,
        "2026/2027"
      );

      assert.ok(
        result.rosterImportId
      );

      assert.ok(
        result.rosterRecordId
      );
    }
  );

  /*
   * =====================================================
   * 2. HARMLESS NAME ORDER DIFFERENCE
   * =====================================================
   */

  await test(
    "Harmless name-order difference still verifies",
    async () => {
      const result =
        await verifyStudentAgainstUniversityRoster({
          universityId:
            university.id,

          matricNumber:
            "U2023/100001",

          fullName:
            "Okafor John Chukwu",
        });

      assert.equal(
        result.matched,
        true
      );

      assert.equal(
        result.outcome,
        "verified"
      );
    }
  );

  /*
   * =====================================================
   * 3. GENUINE MIDDLE NAME OMISSION
   * =====================================================
   */

  await test(
    "Genuine middle-name omission still verifies",
    async () => {
      const result =
        await verifyStudentAgainstUniversityRoster({
          universityId:
            university.id,

          matricNumber:
            "U2023/100001",

          fullName:
            "John Okafor",
        });

      assert.equal(
        result.matched,
        true
      );

      assert.equal(
        result.outcome,
        "verified"
      );
    }
  );

  /*
   * =====================================================
   * 4. WRONG NAME FOR AN EXISTING MATRIC NUMBER
   * =====================================================
   */

  await test(
    "Correct matric + wrong person returns definitive name mismatch",
    async () => {
      const result =
        await verifyStudentAgainstUniversityRoster({
          universityId:
            university.id,

          matricNumber:
            "U2023/100001",

          fullName:
            "Emeka Okafor",
        });

      assert.equal(
        result.matched,
        false
      );

      assert.equal(
        result.outcome,
        "name_mismatch"
      );

      assert.equal(
        result.definitive,
        true
      );

      assert.ok(
        result.rosterRecordId
      );
    }
  );

  /*
   * =====================================================
   * 5. INACTIVE / GRADUATED STUDENT
   * =====================================================
   *
   * This record exists and the name matches, but the
   * imported roster says the student is graduated.
   */

  await test(
    "Graduated student returns definitive inactive status",
    async () => {
      const result =
        await verifyStudentAgainstUniversityRoster({
          universityId:
            university.id,

          matricNumber:
            "U2020/100004",

          fullName:
            "Chiamaka Rose Eze",
        });

      assert.equal(
        result.matched,
        false
      );

      assert.equal(
        result.outcome,
        "inactive_student"
      );

      assert.equal(
        result.definitive,
        true
      );

      assert.ok(
        result.rosterRecordId
      );
    }
  );

  /*
   * =====================================================
   * 6. UNKNOWN MATRIC NUMBER
   * =====================================================
   *
   * This is deliberately inconclusive rather than a
   * definitive identity mismatch.
   *
   * Example reason:
   *
   * a newly-admitted student might not yet exist in the
   * latest imported university roster.
   */

  await test(
    "Unknown matric returns inconclusive record-not-found",
    async () => {
      const result =
        await verifyStudentAgainstUniversityRoster({
          universityId:
            university.id,

          matricNumber:
            "U2099/999999",

          fullName:
            "Test Student",
        });

      assert.equal(
        result.matched,
        false
      );

      assert.equal(
        result.outcome,
        "record_not_found"
      );

      assert.equal(
        result.definitive,
        false
      );

      assert.equal(
        result.rosterRecordId,
        null
      );
    }
  );

  /*
   * =====================================================
   * SUMMARY
   * =====================================================
   */

  console.log(
    ""
  );

  console.log(
    "Roster verification test summary"
  );

  console.log(
    "--------------------------------"
  );

  console.log(
    `Passed: ${passed}`
  );

  console.log(
    `Failed: ${failed}`
  );

  console.log(
    ""
  );

  if (
    failed >
    0
  ) {
    console.error(
      "Roster verification tests failed."
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    "All roster verification tests passed."
  );
}

main()
  .catch(
    (
      error
    ) => {
      console.error(
        ""
      );

      console.error(
        "Roster verification test setup failed:"
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