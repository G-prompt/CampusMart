import {
  Request,
  Response,
} from "express";

import type {
  AuthenticatedAdminRequest,
} from "../middleware/adminAuth.middleware";

import {
  UniversityRosterImportStatus,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

import {
  parseUniversityRosterCsv,
} from "../lib/universityRoster";

import {
  createUniversityRosterImport,
  UniversityRosterImportError,
} from "../services/universityRosterImport.service";

/*
 * =======================================================
 * CAMPUSMART ADMIN UNIVERSITY ROSTER CONTROLLER
 * =======================================================
 *
 * Responsibilities:
 *
 * - Preview an uploaded CSV before importing
 * - Import a validated university roster
 * - List roster import history
 * - Return one roster import summary
 * - Return the currently-active roster
 *
 * The raw CSV is handled in memory by Multer.
 *
 * It is NOT:
 *
 * - written to local disk
 * - uploaded to Cloudinary
 * - exposed publicly
 *
 * This controller does NOT automatically verify students
 * yet. That belongs to the roster verification provider
 * that we will build after the import workflow is stable.
 */

const MAX_REJECTED_ROWS_IN_RESPONSE =
  100;

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

function getUniversityId(
  req:
    Request
): string {
  return cleanRequiredText(
    req.params.universityId
  );
}

function getRosterImportId(
  req:
    Request
): string {
  return cleanRequiredText(
    req.params.rosterImportId
  );
}

/*
 * Converts the in-memory Multer file buffer into UTF-8
 * CSV text.
 */
function getUploadedCsv(
  req:
    Request
):
  | {
      valid:
        true;

      csvText:
        string;

      originalFileName:
        string;
    }
  | {
      valid:
        false;

      code:
        string;

      message:
        string;
    } {
  if (
    !req.file
  ) {
    return {
      valid:
        false,

      code:
        "UNIVERSITY_ROSTER_FILE_REQUIRED",

      message:
        "Choose a university roster CSV file.",
    };
  }

  if (
    !req.file.buffer ||
    req.file.buffer.length ===
      0
  ) {
    return {
      valid:
        false,

      code:
        "EMPTY_UNIVERSITY_ROSTER_FILE",

      message:
        "The uploaded university roster CSV is empty.",
    };
  }

  const originalFileName =
    req.file.originalname
      .normalize(
        "NFKC"
      )
      .trim();

  if (
    !originalFileName
  ) {
    return {
      valid:
        false,

      code:
        "UNIVERSITY_ROSTER_FILE_NAME_REQUIRED",

      message:
        "The uploaded roster must have a filename.",
    };
  }

  const csvText =
    req.file.buffer.toString(
      "utf8"
    );

  if (
    !csvText.trim()
  ) {
    return {
      valid:
        false,

      code:
        "EMPTY_UNIVERSITY_ROSTER_FILE",

      message:
        "The uploaded university roster CSV does not contain any data.",
    };
  }

  return {
    valid:
      true,

    csvText,

    originalFileName,
  };
}

function handleRosterImportError(
  error:
    unknown,

  res:
    Response
) {
  if (
    error instanceof
    UniversityRosterImportError
  ) {
    return res
      .status(
        error.statusCode
      )
      .json({
        success:
          false,

        code:
          error.code,

        message:
          error.message,

        details:
          error.details ??
          undefined,
      });
  }

  console.error(
    "University roster operation failed:",
    error
  );

  return res
    .status(500)
    .json({
      success:
        false,

      code:
        "UNIVERSITY_ROSTER_OPERATION_FAILED",

      message:
        "Unable to complete the university roster operation.",
    });
}

/*
 * =======================================================
 * PREVIEW UNIVERSITY ROSTER
 * =======================================================
 *
 * POST
 *
 * /api/admin/universities/:universityId/rosters/preview
 *
 * multipart/form-data:
 *
 * file = students.csv
 *
 * No database write occurs.
 *
 * This lets Admin inspect:
 *
 * - total records
 * - accepted records
 * - rejected records
 * - active students
 * - inactive students
 * - CSV/header problems
 *
 * before committing the roster.
 */
export const previewUniversityRoster =
  async (
    req:
      AuthenticatedAdminRequest,

    res:
      Response
  ) => {
    try {
      if (
        !req.admin
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Admin authentication required.",
          });
      }

      const universityId =
        getUniversityId(
          req
        );

      if (
        !universityId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              "UNIVERSITY_ID_REQUIRED",

            message:
              "University ID is required.",
          });
      }

      const university =
        await prisma.university.findUnique({
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
        });

      if (
        !university
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            code:
              "UNIVERSITY_NOT_FOUND",

            message:
              "University not found.",
          });
      }

      const uploadedCsv =
        getUploadedCsv(
          req
        );

      if (
        !uploadedCsv.valid
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              uploadedCsv.code,

            message:
              uploadedCsv.message,
          });
      }

      const result =
        parseUniversityRosterCsv(
          uploadedCsv.csvText
        );

      return res
        .status(200)
        .json({
          success:
            true,

          university: {
            id:
              university.id,

            name:
              university.name,

            shortName:
              university.shortName,

            active:
              university.active,
          },

          file: {
            originalFileName:
              uploadedCsv.originalFileName,

            sizeBytes:
              req.file?.size ??
              0,
          },

          preview: {
            valid:
              result.valid,

            headers:
              result.headers,

            totalDataRows:
              result.totalDataRows,

            acceptedRecordCount:
              result.acceptedRecordCount,

            rejectedRowCount:
              result.rejectedRowCount,

            activeRecordCount:
              result.activeRecordCount,

            inactiveRecordCount:
              result.inactiveRecordCount,

            fileErrors:
              result.fileErrors,

            rejectedRows:
              result.rejectedRows.slice(
                0,
                MAX_REJECTED_ROWS_IN_RESPONSE
              ),

            rejectedRowsTruncated:
              result.rejectedRows.length >
              MAX_REJECTED_ROWS_IN_RESPONSE,
          },
        });
    } catch (
      error
    ) {
      console.error(
        "Preview university roster failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          code:
            "ROSTER_PREVIEW_FAILED",

          message:
            "Unable to preview this university roster.",
        });
    }
  };

/*
 * =======================================================
 * IMPORT UNIVERSITY ROSTER
 * =======================================================
 *
 * POST
 *
 * /api/admin/universities/:universityId/rosters
 *
 * multipart/form-data:
 *
 * file
 * academicSession
 * sourceIssuer
 * sourceReference    optional
 * validFrom          optional
 * expiresAt          optional
 *
 * The original filename comes from the uploaded file.
 *
 * The service then performs the actual transactional
 * database import.
 */
export const importUniversityRoster =
  async (
    req:
      AuthenticatedAdminRequest,

    res:
      Response
  ) => {
    try {
      if (
        !req.admin
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Admin authentication required.",
          });
      }

      const universityId =
        getUniversityId(
          req
        );

      if (
        !universityId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              "UNIVERSITY_ID_REQUIRED",

            message:
              "University ID is required.",
          });
      }

      const uploadedCsv =
        getUploadedCsv(
          req
        );

      if (
        !uploadedCsv.valid
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              uploadedCsv.code,

            message:
              uploadedCsv.message,
          });
      }

      const academicSession =
        cleanRequiredText(
          req.body
            ?.academicSession
        );

      const sourceIssuer =
        cleanRequiredText(
          req.body
            ?.sourceIssuer
        );

      const sourceReference =
        cleanOptionalText(
          req.body
            ?.sourceReference
        );

      const validFrom =
        cleanOptionalText(
          req.body
            ?.validFrom
        );

      const expiresAt =
        cleanOptionalText(
          req.body
            ?.expiresAt
        );

      if (
        !academicSession
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              "ACADEMIC_SESSION_REQUIRED",

            message:
              "Academic session is required.",
          });
      }

      if (
        !sourceIssuer
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              "SOURCE_ISSUER_REQUIRED",

            message:
              "Roster issuer or source is required.",
          });
      }

      const rosterImport =
        await createUniversityRosterImport({
          universityId,

          importedByAdminId:
            req.admin.id,

          csvText:
            uploadedCsv.csvText,

          originalFileName:
            uploadedCsv.originalFileName,

          academicSession,

          sourceIssuer,

          sourceReference,

          validFrom,

          expiresAt,
        });

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "University roster imported and activated successfully.",

          rosterImport,
        });
    } catch (
      error
    ) {
      return handleRosterImportError(
        error,
        res
      );
    }
  };

/*
 * =======================================================
 * LIST UNIVERSITY ROSTER IMPORTS
 * =======================================================
 *
 * GET
 *
 * /api/admin/universities/:universityId/rosters
 *
 * Returns import metadata only.
 *
 * It deliberately does NOT dump student identities.
 */
export const getUniversityRosterImports =
  async (
    req:
      AuthenticatedAdminRequest,

    res:
      Response
  ) => {
    try {
      if (
        !req.admin
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Admin authentication required.",
          });
      }

      const universityId =
        getUniversityId(
          req
        );

      if (
        !universityId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              "UNIVERSITY_ID_REQUIRED",

            message:
              "University ID is required.",
          });
      }

      const university =
        await prisma.university.findUnique({
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
          },
        });

      if (
        !university
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            code:
              "UNIVERSITY_NOT_FOUND",

            message:
              "University not found.",
          });
      }

      const imports =
        await prisma.universityRosterImport.findMany({
          where: {
            universityId,
          },

          orderBy: {
            importedAt:
              "desc",
          },

          select: {
            id:
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

            archivedAt:
              true,

            failureReason:
              true,

            importedByAdmin: {
              select: {
                id:
                  true,

                name:
                  true,

                email:
                  true,

                role:
                  true,
              },
            },
          },
        });

      return res
        .status(200)
        .json({
          success:
            true,

          university,

          count:
            imports.length,

          imports,
        });
    } catch (
      error
    ) {
      console.error(
        "Get university roster imports failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          code:
            "ROSTER_IMPORT_HISTORY_FAILED",

          message:
            "Unable to load roster import history.",
        });
    }
  };

/*
 * =======================================================
 * CURRENT ACTIVE UNIVERSITY ROSTER
 * =======================================================
 *
 * GET
 *
 * /api/admin/universities/:universityId/rosters/active
 */
export const getActiveUniversityRoster =
  async (
    req:
      AuthenticatedAdminRequest,

    res:
      Response
  ) => {
    try {
      if (
        !req.admin
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Admin authentication required.",
          });
      }

      const universityId =
        getUniversityId(
          req
        );

      if (
        !universityId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              "UNIVERSITY_ID_REQUIRED",

            message:
              "University ID is required.",
          });
      }

      const university =
        await prisma.university.findUnique({
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
          },
        });

      if (
        !university
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            code:
              "UNIVERSITY_NOT_FOUND",

            message:
              "University not found.",
          });
      }

      const rosterImport =
        await prisma.universityRosterImport.findFirst({
          where: {
            universityId,

            status:
              UniversityRosterImportStatus.active,
          },

          orderBy: {
            activatedAt:
              "desc",
          },

          select: {
            id:
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

            importedAt:
              true,

            activatedAt:
              true,

            importedByAdmin: {
              select: {
                id:
                  true,

                name:
                  true,

                role:
                  true,
              },
            },
          },
        });

      return res
        .status(200)
        .json({
          success:
            true,

          university,

          rosterImport:
            rosterImport ??
            null,
        });
    } catch (
      error
    ) {
      console.error(
        "Get active university roster failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          code:
            "ACTIVE_ROSTER_LOOKUP_FAILED",

          message:
            "Unable to load the active university roster.",
        });
    }
  };

/*
 * =======================================================
 * GET ONE UNIVERSITY ROSTER IMPORT
 * =======================================================
 *
 * GET
 *
 * /api/admin/universities/:universityId/rosters/:rosterImportId
 *
 * Returns metadata only.
 *
 * The SHA-256 fingerprint is included here because this is
 * a restricted Admin detail endpoint and it is useful for
 * audit/duplicate-source investigation.
 */
export const getUniversityRosterImportById =
  async (
    req:
      AuthenticatedAdminRequest,

    res:
      Response
  ) => {
    try {
      if (
        !req.admin
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Admin authentication required.",
          });
      }

      const universityId =
        getUniversityId(
          req
        );

      const rosterImportId =
        getRosterImportId(
          req
        );

      if (
        !universityId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              "UNIVERSITY_ID_REQUIRED",

            message:
              "University ID is required.",
          });
      }

      if (
        !rosterImportId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              "ROSTER_IMPORT_ID_REQUIRED",

            message:
              "Roster import ID is required.",
          });
      }

      const rosterImport =
        await prisma.universityRosterImport.findFirst({
          where: {
            id:
              rosterImportId,

            universityId,
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

            failureReason:
              true,

            importedAt:
              true,

            activatedAt:
              true,

            archivedAt:
              true,

            createdAt:
              true,

            updatedAt:
              true,

            university: {
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
            },

            importedByAdmin: {
              select: {
                id:
                  true,

                name:
                  true,

                email:
                  true,

                role:
                  true,
              },
            },
          },
        });

      if (
        !rosterImport
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            code:
              "ROSTER_IMPORT_NOT_FOUND",

            message:
              "Roster import not found.",
          });
      }

      return res
        .status(200)
        .json({
          success:
            true,

          rosterImport,
        });
    } catch (
      error
    ) {
      console.error(
        "Get university roster import failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          code:
            "ROSTER_IMPORT_DETAIL_FAILED",

          message:
            "Unable to load this roster import.",
        });
    }
  };