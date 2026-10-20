import assert from "node:assert/strict";

import {
  getNormalizedStudentNameTokens,
  interpretRosterStudentStatus,
  normalizeInstitutionalEmail,
  normalizeRosterHeader,
  normalizeStudentFullName,
  parseUniversityRosterCsv,
  studentNamesMatch,
} from "../src/lib/universityRoster";

import {
  normalizeMatricNumber,
} from "../src/lib/studentVerification";

/*
 * =======================================================
 * CAMPUSMART UNIVERSITY ROSTER TEST SCRIPT
 * =======================================================
 *
 * This script does NOT:
 *
 * - connect to Prisma
 * - write to Supabase
 * - create roster records
 * - activate verification
 *
 * It only tests the parser and normalization layer.
 */

let passed = 0;

let failed = 0;

function test(
  name: string,
  callback: () => void
) {
  try {
    callback();

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

/*
 * =======================================================
 * HEADER NORMALIZATION
 * =======================================================
 */

test(
  "Normalizes harmless roster header formatting",
  () => {
    assert.equal(
      normalizeRosterHeader(
        "Matric Number"
      ),
      "matric_number"
    );

    assert.equal(
      normalizeRosterHeader(
        " student-status "
      ),
      "student_status"
    );

    assert.equal(
      normalizeRosterHeader(
        "\uFEFFFull Name"
      ),
      "full_name"
    );

    assert.equal(
      normalizeRosterHeader(
        "institutional_email"
      ),
      "institutional_email"
    );
  }
);

/*
 * =======================================================
 * MATRIC NORMALIZATION
 * =======================================================
 */

test(
  "Uses CampusMart matric normalization rules",
  () => {
    assert.equal(
      normalizeMatricNumber(
        " de. 2022 / 7408 "
      ),
      "DE.2022/7408"
    );

    assert.equal(
      normalizeMatricNumber(
        "u2023 / 123456"
      ),
      "U2023/123456"
    );

    /*
     * CampusMart must not invent punctuation.
     */
    assert.equal(
      normalizeMatricNumber(
        "DE2022-7408"
      ),
      "DE2022-7408"
    );
  }
);

/*
 * =======================================================
 * NAME NORMALIZATION
 * =======================================================
 */

test(
  "Normalizes harmless student name differences",
  () => {
    assert.deepEqual(
      getNormalizedStudentNameTokens(
        "OKAFOR, John Chukwu"
      ),
      [
        "okafor",
        "john",
        "chukwu",
      ]
    );

    assert.equal(
      normalizeStudentFullName(
        "OKAFOR, John Chukwu"
      ),
      "chukwu john okafor"
    );

    assert.equal(
      normalizeStudentFullName(
        "John Chukwu Okafor"
      ),
      "chukwu john okafor"
    );
  }
);

test(
  "Treats token order as harmless",
  () => {
    assert.equal(
      studentNamesMatch(
        "John Chukwu Okafor",
        "Okafor John Chukwu"
      ),
      true
    );
  }
);

test(
  "Allows omission of a genuine middle-name token",
  () => {
    assert.equal(
      studentNamesMatch(
        "John Chukwu Okafor",
        "John Okafor"
      ),
      true
    );
  }
);

test(
  "Does not silently accept misspellings",
  () => {
    assert.equal(
      studentNamesMatch(
        "John Chukwu Okafor",
        "John Okafor Chukwo"
      ),
      false
    );
  }
);

test(
  "Does not accept a completely different person with the same surname",
  () => {
    assert.equal(
      studentNamesMatch(
        "John Chukwu Okafor",
        "Emeka Okafor"
      ),
      false
    );
  }
);

/*
 * =======================================================
 * STATUS INTERPRETATION
 * =======================================================
 */

test(
  "Recognizes active student statuses",
  () => {
    assert.deepEqual(
      interpretRosterStudentStatus(
        "Active"
      ),
      {
        valid: true,

        normalizedStatus:
          "active",

        isActiveStudent:
          true,
      }
    );

    assert.deepEqual(
      interpretRosterStudentStatus(
        "Registered"
      ),
      {
        valid: true,

        normalizedStatus:
          "registered",

        isActiveStudent:
          true,
      }
    );
  }
);

test(
  "Recognizes inactive student statuses",
  () => {
    assert.deepEqual(
      interpretRosterStudentStatus(
        "Graduated"
      ),
      {
        valid: true,

        normalizedStatus:
          "graduated",

        isActiveStudent:
          false,
      }
    );

    assert.deepEqual(
      interpretRosterStudentStatus(
        "Withdrawn"
      ),
      {
        valid: true,

        normalizedStatus:
          "withdrawn",

        isActiveStudent:
          false,
      }
    );
  }
);

test(
  "Does not guess unknown university student statuses",
  () => {
    assert.deepEqual(
      interpretRosterStudentStatus(
        "Cleared"
      ),
      {
        valid: false,

        normalizedStatus:
          "cleared",
      }
    );
  }
);

/*
 * =======================================================
 * EMAIL NORMALIZATION
 * =======================================================
 */

test(
  "Normalizes institutional email addresses",
  () => {
    assert.equal(
      normalizeInstitutionalEmail(
        " John.Okafor@UNI.edu.ng "
      ),
      "john.okafor@uni.edu.ng"
    );
  }
);

/*
 * =======================================================
 * VALID CSV
 * =======================================================
 */

test(
  "Parses a valid minimal university roster",
  () => {
    const csv = [
      "matric_number,full_name,student_status,institutional_email",
      "U2023/123456,John Chukwu Okafor,active,john.okafor@uni.edu.ng",
      "U2023/123457,Ada Grace Nwosu,registered,ada.nwosu@uni.edu.ng",
      "U2020/100001,Michael Uche Obi,graduated,michael.obi@uni.edu.ng",
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      true
    );

    assert.equal(
      result.totalDataRows,
      3
    );

    assert.equal(
      result.acceptedRecordCount,
      3
    );

    assert.equal(
      result.rejectedRowCount,
      0
    );

    assert.equal(
      result.activeRecordCount,
      2
    );

    assert.equal(
      result.inactiveRecordCount,
      1
    );

    assert.equal(
      result.records[0]
        .normalizedMatricNumber,
      "U2023/123456"
    );

    assert.equal(
      result.records[0]
        .normalizedFullName,
      "chukwu john okafor"
    );

    assert.equal(
      result.records[0]
        .isActiveStudent,
      true
    );

    assert.equal(
      result.records[2]
        .isActiveStudent,
      false
    );
  }
);

/*
 * =======================================================
 * OPTIONAL EMAIL
 * =======================================================
 */

test(
  "Accepts a roster without institutional email",
  () => {
    const csv = [
      "matric_number,full_name,student_status",
      "U2023/123456,John Chukwu Okafor,active",
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      true
    );

    assert.equal(
      result.records.length,
      1
    );

    assert.equal(
      result.records[0]
        .institutionalEmail,
      null
    );
  }
);

/*
 * =======================================================
 * HEADER PRESENTATION DIFFERENCES
 * =======================================================
 */

test(
  "Accepts harmless header presentation differences",
  () => {
    const csv = [
      "Matric Number,Full Name,Student Status,Institutional Email",
      "U2023/123456,John Chukwu Okafor,active,john.okafor@uni.edu.ng",
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      true
    );

    assert.deepEqual(
      result.headers,
      [
        "matric_number",
        "full_name",
        "student_status",
        "institutional_email",
      ]
    );
  }
);

/*
 * =======================================================
 * QUOTED CSV
 * =======================================================
 */

test(
  "Supports quoted fields containing commas",
  () => {
    const csv = [
      "matric_number,full_name,student_status,institutional_email",
      'U2023/123456,"Okafor, John Chukwu",active,john.okafor@uni.edu.ng',
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      true
    );

    assert.equal(
      result.records[0]
        .fullName,
      "Okafor, John Chukwu"
    );

    assert.equal(
      result.records[0]
        .normalizedFullName,
      "chukwu john okafor"
    );
  }
);

test(
  "Supports escaped quotes inside quoted fields",
  () => {
    const csv = [
      "matric_number,full_name,student_status",
      'U2023/123456,"John ""Jay"" Okafor",active',
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      true
    );

    assert.equal(
      result.records[0]
        .fullName,
      'John "Jay" Okafor'
    );
  }
);

/*
 * =======================================================
 * DATA MINIMISATION
 * =======================================================
 */

test(
  "Rejects unrelated student-data columns",
  () => {
    const csv = [
      "matric_number,full_name,student_status,grades",
      "U2023/123456,John Chukwu Okafor,active,A",
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      false
    );

    assert.equal(
      result.fileErrors.some(
        (
          error
        ) =>
          error.code ===
            "UNSUPPORTED_HEADER"
      ),
      true
    );
  }
);

test(
  "Rejects missing required columns",
  () => {
    const csv = [
      "matric_number,full_name",
      "U2023/123456,John Chukwu Okafor",
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      false
    );

    assert.equal(
      result.fileErrors.some(
        (
          error
        ) =>
          error.code ===
            "MISSING_REQUIRED_HEADER"
      ),
      true
    );
  }
);

/*
 * =======================================================
 * DUPLICATE STUDENT RECORDS
 * =======================================================
 */

test(
  "Detects duplicate matric numbers after normalization",
  () => {
    const csv = [
      "matric_number,full_name,student_status",
      "DE.2022/7408,John Chukwu Okafor,active",
      " de.2022 / 7408 ,John Chukwu Okafor,active",
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      false
    );

    assert.equal(
      result.acceptedRecordCount,
      1
    );

    assert.equal(
      result.rejectedRowCount,
      1
    );

    assert.equal(
      result.rejectedRows[0]
        .code,
      "DUPLICATE_MATRIC_NUMBER"
    );
  }
);

/*
 * =======================================================
 * UNKNOWN STUDENT STATUS
 * =======================================================
 */

test(
  "Rejects a student status CampusMart cannot safely interpret",
  () => {
    const csv = [
      "matric_number,full_name,student_status",
      "U2023/123456,John Chukwu Okafor,Cleared",
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      false
    );

    assert.equal(
      result.rejectedRows[0]
        .code,
      "UNSUPPORTED_STUDENT_STATUS"
    );
  }
);

/*
 * =======================================================
 * INVALID EMAIL
 * =======================================================
 */

test(
  "Rejects malformed institutional email values",
  () => {
    const csv = [
      "matric_number,full_name,student_status,institutional_email",
      "U2023/123456,John Chukwu Okafor,active,not-an-email",
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      false
    );

    assert.equal(
      result.rejectedRows[0]
        .code,
      "INVALID_INSTITUTIONAL_EMAIL"
    );
  }
);

/*
 * =======================================================
 * INVALID NAME
 * =======================================================
 */

test(
  "Rejects a roster record with only one usable name token",
  () => {
    const csv = [
      "matric_number,full_name,student_status",
      "U2023/123456,John,active",
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      false
    );

    assert.equal(
      result.rejectedRows[0]
        .code,
      "INVALID_NAME"
    );
  }
);

/*
 * =======================================================
 * COLUMN COUNT
 * =======================================================
 */

test(
  "Rejects malformed rows with the wrong number of columns",
  () => {
    const csv = [
      "matric_number,full_name,student_status",
      "U2023/123456,John Chukwu Okafor",
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      false
    );

    assert.equal(
      result.rejectedRows[0]
        .code,
      "COLUMN_COUNT_MISMATCH"
    );
  }
);

/*
 * =======================================================
 * CSV STRUCTURE FAILURE
 * =======================================================
 */

test(
  "Rejects an unclosed quoted CSV field",
  () => {
    const csv = [
      "matric_number,full_name,student_status",
      'U2023/123456,"John Chukwu Okafor,active',
    ].join(
      "\n"
    );

    const result =
      parseUniversityRosterCsv(
        csv
      );

    assert.equal(
      result.valid,
      false
    );

    assert.equal(
      result.fileErrors[0]
        .code,
      "UNCLOSED_QUOTED_FIELD"
    );
  }
);

/*
 * =======================================================
 * EMPTY FILE
 * =======================================================
 */

test(
  "Rejects an empty roster",
  () => {
    const result =
      parseUniversityRosterCsv(
        ""
      );

    assert.equal(
      result.valid,
      false
    );

    assert.equal(
      result.fileErrors[0]
        .code,
      "EMPTY_FILE"
    );
  }
);

/*
 * =======================================================
 * SUMMARY
 * =======================================================
 */

console.log(
  ""
);

console.log(
  "CampusMart roster parser test summary"
);

console.log(
  "------------------------------------"
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
    "Roster parser tests failed."
  );

  process.exitCode =
    1;
} else {
  console.log(
    "All roster parser tests passed."
  );
}