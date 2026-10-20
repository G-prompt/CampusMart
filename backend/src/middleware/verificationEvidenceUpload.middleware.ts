import {
  NextFunction,
  Request,
  Response,
} from "express";

import multer from "multer";

const MAX_VERIFICATION_FILE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_VERIFICATION_MIME_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]);

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        MAX_VERIFICATION_FILE_SIZE,

      files:
        1,
    },

    fileFilter: (
      _req,
      file,
      callback
    ) => {
      if (
        ALLOWED_VERIFICATION_MIME_TYPES.has(
          file.mimetype
        )
      ) {
        callback(
          null,
          true
        );

        return;
      }

      callback(
        new Error(
          "UNSUPPORTED_VERIFICATION_FILE_TYPE"
        )
      );
    },
  });

export const verificationEvidenceUpload =
  (
    req: Request,
    res: Response,
    next: NextFunction
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
        if (!error) {
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
                success: false,

                code:
                  "VERIFICATION_FILE_TOO_LARGE",

                message:
                  "Verification files must be 5 MB or smaller.",
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
                success: false,

                code:
                  "TOO_MANY_VERIFICATION_FILES",

                message:
                  "Upload one verification file at a time.",
              });

            return;
          }

          res
            .status(400)
            .json({
              success: false,

              code:
                "INVALID_VERIFICATION_UPLOAD",

              message:
                "The verification file could not be uploaded.",
            });

          return;
        }

        if (
          error instanceof
            Error &&
          error.message ===
            "UNSUPPORTED_VERIFICATION_FILE_TYPE"
        ) {
          res
            .status(415)
            .json({
              success: false,

              code:
                "UNSUPPORTED_VERIFICATION_FILE_TYPE",

              message:
                "Upload a JPEG, PNG, WebP or PDF file.",
            });

          return;
        }

        console.error(
          "Verification upload middleware error:",
          error
        );

        res
          .status(400)
          .json({
            success: false,

            code:
              "INVALID_VERIFICATION_UPLOAD",

            message:
              "The verification file could not be processed.",
          });
      }
    );
  };