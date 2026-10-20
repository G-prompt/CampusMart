import {
  Response,
} from "express";

import type {
  AuthenticatedAdminRequest,
} from "../middleware/adminAuth.middleware";

import {
  StudentVerificationSource,
  StudentVerificationStatus,
  VendorAccessStatus,
  VerificationAppealStatus,
  VerificationEvidenceType,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

const PRIMARY_EVIDENCE_TYPES =
  new Set<VerificationEvidenceType>([
    VerificationEvidenceType.student_id,
    VerificationEvidenceType.student_portal,
    VerificationEvidenceType.admission_record,
  ]);

function cleanDecisionReason(
  value: unknown
): string {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
}

export const startVerificationAppealReview =
  async (
    req: AuthenticatedAdminRequest,
    res: Response
  ) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,

          message:
            "Admin authentication required.",
        });
      }

      const appealId =
        String(
          req.params.appealId ||
            ""
        ).trim();

      if (!appealId) {
        return res.status(400).json({
          success: false,

          code:
            "APPEAL_ID_REQUIRED",

          message:
            "Verification appeal ID is required.",
        });
      }

      const currentAppeal =
        await prisma.verificationAppeal.findUnique({
          where: {
            id:
              appealId,
          },

          select: {
            id: true,

            status: true,

            reviewedByAdminId:
              true,

            reviewedByAdmin: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        });

      if (!currentAppeal) {
        return res.status(404).json({
          success: false,

          code:
            "VERIFICATION_APPEAL_NOT_FOUND",

          message:
            "Verification appeal not found.",
        });
      }

      if (
        currentAppeal.status ===
          VerificationAppealStatus.under_review &&
        currentAppeal.reviewedByAdminId ===
          req.admin.id
      ) {
        return res.status(200).json({
          success: true,

          message:
            "This verification appeal is already under your review.",

          appeal: {
            id:
              currentAppeal.id,

            status:
              currentAppeal.status,

            reviewedBy:
              currentAppeal.reviewedByAdmin,
          },
        });
      }

      if (
        currentAppeal.status ===
          VerificationAppealStatus.under_review &&
        currentAppeal.reviewedByAdminId &&
        currentAppeal.reviewedByAdminId !==
          req.admin.id
      ) {
        return res.status(409).json({
          success: false,

          code:
            "APPEAL_ALREADY_UNDER_REVIEW",

          message:
            "This verification appeal is already being reviewed by another Admin.",
        });
      }

      if (
        currentAppeal.status !==
        VerificationAppealStatus.pending
      ) {
        return res.status(409).json({
          success: false,

          code:
            "APPEAL_NOT_READY_FOR_REVIEW",

          message:
            "This verification appeal is not currently waiting to be reviewed.",
        });
      }

      const claimed = await prisma.$transaction(async (tx) => {
        const result = await tx.verificationAppeal.updateMany({
          where: {
            id:
              appealId,

            status:
              VerificationAppealStatus.pending,

            reviewedByAdminId:
              null,
          },

          data: {
            status:
              VerificationAppealStatus.under_review,

            reviewedByAdminId:
              req.admin!.id,
          },
        });
        if (result.count === 1) {
          await tx.adminAuditLog.create({data:{ actorAdminId: req.admin!.id,
            action: "verification.review_started", targetType: "verification_appeal", targetId: appealId,
            beforeState: JSON.stringify({status:"pending"}), afterState: JSON.stringify({status:"under_review"})
          }});
        }
        return result;
      });

      if (
        claimed.count !==
        1
      ) {
        return res.status(409).json({
          success: false,

          code:
            "APPEAL_REVIEW_CLAIM_CONFLICT",

          message:
            "Another Admin may have started reviewing this appeal. Refresh the verification queue.",
        });
      }

      const appeal =
        await prisma.verificationAppeal.findUnique({
          where: {
            id:
              appealId,
          },

          select: {
            id: true,

            reason: true,

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

            submittedAt:
              true,

            updatedAt:
              true,

            reviewedByAdmin: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },

            _count: {
              select: {
                evidence:
                  true,
              },
            },
          },
        });

      return res.status(200).json({
        success: true,

        message:
          "Verification review started.",

        appeal: appeal
          ? {
              id:
                appeal.id,

              reason:
                appeal.reason,

              status:
                appeal.status,

              submittedName:
                appeal.submittedName,

              submittedMatricNumber:
                appeal.submittedMatricNumber,

              submittedUniversityName:
                appeal.submittedUniversityName,

              submittedState:
                appeal.submittedState,

              submittedCity:
                appeal.submittedCity,

              submittedAt:
                appeal.submittedAt,

              updatedAt:
                appeal.updatedAt,

              evidenceCount:
                appeal._count
                  .evidence,

              reviewedBy:
                appeal.reviewedByAdmin,
            }
          : null,
      });
    } catch (error) {
      console.error(
        "Start verification appeal review error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to start the verification review.",
      });
    }
  };

export const requestMoreVerificationInformation =
  async (
    req: AuthenticatedAdminRequest,
    res: Response
  ) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,

          message:
            "Admin authentication required.",
        });
      }

      const appealId =
        String(
          req.params.appealId ||
            ""
        ).trim();

      if (!appealId) {
        return res.status(400).json({
          success: false,

          code:
            "APPEAL_ID_REQUIRED",

          message:
            "Verification appeal ID is required.",
        });
      }

      const decisionReason =
        cleanDecisionReason(
          req.body.decisionReason
        );

      if (
        decisionReason.length <
        10
      ) {
        return res.status(400).json({
          success: false,

          code:
            "MORE_INFORMATION_REASON_REQUIRED",

          message:
            "Explain what additional information or evidence the student needs to provide.",
        });
      }

      if (
        decisionReason.length >
        1000
      ) {
        return res.status(400).json({
          success: false,

          code:
            "DECISION_REASON_TOO_LONG",

          message:
            "The review message must be 1000 characters or fewer.",
        });
      }

      const currentAppeal =
        await prisma.verificationAppeal.findUnique({
          where: {
            id:
              appealId,
          },

          select: {
            id: true,

            status: true,

            reviewedByAdminId:
              true,

            submittedName:
              true,

            submittedUniversityName:
              true,
          },
        });

      if (!currentAppeal) {
        return res.status(404).json({
          success: false,

          code:
            "VERIFICATION_APPEAL_NOT_FOUND",

          message:
            "Verification appeal not found.",
        });
      }

      if (
        currentAppeal.status ===
          VerificationAppealStatus.under_review &&
        currentAppeal.reviewedByAdminId !==
          req.admin.id
      ) {
        return res.status(409).json({
          success: false,

          code:
            "APPEAL_REVIEWER_MISMATCH",

          message:
            "This verification appeal is being handled by another Admin.",
        });
      }

      if (
        currentAppeal.status !==
        VerificationAppealStatus.under_review
      ) {
        return res.status(409).json({
          success: false,

          code:
            "APPEAL_NOT_UNDER_REVIEW",

          message:
            "More information can only be requested while an appeal is under review.",
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.verificationAppeal.updateMany({
          where: {
            id:
              appealId,

            status:
              VerificationAppealStatus.under_review,

            reviewedByAdminId:
              req.admin!.id,
          },

          data: {
            status:
              VerificationAppealStatus.more_information_required,

            decisionReason,
          },
        });
        if (result.count === 1) {
          await tx.adminAuditLog.create({data:{ actorAdminId: req.admin!.id,
            action: "verification.information_requested", targetType: "verification_appeal", targetId: appealId,
            reason: decisionReason, beforeState: JSON.stringify({status:"under_review"}),
            afterState: JSON.stringify({status:"more_information_required"})
          }});
        }
        return result;
      });

      if (
        updated.count !==
        1
      ) {
        return res.status(409).json({
          success: false,

          code:
            "APPEAL_REVIEW_UPDATE_CONFLICT",

          message:
            "The verification appeal changed while you were reviewing it. Refresh the case and try again.",
        });
      }

      const appeal =
        await prisma.verificationAppeal.findUnique({
          where: {
            id:
              appealId,
          },

          select: {
            id: true,

            status: true,

            decisionReason:
              true,

            submittedName:
              true,

            submittedUniversityName:
              true,

            submittedAt:
              true,

            updatedAt:
              true,

            reviewedAt:
              true,

            reviewedByAdmin: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        });

      return res.status(200).json({
        success: true,

        message:
          "The student has been asked to provide more information.",

        appeal,
      });
    } catch (error) {
      console.error(
        "Request more verification information error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to request more verification information.",
      });
    }
  };

export const approveVerificationAppeal =
  async (
    req: AuthenticatedAdminRequest,
    res: Response
  ) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,

          message:
            "Admin authentication required.",
        });
      }

      const appealId =
        String(
          req.params.appealId ||
            ""
        ).trim();

      if (!appealId) {
        return res.status(400).json({
          success: false,

          code:
            "APPEAL_ID_REQUIRED",

          message:
            "Verification appeal ID is required.",
        });
      }

      const decisionReason =
        cleanDecisionReason(
          req.body?.decisionReason
        );

      if (
        decisionReason.length >
        1000
      ) {
        return res.status(400).json({
          success: false,

          code:
            "DECISION_REASON_TOO_LONG",

          message:
            "The review note must be 1000 characters or fewer.",
        });
      }

      const currentAppeal =
        await prisma.verificationAppeal.findUnique({
          where: {
            id:
              appealId,
          },

          select: {
            id: true,

            userId:
              true,

            status:
              true,

            reviewedByAdminId:
              true,

            evidence: {
              select: {
                id: true,
                type: true,
              },
            },

            user: {
              select: {
                id: true,

                studentVerificationStatus:
                  true,

                vendorProfile: {
                  select: {
                    accessStatus:
                      true,
                  },
                },
              },
            },
          },
        });

      if (!currentAppeal) {
        return res.status(404).json({
          success: false,

          code:
            "VERIFICATION_APPEAL_NOT_FOUND",

          message:
            "Verification appeal not found.",
        });
      }

      if (
        currentAppeal.status ===
          VerificationAppealStatus.approved &&
        currentAppeal.user
          .studentVerificationStatus ===
          StudentVerificationStatus.verified
      ) {
        return res.status(200).json({
          success: true,

          message:
            "This student identity has already been verified.",

          appeal: {
            id:
              currentAppeal.id,

            status:
              currentAppeal.status,
          },
        });
      }

      if (
        currentAppeal.status ===
          VerificationAppealStatus.under_review &&
        currentAppeal.reviewedByAdminId !==
          req.admin.id
      ) {
        return res.status(409).json({
          success: false,

          code:
            "APPEAL_REVIEWER_MISMATCH",

          message:
            "This verification appeal is being handled by another Admin.",
        });
      }

      if (
        currentAppeal.status !==
        VerificationAppealStatus.under_review
      ) {
        return res.status(409).json({
          success: false,

          code:
            "APPEAL_NOT_UNDER_REVIEW",

          message:
            "Only an appeal currently under review can be approved.",
        });
      }

      if (
        currentAppeal.evidence.length <
        2
      ) {
        return res.status(409).json({
          success: false,

          code:
            "INSUFFICIENT_VERIFICATION_EVIDENCE",

          message:
            "This appeal does not contain enough evidence to approve.",
        });
      }

      const evidenceTypes =
        new Set(
          currentAppeal.evidence.map(
            (item) =>
              item.type
          )
        );

      if (
        evidenceTypes.size <
        2
      ) {
        return res.status(409).json({
          success: false,

          code:
            "INSUFFICIENT_EVIDENCE_TYPES",

          message:
            "This appeal requires at least two different evidence types before approval.",
        });
      }

      const hasPrimaryEvidence =
        currentAppeal.evidence.some(
          (item) =>
            PRIMARY_EVIDENCE_TYPES.has(
              item.type
            )
        );

      if (
        !hasPrimaryEvidence
      ) {
        return res.status(409).json({
          success: false,

          code:
            "PRIMARY_EVIDENCE_REQUIRED",

          message:
            "This appeal requires a student ID, student portal record, or admission/student record before approval.",
        });
      }

      const reviewedAt =
        new Date();

      const result =
        await prisma.$transaction(
          async (
            transaction
          ) => {
            const approved =
              await transaction.verificationAppeal.updateMany({
                where: {
                  id:
                    currentAppeal.id,

                  userId:
                    currentAppeal.userId,

                  status:
                    VerificationAppealStatus.under_review,

                  reviewedByAdminId:
                    req.admin!.id,
                },

                data: {
                  status:
                    VerificationAppealStatus.approved,

                  reviewedAt,

                  decisionReason:
                    decisionReason ||
                    null,
                },
              });

            if (
              approved.count !==
              1
            ) {
              throw new Error(
                "APPEAL_APPROVAL_CONFLICT"
              );
            }

            await transaction.user.update({
              where: {
                id:
                  currentAppeal.userId,
              },

              data: {
                studentVerificationStatus:
                  StudentVerificationStatus.verified,

                studentVerificationSource:
                  StudentVerificationSource.manual_document_review,

                studentVerifiedAt:
                  reviewedAt,
              },
            });

            await transaction.vendorProfile.updateMany({
              where: {
                userId:
                  currentAppeal.userId,

                accessStatus:
                  VendorAccessStatus.pending_review,
              },

              data: {
                accessStatus:
                  VendorAccessStatus.active,
              },
            });

            await transaction.adminAuditLog.create({
              data: {
                actorAdminId: req.admin!.id,
                action: "verification.approved",
                targetType: "verification_appeal",
                targetId: currentAppeal.id,
                reason: decisionReason || null,
                beforeState: JSON.stringify({ status: currentAppeal.status, userId: currentAppeal.userId }),
                afterState: JSON.stringify({ status: "approved", userId: currentAppeal.userId }),
              },
            });

            return transaction.verificationAppeal.findUnique({
              where: {
                id:
                  currentAppeal.id,
              },

              select: {
                id: true,

                status: true,

                decisionReason:
                  true,

                submittedName:
                  true,

                submittedMatricNumber:
                  true,

                submittedUniversityName:
                  true,

                submittedAt:
                  true,

                reviewedAt:
                  true,

                reviewedByAdmin: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                  },
                },

                user: {
                  select: {
                    id: true,

                    name: true,

                    role: true,

                    studentVerificationStatus:
                      true,

                    studentVerificationSource:
                      true,

                    studentVerifiedAt:
                      true,

                    vendorProfile: {
                      select: {
                        accessStatus:
                          true,

                        vendorVerificationStatus:
                          true,
                      },
                    },
                  },
                },

                _count: {
                  select: {
                    evidence:
                      true,
                  },
                },
              },
            });
          }
        );

      return res.status(200).json({
        success: true,

        message:
          "Student identity verified successfully.",

        appeal:
          result,
      });
    } catch (error) {
      if (
        error instanceof
          Error &&
        error.message ===
          "APPEAL_APPROVAL_CONFLICT"
      ) {
        return res.status(409).json({
          success: false,

          code:
            "APPEAL_APPROVAL_CONFLICT",

          message:
            "This verification appeal changed before the approval could be completed. Refresh the case and try again.",
        });
      }

      console.error(
        "Approve verification appeal error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to approve this verification appeal.",
      });
    }
  };

export const rejectVerificationAppeal =
  async (
    req: AuthenticatedAdminRequest,
    res: Response
  ) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,

          message:
            "Admin authentication required.",
        });
      }

      const appealId =
        String(
          req.params.appealId ||
            ""
        ).trim();

      if (!appealId) {
        return res.status(400).json({
          success: false,

          code:
            "APPEAL_ID_REQUIRED",

          message:
            "Verification appeal ID is required.",
        });
      }

      const decisionReason =
        cleanDecisionReason(
          req.body?.decisionReason
        );

      /*
       * Unlike approval, a rejection
       * must always explain why.
       *
       * This message may be shown to the
       * student and should be actionable.
       */
      if (
        decisionReason.length <
        10
      ) {
        return res.status(400).json({
          success: false,

          code:
            "REJECTION_REASON_REQUIRED",

          message:
            "Explain why this student verification appeal is being rejected.",
        });
      }

      if (
        decisionReason.length >
        1000
      ) {
        return res.status(400).json({
          success: false,

          code:
            "DECISION_REASON_TOO_LONG",

          message:
            "The rejection reason must be 1000 characters or fewer.",
        });
      }

      const currentAppeal =
        await prisma.verificationAppeal.findUnique({
          where: {
            id:
              appealId,
          },

          select: {
            id: true,

            userId:
              true,

            status:
              true,

            reviewedByAdminId:
              true,

            user: {
              select: {
                id: true,

                studentVerificationStatus:
                  true,

                vendorProfile: {
                  select: {
                    accessStatus:
                      true,
                  },
                },
              },
            },
          },
        });

      if (!currentAppeal) {
        return res.status(404).json({
          success: false,

          code:
            "VERIFICATION_APPEAL_NOT_FOUND",

          message:
            "Verification appeal not found.",
        });
      }

      /*
       * Browser retries after a completed
       * rejection are harmless.
       */
      if (
        currentAppeal.status ===
          VerificationAppealStatus.rejected &&
        currentAppeal.user
          .studentVerificationStatus ===
          StudentVerificationStatus.failed
      ) {
        return res.status(200).json({
          success: true,

          message:
            "This verification appeal has already been rejected.",

          appeal: {
            id:
              currentAppeal.id,

            status:
              currentAppeal.status,
          },
        });
      }

      /*
       * Only the Admin who owns the case
       * may make the final rejection.
       */
      if (
        currentAppeal.status ===
          VerificationAppealStatus.under_review &&
        currentAppeal.reviewedByAdminId !==
          req.admin.id
      ) {
        return res.status(409).json({
          success: false,

          code:
            "APPEAL_REVIEWER_MISMATCH",

          message:
            "This verification appeal is being handled by another Admin.",
        });
      }

      if (
        currentAppeal.status !==
        VerificationAppealStatus.under_review
      ) {
        return res.status(409).json({
          success: false,

          code:
            "APPEAL_NOT_UNDER_REVIEW",

          message:
            "Only an appeal currently under review can be rejected.",
        });
      }

      const reviewedAt =
        new Date();

      const result =
        await prisma.$transaction(
          async (
            transaction
          ) => {
            const rejected =
              await transaction.verificationAppeal.updateMany({
                where: {
                  id:
                    currentAppeal.id,

                  userId:
                    currentAppeal.userId,

                  status:
                    VerificationAppealStatus.under_review,

                  reviewedByAdminId:
                    req.admin!.id,
                },

                data: {
                  status:
                    VerificationAppealStatus.rejected,

                  reviewedAt,

                  decisionReason,
                },
              });

            if (
              rejected.count !==
              1
            ) {
              throw new Error(
                "APPEAL_REJECTION_CONFLICT"
              );
            }

            /*
             * Rejection means this review
             * did not establish student
             * identity.
             *
             * It does not permanently ban
             * the user from trying again
             * later with a new appeal.
             */
            await transaction.user.update({
              where: {
                id:
                  currentAppeal.userId,
              },

              data: {
                studentVerificationStatus:
                  StudentVerificationStatus.failed,

                studentVerificationSource:
                  StudentVerificationSource.none,

                studentVerifiedAt:
                  null,
              },
            });

            /*
             * Seller access must not be
             * activated after a failed
             * student verification.
             *
             * pending_review, restricted
             * and suspended states remain
             * untouched.
             */
            await transaction.adminAuditLog.create({
              data: {
                actorAdminId: req.admin!.id,
                action: "verification.rejected",
                targetType: "verification_appeal",
                targetId: currentAppeal.id,
                reason: decisionReason || null,
                beforeState: JSON.stringify({ status: currentAppeal.status, userId: currentAppeal.userId }),
                afterState: JSON.stringify({ status: "rejected", userId: currentAppeal.userId }),
              },
            });

            return transaction.verificationAppeal.findUnique({
              where: {
                id:
                  currentAppeal.id,
              },

              select: {
                id: true,

                status: true,

                decisionReason:
                  true,

                submittedName:
                  true,

                submittedMatricNumber:
                  true,

                submittedUniversityName:
                  true,

                submittedAt:
                  true,

                reviewedAt:
                  true,

                reviewedByAdmin: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                  },
                },

                user: {
                  select: {
                    id: true,

                    name: true,

                    role: true,

                    studentVerificationStatus:
                      true,

                    studentVerificationSource:
                      true,

                    studentVerifiedAt:
                      true,

                    vendorProfile: {
                      select: {
                        accessStatus:
                          true,

                        vendorVerificationStatus:
                          true,
                      },
                    },
                  },
                },

                _count: {
                  select: {
                    evidence:
                      true,
                  },
                },
              },
            });
          }
        );

      return res.status(200).json({
        success: true,

        message:
          "Student verification appeal rejected.",

        appeal:
          result,
      });
    } catch (error) {
      if (
        error instanceof
          Error &&
        error.message ===
          "APPEAL_REJECTION_CONFLICT"
      ) {
        return res.status(409).json({
          success: false,

          code:
            "APPEAL_REJECTION_CONFLICT",

          message:
            "This verification appeal changed before the rejection could be completed. Refresh the case and try again.",
        });
      }

      console.error(
        "Reject verification appeal error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to reject this verification appeal.",
      });
    }
  };
