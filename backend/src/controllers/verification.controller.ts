import { Response } from "express";
import path from "path";

import type { AuthenticatedRequest } from "../middleware/auth.middleware";

import { prisma } from "../lib/prisma";

import {
  StudentVerificationStatus,
  VendorAccessStatus,
  VerificationAppealReason,
  VerificationAppealStatus,
  VerificationEvidenceType,
} from "../generated/prisma/client";

import {
  deleteVerificationEvidence,
  storeVerificationEvidence,
} from "../lib/verificationEvidenceStorage";

const ACTIVE_APPEAL_STATUSES: VerificationAppealStatus[] = [
  VerificationAppealStatus.draft,
  VerificationAppealStatus.pending,
  VerificationAppealStatus.under_review,
  VerificationAppealStatus.more_information_required,
];

const EVIDENCE_UPLOAD_STATUSES =
  new Set<VerificationAppealStatus>([
    VerificationAppealStatus.draft,
    VerificationAppealStatus.more_information_required,
  ]);

const APPEAL_SUBMISSION_STATUSES =
  new Set<VerificationAppealStatus>([
    VerificationAppealStatus.draft,
    VerificationAppealStatus.more_information_required,
  ]);

const PRIMARY_EVIDENCE_TYPES =
  new Set<VerificationEvidenceType>([
    VerificationEvidenceType.student_id,
    VerificationEvidenceType.student_portal,
    VerificationEvidenceType.admission_record,
  ]);

function cleanOptionalText(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned.length > 0
    ? cleaned
    : null;
}

function isValidAppealReason(
  value: unknown
): value is VerificationAppealReason {
  return Object.values(
    VerificationAppealReason
  ).includes(
    value as VerificationAppealReason
  );
}

function isValidEvidenceType(
  value: unknown
): value is VerificationEvidenceType {
  return Object.values(
    VerificationEvidenceType
  ).includes(
    value as VerificationEvidenceType
  );
}

function safeOriginalFileName(
  fileName: string
): string {
  const baseName =
    path.basename(
      fileName
    );

  return baseName
    .replace(
      /[\u0000-\u001F\u007F]/g,
      ""
    )
    .slice(
      0,
      255
    );
}

export const createVerificationAppeal =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Authentication required.",
          });
      }

      const {
        reason,
        explanation,
      } = req.body;

      if (
        !isValidAppealReason(
          reason
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Please select a valid verification issue.",

            code:
              "INVALID_APPEAL_REASON",
          });
      }

      const user =
        await prisma.user.findUnique({
          where: {
            id:
              req.user.id,
          },

          include: {
            university: {
              select: {
                id: true,
                name: true,
                state: true,
                city: true,
              },
            },

            verificationAppeals: {
              where: {
                status: {
                  in:
                    ACTIVE_APPEAL_STATUSES,
                },
              },

              orderBy: {
                createdAt:
                  "desc",
              },

              take: 1,
            },
          },
        });

      if (!user) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "User account not found.",
          });
      }

      if (
        user.studentVerificationStatus ===
        StudentVerificationStatus.verified
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Your student account is already verified.",

            code:
              "STUDENT_ALREADY_VERIFIED",
          });
      }

      const existingAppeal =
        user.verificationAppeals[0];

      if (existingAppeal) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              existingAppeal.status ===
              VerificationAppealStatus.draft
                ? "You already have a verification appeal draft."
                : "You already have a verification appeal being reviewed.",

            code:
              "APPEAL_ALREADY_OPEN",

            appeal: {
              id:
                existingAppeal.id,

              status:
                existingAppeal.status,

              createdAt:
                existingAppeal.createdAt,

              submittedAt:
                existingAppeal.submittedAt,
            },
          });
      }

      const submittedUniversityName =
        user.university?.name ||
        user.fallbackUniversityName;

      if (!submittedUniversityName) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Your university information is incomplete. Please update your account before requesting verification review.",

            code:
              "UNIVERSITY_DETAILS_REQUIRED",
          });
      }

      const submittedState =
        user.university?.state ||
        user.fallbackState;

      const submittedCity =
        user.university?.city ||
        user.fallbackCity;

      const cleanExplanation =
        cleanOptionalText(
          explanation
        );

      const appeal =
        await prisma.verificationAppeal.create(
          {
            data: {
              userId:
                user.id,

              universityId:
                user.universityId,

              reason,

              explanation:
                cleanExplanation,

              status:
                VerificationAppealStatus.draft,

              submittedName:
                user.name,

              submittedMatricNumber:
                user.matricNumber,

              submittedUniversityName,

              submittedState,

              submittedCity,
            },

            select: {
              id: true,

              reason: true,

              explanation:
                true,

              status: true,

              submittedName:
                true,

              submittedMatricNumber:
                true,

              submittedUniversityName:
                true,

              submittedState:
                true,

              submittedCity:
                true,

              decisionReason:
                true,

              createdAt:
                true,

              submittedAt:
                true,
            },
          }
        );

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Your verification appeal draft has been created. Add your proof of studentship before submitting it for review.",

          appeal,
        });
    } catch (error) {
      console.error(
        "Create verification appeal error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Unable to start your verification appeal.",
        });
    }
  };

export const uploadVerificationEvidence =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    let uploadedStorageKey:
      | string
      | null = null;

    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Authentication required.",
          });
      }

      const appealId =
        String(
          req.params.appealId ||
            ""
        ).trim();

      if (!appealId) {
        return res
          .status(400)
          .json({
            success: false,

            code:
              "APPEAL_ID_REQUIRED",

            message:
              "Verification appeal ID is required.",
          });
      }

      const evidenceType =
        req.body.type;

      if (
        !isValidEvidenceType(
          evidenceType
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            code:
              "INVALID_EVIDENCE_TYPE",

            message:
              "Please select a valid type of verification evidence.",
          });
      }

      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,

            code:
              "VERIFICATION_FILE_REQUIRED",

            message:
              "Choose a verification file to upload.",
          });
      }

      const appeal =
        await prisma.verificationAppeal.findFirst(
          {
            where: {
              id:
                appealId,

              userId:
                req.user.id,
            },

            select: {
              id: true,

              status: true,

              evidence: {
                select: {
                  id: true,
                  type: true,
                },
              },
            },
          }
        );

      if (!appeal) {
        return res
          .status(404)
          .json({
            success: false,

            code:
              "VERIFICATION_APPEAL_NOT_FOUND",

            message:
              "Verification appeal not found.",
          });
      }

      if (
        !EVIDENCE_UPLOAD_STATUSES.has(
          appeal.status
        )
      ) {
        return res
          .status(409)
          .json({
            success: false,

            code:
              "APPEAL_NOT_ACCEPTING_EVIDENCE",

            message:
              "This verification appeal is not currently accepting new evidence.",
          });
      }

      if (
        appeal.evidence.length >=
        4
      ) {
        return res
          .status(409)
          .json({
            success: false,

            code:
              "EVIDENCE_LIMIT_REACHED",

            message:
              "This verification appeal already has the maximum number of evidence files.",
          });
      }

      if (
        evidenceType ===
          VerificationEvidenceType.student_id &&
        appeal.evidence.some(
          (item) =>
            item.type ===
            VerificationEvidenceType.student_id
        )
      ) {
        return res
          .status(409)
          .json({
            success: false,

            code:
              "STUDENT_ID_ALREADY_UPLOADED",

            message:
              "A student ID has already been added to this verification appeal.",
          });
      }

      const stored =
        await storeVerificationEvidence({
          userId:
            req.user.id,

          appealId:
            appeal.id,

          evidenceLabel:
            evidenceType.replace(
              /_/g,
              "-"
            ),

          file:
            req.file,
        });

      uploadedStorageKey =
        stored.storageKey;

      try {
        const evidence =
          await prisma.verificationAppealEvidence.create(
            {
              data: {
                appealId:
                  appeal.id,

                type:
                  evidenceType,

                storageKey:
                  stored.storageKey,

                originalFileName:
                  safeOriginalFileName(
                    req.file.originalname
                  ),

                mimeType:
                  stored.mimeType,

                fileSizeBytes:
                  stored.fileSizeBytes,
              },

              select: {
                id: true,
                type: true,

                originalFileName:
                  true,

                mimeType:
                  true,

                fileSizeBytes:
                  true,

                createdAt:
                  true,
              },
            }
          );

        return res
          .status(201)
          .json({
            success: true,

            message:
              "Verification evidence uploaded securely.",

            evidence,
          });
      } catch (
        databaseError
      ) {
        try {
          await deleteVerificationEvidence(
            stored.storageKey
          );
        } catch (
          cleanupError
        ) {
          console.error(
            "Verification evidence cleanup failed after database error:",
            cleanupError
          );
        }

        uploadedStorageKey =
          null;

        throw databaseError;
      }
    } catch (error) {
      if (
        uploadedStorageKey
      ) {
        try {
          await deleteVerificationEvidence(
            uploadedStorageKey
          );
        } catch (
          cleanupError
        ) {
          console.error(
            "Verification evidence cleanup failed:",
            cleanupError
          );
        }
      }

      console.error(
        "Upload verification evidence error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Unable to upload verification evidence.",
        });
    }
  };

export const submitVerificationAppeal =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Authentication required.",
          });
      }

      const appealId =
        String(
          req.params.appealId ||
            ""
        ).trim();

      if (!appealId) {
        return res
          .status(400)
          .json({
            success: false,

            code:
              "APPEAL_ID_REQUIRED",

            message:
              "Verification appeal ID is required.",
          });
      }

      const appeal =
        await prisma.verificationAppeal.findFirst(
          {
            where: {
              id:
                appealId,

              userId:
                req.user.id,
            },

            select: {
              id: true,
              status: true,

              reason: true,

              submittedUniversityName:
                true,

              evidence: {
                select: {
                  id: true,
                  type: true,
                },
              },

              user: {
                select: {
                  studentVerificationStatus:
                    true,
                },
              },
            },
          }
        );

      if (!appeal) {
        return res
          .status(404)
          .json({
            success: false,

            code:
              "VERIFICATION_APPEAL_NOT_FOUND",

            message:
              "Verification appeal not found.",
          });
      }

      if (
        appeal.user
          .studentVerificationStatus ===
        StudentVerificationStatus.verified
      ) {
        return res
          .status(409)
          .json({
            success: false,

            code:
              "STUDENT_ALREADY_VERIFIED",

            message:
              "Your student identity is already verified.",
          });
      }

      if (
        !APPEAL_SUBMISSION_STATUSES.has(
          appeal.status
        )
      ) {
        return res
          .status(409)
          .json({
            success: false,

            code:
              "APPEAL_NOT_SUBMITTABLE",

            message:
              "This verification appeal cannot currently be submitted.",
          });
      }

      if (
        appeal.evidence.length <
        2
      ) {
        return res
          .status(400)
          .json({
            success: false,

            code:
              "MORE_EVIDENCE_REQUIRED",

            message:
              "Add at least two pieces of proof before submitting your verification appeal.",
          });
      }

      const evidenceTypes =
        new Set(
          appeal.evidence.map(
            (item) =>
              item.type
          )
        );

      if (
        evidenceTypes.size <
        2
      ) {
        return res
          .status(400)
          .json({
            success: false,

            code:
              "DIFFERENT_EVIDENCE_TYPES_REQUIRED",

            message:
              "Use at least two different types of proof for your verification appeal.",
          });
      }

      const hasPrimaryEvidence =
        appeal.evidence.some(
          (item) =>
            PRIMARY_EVIDENCE_TYPES.has(
              item.type
            )
        );

      if (
        !hasPrimaryEvidence
      ) {
        return res
          .status(400)
          .json({
            success: false,

            code:
              "PRIMARY_EVIDENCE_REQUIRED",

            message:
              "Add a student ID, student portal record, or admission/student record before submitting your appeal.",
          });
      }

      const submittedAt =
        new Date();

      const result =
        await prisma.$transaction(
          async (
            transaction
          ) => {
            const updatedAppeal =
              await transaction.verificationAppeal.updateMany(
                {
                  where: {
                    id:
                      appeal.id,

                    userId:
                      req.user!.id,

                    status: {
                      in: [
                        VerificationAppealStatus.draft,
                        VerificationAppealStatus.more_information_required,
                      ],
                    },
                  },

                  data: {
                    status:
                      VerificationAppealStatus.pending,

                    submittedAt,

                    /*
                     * A resubmitted appeal
                     * returns to the queue as
                     * a fresh review item.
                     */
                    reviewedByAdminId:
                      null,

                    reviewedAt:
                      null,

                    decisionReason:
                      null,
                  },
                }
              );

            if (
              updatedAppeal.count !==
              1
            ) {
              throw new Error(
                "APPEAL_SUBMISSION_CONFLICT"
              );
            }

            await transaction.user.update({
              where: {
                id:
                  req.user!.id,
              },

              data: {
                studentVerificationStatus:
                  StudentVerificationStatus.pending,
              },
            });

            await transaction.vendorProfile.updateMany(
              {
                where: {
                  userId:
                    req.user!.id,

                  accessStatus:
                    VendorAccessStatus.active,
                },

                data: {
                  accessStatus:
                    VendorAccessStatus.pending_review,
                },
              }
            );

            return transaction.verificationAppeal.findUnique({
              where: {
                id:
                  appeal.id,
              },

              select: {
                id: true,

                status: true,

                reason: true,

                submittedUniversityName:
                  true,

                decisionReason:
                  true,

                submittedAt:
                  true,

                evidence: {
                  select: {
                    id: true,

                    type: true,

                    originalFileName:
                      true,

                    mimeType:
                      true,

                    fileSizeBytes:
                      true,

                    createdAt:
                      true,
                  },
                },
              },
            });
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Your verification appeal has been submitted. Reviews may take up to 5 working days.",

          appeal:
            result,
        });
    } catch (error) {
      if (
        error instanceof
          Error &&
        error.message ===
          "APPEAL_SUBMISSION_CONFLICT"
      ) {
        return res
          .status(409)
          .json({
            success: false,

            code:
              "APPEAL_SUBMISSION_CONFLICT",

            message:
              "This verification appeal has already been submitted or changed. Refresh your account and try again.",
          });
      }

      console.error(
        "Submit verification appeal error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Unable to submit your verification appeal.",
        });
    }
  };

export const getMyVerificationAppeals =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Authentication required.",
          });
      }

      const appeals =
        await prisma.verificationAppeal.findMany(
          {
            where: {
              userId:
                req.user.id,
            },

            orderBy: {
              createdAt:
                "desc",
            },

            select: {
              id: true,

              reason: true,

              explanation:
                true,

              status: true,

              submittedName:
                true,

              submittedMatricNumber:
                true,

              submittedUniversityName:
                true,

              submittedState:
                true,

              submittedCity:
                true,

              decisionReason:
                true,

              createdAt:
                true,

              submittedAt:
                true,

              reviewedAt:
                true,

              updatedAt:
                true,

              evidence: {
                select: {
                  id: true,
                  type: true,

                  originalFileName:
                    true,

                  mimeType:
                    true,

                  fileSizeBytes:
                    true,

                  createdAt:
                    true,
                },
              },
            },
          }
        );

      return res
        .status(200)
        .json({
          success: true,
          appeals,
        });
    } catch (error) {
      console.error(
        "Get verification appeals error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Unable to load your verification appeals.",
        });
    }
  };

export const getCurrentVerificationAppeal =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Authentication required.",
          });
      }

      const appeal =
        await prisma.verificationAppeal.findFirst(
          {
            where: {
              userId:
                req.user.id,

              status: {
                in:
                  ACTIVE_APPEAL_STATUSES,
              },
            },

            orderBy: {
              createdAt:
                "desc",
            },

            select: {
              id: true,

              reason: true,

              explanation:
                true,

              status: true,

              submittedName:
                true,

              submittedMatricNumber:
                true,

              submittedUniversityName:
                true,

              submittedState:
                true,

              submittedCity:
                true,

              /*
               * This is the reviewer message
               * shown to the student when
               * more information is required.
               */
              decisionReason:
                true,

              createdAt:
                true,

              submittedAt:
                true,

              reviewedAt:
                true,

              updatedAt:
                true,

              evidence: {
                select: {
                  id: true,
                  type: true,

                  originalFileName:
                    true,

                  mimeType:
                    true,

                  fileSizeBytes:
                    true,

                  createdAt:
                    true,
                },
              },
            },
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          appeal,
        });
    } catch (error) {
      console.error(
        "Get current verification appeal error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Unable to load your verification status.",
        });
    }
  };