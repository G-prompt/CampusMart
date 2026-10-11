import {
  NextFunction,
  Request,
  Response,
} from "express";

import multer from "multer";

/*
 * =======================================================
 * CAMPUSMART UNIVERSITY ROSTER UPLOAD
 * =======================================================
 *
 * University roster CSV files are processed in memory.
 *
 * The raw uploaded roster is NOT:
 *
 * - written to local disk
 * - uploaded to Cloudinary
 * - exposed through a public URL
 *
 * After upload, the controller reads the file buffer,
 * validates the CSV and passes the parsed data into the
 * roster-import service.
 */

const MAX_UNIVERSITY_ROSTER_FILE_SIZE =
  10 * 1024 * 1024;

/*
 * CSV MIME types vary between:
 *
 * - browsers
 * - Windows
 * - Excel
 * - operating systems
 *
 * We therefore require a .csv filename and accept a small
 * set of MIME types that are commonly used for CSV files.
 *
 * The actual contents are still validated by the
 * CampusMart roster parser afterwards.
 */
const ALLOWED_UNIVERSITY_ROSTER_MIME_TYPES =
  new Set([
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
    "application/octet-stream",
  ]);

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        MAX_UNIVERSITY_ROSTER_FILE_SIZE,

      files:
        1,
    },

    fileFilter: (
      _req,
      file,
      callback
    ) => {
      const fileName =
        file.originalname
          .trim()
          .toLowerCase();

      if (
        !fileName.endsWith(
          ".csv"
        )
      ) {
        callback(
          new Error(
            "UNIVERSITY_ROSTER_CSV_REQUIRED"
          )
        );

        return;
      }

      if (
        !ALLOWED_UNIVERSITY_ROSTER_MIME_TYPES.has(
          file.mimetype
        )
      ) {
        callback(
          new Error(
            "UNSUPPORTED_UNIVERSITY_ROSTER_FILE_TYPE"
          )
        );

        return;
      }

      callback(
        null,
        true
      );
    },
  });

/*
 * =======================================================
 * EXPRESS MIDDLEWARE
 * =======================================================
 *
 * Expected multipart field:
 *
 * file
 */
export const universityRosterUpload =
  (
    req:
      Request,

    res:
      Response,

    next:
      NextFunction
  ) => {
    upload.single(
      "file"
    )(
      req,
      res,
      (
        error:
          | unknown
      ) => {
        if (
          !error
        ) {
          next();

          return;
        }

        if (
          error instanceof
            multer.MulterError
        ) {
          if (
            error.code ===
            "LIMIT_FILE_SIZE"
          ) {
            res
              .status(413)
              .json({
                success:
                  false,

                code:
                  "UNIVERSITY_ROSTER_FILE_TOO_LARGE",

                message:
                  "University roster CSV files must be 10 MB or smaller.",
              });

            return;
          }

          if (
            error.code ===
            "LIMIT_FILE_COUNT"
          ) {
            res
              .status(400)
              .json({
                success:
                  false,

                code:
                  "TOO_MANY_UNIVERSITY_ROSTER_FILES",

                message:
                  "Upload one university roster at a time.",
              });

            return;
          }

          if (
            error.code ===
            "LIMIT_UNEXPECTED_FILE"
          ) {
            res
              .status(400)
              .json({
                success:
                  false,

                code:
                  "INVALID_UNIVERSITY_ROSTER_FILE_FIELD",

                message:
                  'Upload the roster CSV using the field name "file".',
              });

            return;
          }

          res
            .status(400)
            .json({
              success:
                false,

              code:
                "INVALID_UNIVERSITY_ROSTER_UPLOAD",

              message:
                "The university roster file could not be uploaded.",
            });

          return;
        }

        if (
          error instanceof
            Error &&
          error.message ===
            "UNIVERSITY_ROSTER_CSV_REQUIRED"
        ) {
          res
            .status(415)
            .json({
              success:
                false,

              code:
                "UNIVERSITY_ROSTER_CSV_REQUIRED",

              message:
                "Upload a CSV file for the university roster.",
            });

          return;
        }

        if (
          error instanceof
            Error &&
          error.message ===
            "UNSUPPORTED_UNIVERSITY_ROSTER_FILE_TYPE"
        ) {
          res
            .status(415)
            .json({
              success:
                false,

              code:
                "UNSUPPORTED_UNIVERSITY_ROSTER_FILE_TYPE",

              message:
                "The uploaded file is not a supported CSV file.",
            });

          return;
        }

        console.error(
          "University roster upload middleware error:",
          error
        );

        res
          .status(400)
          .json({
            success:
              false,

            code:
              "INVALID_UNIVERSITY_ROSTER_UPLOAD",

            message:
              "The university roster file could not be processed.",
          });
      }
    );
  };