import {
  normalizeMatricNumber,
} from "./studentVerification";

/*
 * =======================================================
 * CAMPUSMART UNIVERSITY ROSTER PARSER
 * =======================================================
 *
 * This file is deliberately independent of Express,
 * Prisma and file-upload middleware.
 *
 * Its responsibilities are only:
 *
 * 1. Parse CSV safely.
 * 2. Validate the expected minimal columns.
 * 3. Normalize matric numbers.
 * 4. Normalize student names.
 * 5. Interpret supported student-status values.
 * 6. Validate optional institutional email addresses.
 * 7. Detect duplicate matric numbers inside one roster.
 *
 * Database writes and Admin permissions belong elsewhere.
 */

/*
 * CampusMart deliberately accepts a small roster shape.
 *
 * Required:
 *
 * matric_number
 * full_name
 * student_status
 *
 * Optional:
 *
 * institutional_email
 *
 * Other columns are rejected instead of silently imported.
 * This helps enforce data minimisation.
 */
export const REQUIRED_ROSTER_HEADERS = [
  "matric_number",
  "full_name",
  "student_status",
] as const;

export const OPTIONAL_ROSTER_HEADERS = [
  "institutional_email",
] as const;

const ALLOWED_ROSTER_HEADERS =
  new Set<string>([
    ...REQUIRED_ROSTER_HEADERS,
    ...OPTIONAL_ROSTER_HEADERS,
  ]);

/*
 * Defensive limit for one import.
 *
 * This is not a university-policy rule.
 * It is only an application safety limit so a malformed
 * CSV cannot create an unbounded in-memory parse.
 */
export const MAX_ROSTER_DATA_ROWS =
  50_000;

export type UniversityRosterPreparedRecord = {
  sourceRowNumber: number;

  matricNumber: string;

  normalizedMatricNumber: string;

  fullName: string;

  normalizedFullName: string;

  studentStatus: string;

  isActiveStudent: boolean;

  institutionalEmail:
    | string
    | null;
};

export type UniversityRosterRejectedRow = {
  sourceRowNumber: number;

  code:
    | "COLUMN_COUNT_MISMATCH"
    | "MATRIC_NUMBER_REQUIRED"
    | "FULL_NAME_REQUIRED"
    | "INVALID_NAME"
    | "STUDENT_STATUS_REQUIRED"
    | "UNSUPPORTED_STUDENT_STATUS"
    | "INVALID_INSTITUTIONAL_EMAIL"
    | "DUPLICATE_MATRIC_NUMBER";

  message: string;

  matricNumber?:
    | string
    | null;
};

export type UniversityRosterFileError = {
  code:
    | "EMPTY_FILE"
    | "HEADER_REQUIRED"
    | "DUPLICATE_HEADER"
    | "MISSING_REQUIRED_HEADER"
    | "UNSUPPORTED_HEADER"
    | "UNCLOSED_QUOTED_FIELD"
    | "TOO_MANY_ROWS";

  message: string;
};

export type UniversityRosterParseResult = {
  valid: boolean;

  headers: string[];

  totalDataRows: number;

  acceptedRecordCount: number;

  rejectedRowCount: number;

  activeRecordCount: number;

  inactiveRecordCount: number;

  records:
    UniversityRosterPreparedRecord[];

  rejectedRows:
    UniversityRosterRejectedRow[];

  fileErrors:
    UniversityRosterFileError[];
};

type ParsedCsv = {
  rows: string[][];

  error?:
    UniversityRosterFileError;
};

/*
 * =======================================================
 * HEADER NORMALIZATION
 * =======================================================
 *
 * We accept harmless presentation differences such as:
 *
 * Matric Number
 * matric number
 * matric-number
 * matric_number
 *
 * All become:
 *
 * matric_number
 *
 * We do NOT attempt to guess unrelated header names.
 */
export function normalizeRosterHeader(
  value: string
): string {
  return value
    .replace(
      /^\uFEFF/,
      ""
    )
    .normalize(
      "NFKC"
    )
    .trim()
    .toLowerCase()
    .replace(
      /[\s-]+/g,
      "_"
    )
    .replace(
      /_+/g,
      "_"
    );
}

/*
 * =======================================================
 * STUDENT NAME NORMALIZATION
 * =======================================================
 *
 * CampusMart's name-matching principle is intentionally
 * conservative:
 *
 * - ignore case differences
 * - ignore harmless spacing
 * - ignore harmless punctuation
 * - allow different token order
 * - do not use fuzzy spelling correction
 *
 * Examples:
 *
 * "John Chukwu Okafor"
 *
 * and
 *
 * "OKAFOR, John Chukwu"
 *
 * normalize to the same sorted token representation.
 */
export function getNormalizedStudentNameTokens(
  value: string
): string[] {
  const cleaned =
    value
      .normalize(
        "NFKC"
      )
      .trim()
      .toLowerCase()

      /*
       * Apostrophes are removed inside a name token.
       *
       * Example:
       *
       * O'Connor
       * O’Connor
       *
       * both become:
       *
       * oconnor
       */
      .replace(
        /['’`]/g,
        ""
      )

      /*
       * Hyphens and similar separators become spaces.
       */
      .replace(
        /[-‐-‒–—/]+/g,
        " "
      )

      /*
       * Remove remaining punctuation/symbols while
       * preserving Unicode letters and numbers.
       */
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        " "
      )

      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (!cleaned) {
    return [];
  }

  return cleaned
    .split(
      " "
    )
    .filter(
      Boolean
    );
}

/*
 * Stored normalized representation.
 *
 * Sorting means harmless name-order differences do not
 * change the canonical representation.
 */
export function normalizeStudentFullName(
  value: string
): string {
  return getNormalizedStudentNameTokens(
    value
  )
    .sort(
      (
        first,
        second
      ) =>
        first.localeCompare(
          second
        )
    )
    .join(
      " "
    );
}

/*
 * =======================================================
 * NAME MATCHING
 * =======================================================
 *
 * This will later be used by the automated roster
 * verifier.
 *
 * IMPORTANT:
 *
 * This is NOT fuzzy matching.
 *
 * CampusMart must not silently accept misspellings.
 *
 * Because the matric number is expected to identify the
 * authoritative roster row first, this name comparison
 * answers:
 *
 * "Does the submitted name correspond to the name on
 * that exact student record?"
 *
 * A submitted name may omit genuine middle-name tokens,
 * but must contain at least two name tokens.
 */
export function studentNamesMatch(
  authoritativeName:
    string,

  submittedName:
    string
): boolean {
  const authoritativeTokens =
    getNormalizedStudentNameTokens(
      authoritativeName
    );

  const submittedTokens =
    getNormalizedStudentNameTokens(
      submittedName
    );

  if (
    authoritativeTokens.length <
      2 ||
    submittedTokens.length <
      2
  ) {
    return false;
  }

  const authoritativeCounts =
    createTokenCounts(
      authoritativeTokens
    );

  const submittedCounts =
    createTokenCounts(
      submittedTokens
    );

  /*
   * Exact token match.
   */
  if (
    haveEqualTokenCounts(
      authoritativeCounts,
      submittedCounts
    )
  ) {
    return true;
  }

  /*
   * Student submission may omit genuine middle-name
   * tokens.
   *
   * It may NOT introduce a token that does not exist in
   * the authoritative university record.
   */
  if (
    submittedTokens.length >
    authoritativeTokens.length
  ) {
    return false;
  }

  for (
    const [
      token,
      submittedCount,
    ] of submittedCounts
  ) {
    const authoritativeCount =
      authoritativeCounts.get(
        token
      ) || 0;

    if (
      authoritativeCount <
      submittedCount
    ) {
      return false;
    }
  }

  return true;
}

function createTokenCounts(
  tokens:
    string[]
): Map<string, number> {
  const counts =
    new Map<
      string,
      number
    >();

  for (
    const token
    of tokens
  ) {
    counts.set(
      token,
      (
        counts.get(
          token
        ) || 0
      ) + 1
    );
  }

  return counts;
}

function haveEqualTokenCounts(
  first:
    Map<
      string,
      number
    >,

  second:
    Map<
      string,
      number
    >
): boolean {
  if (
    first.size !==
    second.size
  ) {
    return false;
  }

  for (
    const [
      token,
      count,
    ] of first
  ) {
    if (
      second.get(
        token
      ) !==
      count
    ) {
      return false;
    }
  }

  return true;
}

/*
 * =======================================================
 * STUDENT STATUS
 * =======================================================
 *
 * We normalize only a deliberately small set of common,
 * unambiguous values.
 *
 * Unknown values are rejected instead of guessed.
 *
 * University-specific status mappings can be added later
 * when real institutional integrations require them.
 */
export function interpretRosterStudentStatus(
  value: string
):
  | {
      valid: true;

      normalizedStatus:
        string;

      isActiveStudent:
        boolean;
    }
  | {
      valid: false;

      normalizedStatus:
        string;
    } {
  const normalizedStatus =
    value
      .normalize(
        "NFKC"
      )
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  const activeStatuses =
    new Set([
      "active",
      "current",
      "registered",
      "enrolled",
    ]);

  const inactiveStatuses =
    new Set([
      "inactive",
      "graduated",
      "withdrawn",
    ]);

  if (
    activeStatuses.has(
      normalizedStatus
    )
  ) {
    return {
      valid:
        true,

      normalizedStatus,

      isActiveStudent:
        true,
    };
  }

  if (
    inactiveStatuses.has(
      normalizedStatus
    )
  ) {
    return {
      valid:
        true,

      normalizedStatus,

      isActiveStudent:
        false,
    };
  }

  return {
    valid:
      false,

    normalizedStatus,
  };
}

/*
 * =======================================================
 * INSTITUTIONAL EMAIL
 * =======================================================
 */
export function normalizeInstitutionalEmail(
  value: string
): string {
  return value
    .normalize(
      "NFKC"
    )
    .trim()
    .toLowerCase();
}

export function isValidInstitutionalEmail(
  value: string
): boolean {
  const normalized =
    normalizeInstitutionalEmail(
      value
    );

  if (!normalized) {
    return false;
  }

  /*
   * Deliberately basic structural validation.
   *
   * We are not attempting to prove that the mailbox
   * exists here.
   */
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    normalized
  );
}

/*
 * =======================================================
 * CSV PARSER
 * =======================================================
 *
 * Supports:
 *
 * - commas inside quoted fields
 * - escaped quotes ("")
 * - CRLF
 * - LF
 * - quoted newlines
 *
 * No external CSV dependency is required.
 */
function parseCsv(
  csvText:
    string
): ParsedCsv {
  const rows:
    string[][] =
    [];

  let row:
    string[] =
    [];

  let field =
    "";

  let insideQuotes =
    false;

  for (
    let index = 0;
    index <
    csvText.length;
    index += 1
  ) {
    const character =
      csvText[index];

    if (
      character ===
      '"'
    ) {
      if (
        insideQuotes &&
        csvText[
          index + 1
        ] ===
          '"'
      ) {
        field +=
          '"';

        index +=
          1;

        continue;
      }

      insideQuotes =
        !insideQuotes;

      continue;
    }

    if (
      !insideQuotes &&
      character ===
        ","
    ) {
      row.push(
        field
      );

      field =
        "";

      continue;
    }

    if (
      !insideQuotes &&
      (
        character ===
          "\n" ||
        character ===
          "\r"
      )
    ) {
      /*
       * Treat CRLF as one row ending.
       */
      if (
        character ===
          "\r" &&
        csvText[
          index + 1
        ] ===
          "\n"
      ) {
        index +=
          1;
      }

      row.push(
        field
      );

      field =
        "";

      if (
        !isBlankCsvRow(
          row
        )
      ) {
        rows.push(
          row
        );
      }

      row =
        [];

      continue;
    }

    field +=
      character;
  }

  if (
    insideQuotes
  ) {
    return {
      rows,

      error: {
        code:
          "UNCLOSED_QUOTED_FIELD",

        message:
          "The CSV contains a quoted field that was not closed correctly.",
      },
    };
  }

  row.push(
    field
  );

  if (
    !isBlankCsvRow(
      row
    )
  ) {
    rows.push(
      row
    );
  }

  return {
    rows,
  };
}

function isBlankCsvRow(
  row:
    string[]
): boolean {
  return row.every(
    (
      value
    ) =>
      value
        .trim()
        .length ===
      0
  );
}

/*
 * =======================================================
 * MAIN ROSTER VALIDATION
 * =======================================================
 */
export type RosterImportOptions = {
  flexibleHeaders?: boolean;
  currentStudentsOnly?: boolean;
};

const HEADER_ALIASES: Record<string,string> = {
  matric_no:"matric_number", matric_num:"matric_number", matriculation_number:"matric_number",
  registration_number:"matric_number", reg_number:"matric_number", student_number:"matric_number",
  student_id:"matric_number", id_number:"matric_number",
  student_name:"full_name", name:"full_name", fullname:"full_name", full_names:"full_name",
  first_name:"first_name", firstname:"first_name", given_name:"first_name",
  middle_name:"middle_name", middlename:"middle_name", other_names:"middle_name",
  surname:"last_name", last_name:"last_name", lastname:"last_name", family_name:"last_name",
  status:"student_status", enrollment_status:"student_status", enrolment_status:"student_status",
  current_status:"student_status", active_status:"student_status",
  student_email:"institutional_email", school_email:"institutional_email", email_address:"institutional_email",
};

export function parseUniversityRosterCsv(
  csvText: string,
  options: RosterImportOptions = {}
): UniversityRosterParseResult {
  const emptyResult:
    UniversityRosterParseResult = {
      valid:
        false,

      headers:
        [],

      totalDataRows:
        0,

      acceptedRecordCount:
        0,

      rejectedRowCount:
        0,

      activeRecordCount:
        0,

      inactiveRecordCount:
        0,

      records:
        [],

      rejectedRows:
        [],

      fileErrors:
        [],
    };

  if (
    typeof csvText !==
      "string" ||
    !csvText.trim()
  ) {
    return {
      ...emptyResult,

      fileErrors: [
        {
          code:
            "EMPTY_FILE",

          message:
            "The roster CSV is empty.",
        },
      ],
    };
  }

  const parsed =
    parseCsv(
      csvText
    );

  if (
    parsed.error
  ) {
    return {
      ...emptyResult,

      fileErrors: [
        parsed.error,
      ],
    };
  }

  if (
    parsed.rows.length ===
    0
  ) {
    return {
      ...emptyResult,

      fileErrors: [
        {
          code:
            "EMPTY_FILE",

          message:
            "The roster CSV does not contain any rows.",
        },
      ],
    };
  }

  const rawHeaders =
    parsed.rows[0];

  if (
    rawHeaders.length ===
    0
  ) {
    return {
      ...emptyResult,

      fileErrors: [
        {
          code:
            "HEADER_REQUIRED",

          message:
            "The roster CSV must contain a header row.",
        },
      ],
    };
  }

  const headers = rawHeaders.map((header) => {
    const clean = normalizeRosterHeader(header);
    return options.flexibleHeaders ? (HEADER_ALIASES[clean] || clean) : clean;
  });

  const fileErrors:
    UniversityRosterFileError[] =
    [];

  /*
   * Duplicate headers are unsafe because it becomes
   * ambiguous which column CampusMart should trust.
   */
  const seenHeaders =
    new Set<string>();

  for (
    const header
    of headers
  ) {
    if (!header) {
      fileErrors.push({
        code:
          "UNSUPPORTED_HEADER",

        message:
          "The roster contains an empty column header.",
      });

      continue;
    }

    if (
      seenHeaders.has(
        header
      )
    ) {
      fileErrors.push({
        code:
          "DUPLICATE_HEADER",

        message:
          `The roster contains the duplicate column "${header}".`,
      });

      continue;
    }

    seenHeaders.add(
      header
    );

    if (!options.flexibleHeaders && !ALLOWED_ROSTER_HEADERS.has(header)) {
      fileErrors.push({
        code:
          "UNSUPPORTED_HEADER",

        message:
          `The column "${header}" is not part of the CampusMart roster format. Remove unrelated student data before importing the roster.`,
      });
    }
  }

  const requiredHeaders = options.flexibleHeaders
    ? ["matric_number"]
    : [...REQUIRED_ROSTER_HEADERS];
  if (options.flexibleHeaders) {
    if (!seenHeaders.has("full_name") &&
       !(seenHeaders.has("first_name") && seenHeaders.has("last_name"))) {
      fileErrors.push({code:"MISSING_REQUIRED_HEADER",message:"Use a full_name column or first_name plus last_name."});
    }
    if (!seenHeaders.has("student_status") && !options.currentStudentsOnly) {
      fileErrors.push({code:"MISSING_REQUIRED_HEADER",message:"No student status column. Tick 'Official current students only' if the university has confirmed this roster contains only current students."});
    }
  }
  for (const requiredHeader of requiredHeaders) {
    if (
      !seenHeaders.has(
        requiredHeader
      )
    ) {
      fileErrors.push({
        code:
          "MISSING_REQUIRED_HEADER",

        message:
          `The required column "${requiredHeader}" is missing from the roster.`,
      });
    }
  }

  if (
    fileErrors.length >
    0
  ) {
    return {
      ...emptyResult,

      headers,

      fileErrors,
    };
  }

  const dataRows =
    parsed.rows.slice(
      1
    );

  if (
    dataRows.length >
    MAX_ROSTER_DATA_ROWS
  ) {
    return {
      ...emptyResult,

      headers,

      totalDataRows:
        dataRows.length,

      fileErrors: [
        {
          code:
            "TOO_MANY_ROWS",

          message:
            `This roster contains ${dataRows.length} data rows. CampusMart currently accepts a maximum of ${MAX_ROSTER_DATA_ROWS} rows in one import.`,
        },
      ],
    };
  }

  const headerIndex =
    new Map<
      string,
      number
    >();

  headers.forEach(
    (
      header,
      index
    ) => {
      headerIndex.set(
        header,
        index
      );
    }
  );

  const matricIndex =
    headerIndex.get(
      "matric_number"
    )!;

  const fullNameIndex = headerIndex.get("full_name");
  const firstNameIndex = headerIndex.get("first_name");
  const middleNameIndex = headerIndex.get("middle_name");
  const lastNameIndex = headerIndex.get("last_name");

  const statusIndex = headerIndex.get("student_status");

  const emailIndex =
    headerIndex.get(
      "institutional_email"
    );

  const records:
    UniversityRosterPreparedRecord[] =
    [];

  const rejectedRows:
    UniversityRosterRejectedRow[] =
    [];

  const seenMatricNumbers =
    new Map<
      string,
      number
    >();

  for (
    let index = 0;
    index <
    dataRows.length;
    index += 1
  ) {
    const row =
      dataRows[index];

    /*
     * Header is logical row 1.
     *
     * First data row is logical row 2.
     */
    const sourceRowNumber =
      index + 2;

    if (
      row.length !==
      headers.length
    ) {
      rejectedRows.push({
        sourceRowNumber,

        code:
          "COLUMN_COUNT_MISMATCH",

        message:
          `Row ${sourceRowNumber} contains ${row.length} columns but the header contains ${headers.length}.`,
      });

      continue;
    }

    const rawMatricNumber =
      (
        row[
          matricIndex
        ] || ""
      ).trim();

    const normalizedMatricNumber =
      normalizeMatricNumber(
        rawMatricNumber
      );

    if (
      !normalizedMatricNumber
    ) {
      rejectedRows.push({
        sourceRowNumber,

        code:
          "MATRIC_NUMBER_REQUIRED",

        message:
          `Row ${sourceRowNumber} does not contain a matric number.`,

        matricNumber:
          rawMatricNumber ||
          null,
      });

      continue;
    }

    const previousRow =
      seenMatricNumbers.get(
        normalizedMatricNumber
      );

    if (
      previousRow !==
      undefined
    ) {
      rejectedRows.push({
        sourceRowNumber,

        code:
          "DUPLICATE_MATRIC_NUMBER",

        message:
          `Row ${sourceRowNumber} contains the same normalized matric number as row ${previousRow}.`,

        matricNumber:
          rawMatricNumber,
      });

      continue;
    }

    const rawName = fullNameIndex !== undefined
      ? row[fullNameIndex]
      : [firstNameIndex, middleNameIndex, lastNameIndex]
          .filter((index): index is number => index !== undefined)
          .map(index => row[index] || "").filter(Boolean).join(" ");
    const fullName =
      (
        rawName || ""
      )
        .normalize(
          "NFKC"
        )
        .trim()
        .replace(
          /\s+/g,
          " "
        );

    if (
      !fullName
    ) {
      rejectedRows.push({
        sourceRowNumber,

        code:
          "FULL_NAME_REQUIRED",

        message:
          `Row ${sourceRowNumber} does not contain a student name.`,

        matricNumber:
          rawMatricNumber,
      });

      continue;
    }

    const normalizedFullName =
      normalizeStudentFullName(
        fullName
      );

    const nameTokens =
      getNormalizedStudentNameTokens(
        fullName
      );

    if (
      !normalizedFullName ||
      nameTokens.length <
        2
    ) {
      rejectedRows.push({
        sourceRowNumber,

        code:
          "INVALID_NAME",

        message:
          `Row ${sourceRowNumber} must contain at least two usable student name tokens.`,

        matricNumber:
          rawMatricNumber,
      });

      continue;
    }

    const studentStatus =
      (
        (statusIndex !== undefined ? row[statusIndex] : null) ||
        (statusIndex === undefined && options.currentStudentsOnly ? "active" : "")
      )
        .normalize(
          "NFKC"
        )
        .trim();

    if (
      !studentStatus
    ) {
      rejectedRows.push({
        sourceRowNumber,

        code:
          "STUDENT_STATUS_REQUIRED",

        message:
          `Row ${sourceRowNumber} does not contain a student status.`,

        matricNumber:
          rawMatricNumber,
      });

      continue;
    }

    const interpretedStatus =
      interpretRosterStudentStatus(
        studentStatus
      );

    if (
      !interpretedStatus.valid
    ) {
      rejectedRows.push({
        sourceRowNumber,

        code:
          "UNSUPPORTED_STUDENT_STATUS",

        message:
          `Row ${sourceRowNumber} uses the unsupported student status "${studentStatus}". CampusMart will not guess whether that status means active or inactive.`,

        matricNumber:
          rawMatricNumber,
      });

      continue;
    }

    let institutionalEmail:
      string | null =
      null;

    if (
      emailIndex !==
      undefined
    ) {
      const rawEmail =
        (
          row[
            emailIndex
          ] || ""
        ).trim();

      if (
        rawEmail
      ) {
        if (
          !isValidInstitutionalEmail(
            rawEmail
          )
        ) {
          rejectedRows.push({
            sourceRowNumber,

            code:
              "INVALID_INSTITUTIONAL_EMAIL",

            message:
              `Row ${sourceRowNumber} contains an invalid institutional email address.`,

            matricNumber:
              rawMatricNumber,
          });

          continue;
        }

        institutionalEmail =
          normalizeInstitutionalEmail(
            rawEmail
          );
      }
    }

    /*
     * Only mark the matric number as consumed after the
     * rest of the row has passed validation.
     */
    seenMatricNumbers.set(
      normalizedMatricNumber,
      sourceRowNumber
    );

    records.push({
      sourceRowNumber,

      matricNumber:
        rawMatricNumber,

      normalizedMatricNumber,

      fullName,

      normalizedFullName,

      studentStatus,

      isActiveStudent:
        interpretedStatus.isActiveStudent,

      institutionalEmail,
    });
  }

  const activeRecordCount =
    records.filter(
      (
        record
      ) =>
        record.isActiveStudent
    ).length;

  const inactiveRecordCount =
    records.length -
    activeRecordCount;

  return {
    /*
     * For now we require a completely clean roster before
     * activation.
     *
     * Later the Admin importer can show rejected rows and
     * let an authorised Admin correct the source file and
     * upload it again.
     *
     * We do NOT silently activate a partial roster.
     */
    valid:
      rejectedRows.length ===
        0 &&
      records.length >
        0,

    headers,

    totalDataRows:
      dataRows.length,

    acceptedRecordCount:
      records.length,

    rejectedRowCount:
      rejectedRows.length,

    activeRecordCount,

    inactiveRecordCount,

    records,

    rejectedRows,

    fileErrors:
      [],
  };
}