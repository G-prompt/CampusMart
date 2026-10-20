import {
  createHash,
} from "node:crypto";

import {
  UniversityRosterImportStatus,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

import {
  parseUniversityRosterCsv,
  type UniversityRosterParseResult,
  type UniversityRosterPreparedRecord,
} from "../lib/universityRoster";

/*
 * =======================================================
 * CAMPUSMART UNIVERSITY ROSTER IMPORT SERVICE
 * =======================================================
 *
 * Responsibilities:
 *
 * 1. Validate import metadata.
 * 2. Parse and validate the CSV.
 * 3. Reject partial/unsafe rosters.
 * 4. Detect duplicate source files.
 * 5. Create the import transactionally.
 * 6. Insert normalized student records.
 * 7. Keep prior active sources intact, including department rosters.
 * 8. Activate the newly imported source independently.
 *
 * This service does NOT:
 *
 * - handle Express requests
 * - authenticate Admins
 * - accept multipart uploads
 * - automatically verify student accounts
 *
 * Those layers will call this service later.
 */

const MAX_ORIGINAL_FILE_NAME_LENGTH =
  255;

const MAX_ACADEMIC_SESSION_LENGTH =
  100;

const MAX_SOURCE_ISSUER_LENGTH =
  250;

const MAX_SOURCE_REFERENCE_LENGTH =
  500;

/*
 * Insert records in smaller batches rather than trying
 * to send tens of thousands of rows through one Prisma
 * createMany call.
 */
const RECORD_INSERT_BATCH_SIZE =
  1_000;

export type CreateUniversityRosterImportInput = {
  universityId: string;

  importedByAdminId: string;

  csvText: string;

  currentStudentsOnly?: boolean;

  originalFileName: string;

  academicSession: string;

  sourceIssuer: string;

  sourceReference?:
    | string
    | null;

  validFrom?:
    | string
    | Date
    | null;

  expiresAt?:
    | string
    | Date
    | null;
};

export type UniversityRosterImportSummary = {
  id: string;

  universityId: string;

  universityName: string;

  universityShortName: string;

  status:
    UniversityRosterImportStatus;

  academicSession: string;

  sourceIssuer: string;

  sourceReference:
    | string
    | null;

  originalFileName: string;

  fileSha256: string;

  validFrom:
    | Date
    | null;

  expiresAt:
    | Date
    | null;

  recordCount: number;

  activeRecordCount: number;

  inactiveRecordCount: number;

  rejectedRowCount: number;

  importedAt: Date;

  activatedAt:
    | Date
    | null;

  archivedPreviousRosterCount:
    number;
};

export class UniversityRosterImportError extends Error {
  code: string;

  statusCode: number;

  details?:
    unknown;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details?:
      unknown
  ) {
    super(
      message
    );

    this.name =
      "UniversityRosterImportError";

    this.code =
      code;

    this.statusCode =
      statusCode;

    this.details =
      details;
  }
}

/*
 * =======================================================
 * PUBLIC SERVICE
 * =======================================================
 */

export async function createUniversityRosterImport(
  input:
    CreateUniversityRosterImportInput
): Promise<UniversityRosterImportSummary> {
  const universityId =
    cleanRequiredText(
      input.universityId
    );

  const importedByAdminId =
    cleanRequiredText(
      input.importedByAdminId
    );

  const originalFileName =
    cleanRequiredText(
      input.originalFileName
    );

  const academicSession =
    cleanRequiredText(
      input.academicSession
    );

  const sourceIssuer =
    cleanRequiredText(
      input.sourceIssuer
    );

  const sourceReference =
    cleanOptionalText(
      input.sourceReference
    );

  const csvText =
    typeof input.csvText ===
    "string"
      ? input.csvText
      : "";

  /*
   * -----------------------------------------------------
   * BASIC METADATA VALIDATION
   * -----------------------------------------------------
   */

  if (
    !universityId
  ) {
    throw new UniversityRosterImportError(
      "UNIVERSITY_ID_REQUIRED",
      "University ID is required."
    );
  }

  if (
    !importedByAdminId
  ) {
    throw new UniversityRosterImportError(
      "ADMIN_ID_REQUIRED",
      "The importing Admin account is required."
    );
  }

  if (
    !originalFileName
  ) {
    throw new UniversityRosterImportError(
      "FILE_NAME_REQUIRED",
      "The roster file name is required."
    );
  }

  if (
    originalFileName.length >
    MAX_ORIGINAL_FILE_NAME_LENGTH
  ) {
    throw new UniversityRosterImportError(
      "FILE_NAME_TOO_LONG",
      `The roster file name must be ${MAX_ORIGINAL_FILE_NAME_LENGTH} characters or fewer.`
    );
  }

  if (
    !originalFileName
      .toLowerCase()
      .endsWith(
        ".csv"
      )
  ) {
    throw new UniversityRosterImportError(
      "CSV_FILE_REQUIRED",
      "University rosters must be provided as a CSV file."
    );
  }

  if (
    !academicSession
  ) {
    throw new UniversityRosterImportError(
      "ACADEMIC_SESSION_REQUIRED",
      "Academic session is required."
    );
  }

  if (
    academicSession.length >
    MAX_ACADEMIC_SESSION_LENGTH
  ) {
    throw new UniversityRosterImportError(
      "ACADEMIC_SESSION_TOO_LONG",
      `Academic session must be ${MAX_ACADEMIC_SESSION_LENGTH} characters or fewer.`
    );
  }

  if (
    !sourceIssuer
  ) {
    throw new UniversityRosterImportError(
      "SOURCE_ISSUER_REQUIRED",
      "The university roster issuer or source is required."
    );
  }

  if (
    sourceIssuer.length >
    MAX_SOURCE_ISSUER_LENGTH
  ) {
    throw new UniversityRosterImportError(
      "SOURCE_ISSUER_TOO_LONG",
      `Source issuer must be ${MAX_SOURCE_ISSUER_LENGTH} characters or fewer.`
    );
  }

  if (
    sourceReference &&
    sourceReference.length >
      MAX_SOURCE_REFERENCE_LENGTH
  ) {
    throw new UniversityRosterImportError(
      "SOURCE_REFERENCE_TOO_LONG",
      `Source reference must be ${MAX_SOURCE_REFERENCE_LENGTH} characters or fewer.`
    );
  }

  if (
    !csvText.trim()
  ) {
    throw new UniversityRosterImportError(
      "EMPTY_ROSTER_FILE",
      "The roster CSV is empty."
    );
  }

  /*
   * -----------------------------------------------------
   * VALIDITY DATES
   * -----------------------------------------------------
   */

  const validFrom =
    parseOptionalDate(
      input.validFrom,
      "validFrom"
    );

  const expiresAt =
    parseOptionalDate(
      input.expiresAt,
      "expiresAt"
    );

  if (
    validFrom &&
    expiresAt &&
    validFrom.getTime() >
      expiresAt.getTime()
  ) {
    throw new UniversityRosterImportError(
      "INVALID_ROSTER_VALIDITY_WINDOW",
      "Roster expiry must be later than its valid-from date."
    );
  }

  /*
   * A roster that is already expired must never become
   * CampusMart's newly-active automated source.
   */
  if (
    expiresAt &&
    expiresAt.getTime() <=
      Date.now()
  ) {
    throw new UniversityRosterImportError(
      "ROSTER_ALREADY_EXPIRED",
      "This roster has already expired and cannot be activated."
    );
  }

  /*
   * -----------------------------------------------------
   * CSV PARSING
   * -----------------------------------------------------
   */

  const parseResult = parseUniversityRosterCsv(csvText, {
    flexibleHeaders: true,
    currentStudentsOnly: input.currentStudentsOnly === true,
  });

  validateParseResult(
    parseResult
  );

  /*
   * SHA-256 gives us a stable fingerprint of the exact
   * supplied source file.
   *
   * This is not used as authentication.
   * It is used for duplicate-import detection/audit.
   */
  const fileSha256 =
    createHash(
      "sha256"
    )
      .update(
        csvText,
        "utf8"
      )
      .digest(
        "hex"
      );

  /*
   * -----------------------------------------------------
   * EXISTENCE + AUTHORITY CHECKS
   * -----------------------------------------------------
   */

  const [
    university,
    admin,
  ] =
    await Promise.all([
      prisma.university.findUnique({
        where: {
          id:
            universityId,
        },

        select: {
          id:
            true,

          name:
            true,

          shortName:
            true,

          active:
            true,
        },
      }),

      prisma.admin.findUnique({
        where: {
          id:
            importedByAdminId,
        },

        select: {
          id:
            true,

          active:
            true,
        },
      }),
    ]);

  if (
    !university
  ) {
    throw new UniversityRosterImportError(
      "UNIVERSITY_NOT_FOUND",
      "University not found.",
      404
    );
  }

  if (
    !admin
  ) {
    throw new UniversityRosterImportError(
      "ADMIN_NOT_FOUND",
      "The importing Admin account was not found.",
      404
    );
  }

  if (
    !admin.active
  ) {
    throw new UniversityRosterImportError(
      "ADMIN_INACTIVE",
      "The importing Admin account is inactive.",
      403
    );
  }

  /*
   * We allow a roster to be prepared for an inactive
   * university record because Admin may be configuring a
   * university before opening it publicly.
   *
   * University active/inactive controls registration
   * visibility, not whether Admin may maintain its data.
   */

  /*
   * -----------------------------------------------------
   * DUPLICATE SOURCE FILE CHECK
   * -----------------------------------------------------
   */

  const existingSameFile =
    await prisma.universityRosterImport.findFirst({
      where: {
        universityId,

        fileSha256,

        status: {
          in: [
            UniversityRosterImportStatus.processing,
            UniversityRosterImportStatus.active,
          ],
        },
      },

      select: {
        id:
          true,

        status:
          true,

        importedAt:
          true,
      },
    });

  if (
    existingSameFile
  ) {
    throw new UniversityRosterImportError(
      "DUPLICATE_ROSTER_FILE",
      "This exact roster file has already been imported for this university.",
      409,
      {
        existingImportId:
          existingSameFile.id,

        existingStatus:
          existingSameFile.status,

        importedAt:
          existingSameFile.importedAt,
      }
    );
  }

  /*
   * -----------------------------------------------------
   * TRANSACTIONAL IMPORT
   * -----------------------------------------------------
   *
   * Nothing becomes active unless all records are safely
   * inserted.
   *
   * Within the same transaction:
   *
   * 1. create new import as processing
   * 2. insert all validated records
   * 3. leave all other rosters unchanged
   * 4. activate the new source and audit it
   *
   * If any step fails, Prisma rolls everything back.
   */

  const transactionResult =
    await prisma.$transaction(
      async (
        tx
      ) => {
        const rosterImport =
          await tx.universityRosterImport.create({
            data: {
              universityId,

              importedByAdminId,

              academicSession,

              sourceIssuer,

              sourceReference,
              currentStudentsOnlyDeclared: input.currentStudentsOnly === true,

              originalFileName,

              fileSha256,

              status:
                UniversityRosterImportStatus.processing,

              validFrom,

              expiresAt,

              recordCount:
                parseResult.acceptedRecordCount,

              activeRecordCount:
                parseResult.activeRecordCount,

              inactiveRecordCount:
                parseResult.inactiveRecordCount,

              rejectedRowCount:
                parseResult.rejectedRowCount,
            },

            select: {
              id:
                true,

              importedAt:
                true,
            },
          });

        await insertRosterRecords(
          tx,
          rosterImport.id,
          parseResult.records
        );

        // Each roster is an independently managed source. Overlapping matric
        // numbers are retained per import so each issuer remains auditable.
        // Automatic matching reconciles evidence at query time.
        const archivedPreviousRosterCount = 0;

        const activatedAt =
          new Date();

        const activated =
          await tx.universityRosterImport.update({
            where: {
              id:
                rosterImport.id,
            },

            data: {
              status:
                UniversityRosterImportStatus.active,

              activatedAt,

              failureReason:
                null,
            },

            select: {
              id:
                true,

              universityId:
                true,

              status:
                true,

              academicSession:
                true,

              sourceIssuer:
                true,

              sourceReference:
                true,

              originalFileName:
                true,

              fileSha256:
                true,

              validFrom:
                true,

              expiresAt:
                true,

              recordCount:
                true,

              activeRecordCount:
                true,

              inactiveRecordCount:
                true,

              rejectedRowCount:
                true,

              importedAt:
                true,

              activatedAt:
                true,
            },
          });

        await tx.adminAuditLog.create({
          data: {
            actorAdminId: importedByAdminId,
            action: "university_roster_imported",
            targetType: "university_roster_import",
            targetId: rosterImport.id,
            reason: `Roster supplied by ${sourceIssuer}; academic session ${academicSession}`,
            beforeState: JSON.stringify({ existed: false }),
            afterState: JSON.stringify({ universityId, status: "active", recordCount: parseResult.acceptedRecordCount, fileSha256 }),
          },
        });

        return {
          activated,

          archivedPreviousRosterCount,
        };
      },
      {
        /*
         * Give large roster transactions some breathing
         * room while still preventing indefinitely-open
         * database work.
         */
        maxWait:
          10_000,

        timeout:
          60_000,
      }
    );

  return {
    id:
      transactionResult.activated.id,

    universityId:
      transactionResult.activated.universityId,

    universityName:
      university.name,

    universityShortName:
      university.shortName,

    status:
      transactionResult.activated.status,

    academicSession:
      transactionResult.activated.academicSession,

    sourceIssuer:
      transactionResult.activated.sourceIssuer,

    sourceReference:
      transactionResult.activated.sourceReference,

    originalFileName:
      transactionResult.activated.originalFileName,

    fileSha256:
      transactionResult.activated.fileSha256!,

    validFrom:
      transactionResult.activated.validFrom,

    expiresAt:
      transactionResult.activated.expiresAt,

    recordCount:
      transactionResult.activated.recordCount,

    activeRecordCount:
      transactionResult.activated.activeRecordCount,

    inactiveRecordCount:
      transactionResult.activated.inactiveRecordCount,

    rejectedRowCount:
      transactionResult.activated.rejectedRowCount,

    importedAt:
      transactionResult.activated.importedAt,

    activatedAt:
      transactionResult.activated.activatedAt,

    archivedPreviousRosterCount:
      transactionResult.archivedPreviousRosterCount,
  };
}

/*
 * =======================================================
 * PARSER RESULT VALIDATION
 * =======================================================
 */

function validateParseResult(
  result:
    UniversityRosterParseResult
) {
  if (
    result.fileErrors.length >
    0
  ) {
    throw new UniversityRosterImportError(
      "INVALID_ROSTER_FILE",
      result.fileErrors[0]
        ?.message ||
        "The roster CSV is invalid.",
      400,
      {
        fileErrors:
          result.fileErrors,

        headers:
          result.headers,
      }
    );
  }

  /*
   * CampusMart deliberately refuses to activate a
   * partially accepted roster.
   *
   * Admin must correct the source file and re-import.
   */
  if (
    result.rejectedRows.length >
    0
  ) {
    throw new UniversityRosterImportError(
      "ROSTER_CONTAINS_REJECTED_ROWS",
      `The roster contains ${result.rejectedRowCount} rejected row${
        result.rejectedRowCount ===
        1
          ? ""
          : "s"
      }. Correct the CSV before importing it.`,
      400,
      {
        acceptedRecordCount:
          result.acceptedRecordCount,

        rejectedRowCount:
          result.rejectedRowCount,

        rejectedRows:
          result.rejectedRows,
      }
    );
  }

  if (
    !result.valid
  ) {
    throw new UniversityRosterImportError(
      "ROSTER_NOT_VALID",
      "The roster did not pass CampusMart validation."
    );
  }

  if (
    result.records.length ===
    0
  ) {
    throw new UniversityRosterImportError(
      "ROSTER_HAS_NO_STUDENT_RECORDS",
      "The roster does not contain any valid student records."
    );
  }
}

/*
 * =======================================================
 * RECORD INSERTION
 * =======================================================
 */

type RosterTransactionClient =
  Parameters<
    Parameters<
      typeof prisma.$transaction
    >[0]
  >[0];

async function insertRosterRecords(
  tx:
    RosterTransactionClient,

  rosterImportId:
    string,

  records:
    UniversityRosterPreparedRecord[]
) {
  for (
    let start = 0;
    start <
    records.length;
    start +=
      RECORD_INSERT_BATCH_SIZE
  ) {
    const batch =
      records.slice(
        start,
        start +
          RECORD_INSERT_BATCH_SIZE
      );

    await tx.universityRosterRecord.createMany({
      data:
        batch.map(
          (
            record
          ) => ({
            rosterImportId,

            matricNumber:
              record.matricNumber,

            normalizedMatricNumber:
              record.normalizedMatricNumber,

            fullName:
              record.fullName,

            normalizedFullName:
              record.normalizedFullName,

            studentStatus:
              record.studentStatus,

            isActiveStudent:
              record.isActiveStudent,

            institutionalEmail:
              record.institutionalEmail,

            sourceRowNumber:
              record.sourceRowNumber,
          })
        ),
    });
  }
}

/*
 * =======================================================
 * HELPERS
 * =======================================================
 */

function cleanRequiredText(
  value:
    unknown
): string {
  return typeof value ===
    "string"
    ? value
        .normalize(
          "NFKC"
        )
        .trim()
    : "";
}

function cleanOptionalText(
  value:
    unknown
):
  | string
  | null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const cleaned =
    value
      .normalize(
        "NFKC"
      )
      .trim();

  return cleaned
    ? cleaned
    : null;
}

function parseOptionalDate(
  value:
    string
    | Date
    | null
    | undefined,

  fieldName:
    string
):
  | Date
  | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  const date =
    value instanceof
    Date
      ? new Date(
          value.getTime()
        )
      : new Date(
          value
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new UniversityRosterImportError(
      "INVALID_ROSTER_DATE",
      `The roster ${fieldName} value is not a valid date.`
    );
  }

  return date;
}