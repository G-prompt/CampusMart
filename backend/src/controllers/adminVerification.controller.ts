import {
  Response,
} from "express";

import type {
  AuthenticatedAdminRequest,
} from "../middleware/adminAuth.middleware";

import {
  VerificationAppealStatus,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

import {
  supabaseAdmin,
  VERIFICATION_EVIDENCE_BUCKET,
} from "../lib/supabaseAdmin";

const REVIEWABLE_STATUSES: VerificationAppealStatus[] = [
  VerificationAppealStatus.pending,
  VerificationAppealStatus.under_review,
  VerificationAppealStatus.more_information_required,
];

export const getVerificationAppealQueue =
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

      const appeals =
        await prisma.verificationAppeal.findMany({
          where: {
            status: {
              in:
                REVIEWABLE_STATUSES,
            },
          },

          orderBy: [
            {
              submittedAt:
                "asc",
            },

            {
              createdAt:
                "asc",
            },
          ],

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

            createdAt:
              true,

            submittedAt:
              true,

            reviewedAt:
              true,

            decisionReason:
              true,

            university: {
              select: {
                id: true,
                name: true,
                shortName: true,
              },
            },

            user: {
              select: {
                id: true,

                studentVerificationStatus:
                  true,

                studentVerificationSource:
                  true,
              },
            },

            reviewedByAdmin: {
              select: {
                id: true,
                name: true,
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

        count:
          appeals.length,

        appeals:
          appeals.map(
            (appeal) => ({
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

              createdAt:
                appeal.createdAt,

              submittedAt:
                appeal.submittedAt,

              reviewedAt:
                appeal.reviewedAt,

              decisionReason:
                appeal.decisionReason,

              evidenceCount:
                appeal._count
                  .evidence,

              university:
                appeal.university,

              studentVerificationStatus:
                appeal.user
                  .studentVerificationStatus,

              studentVerificationSource:
                appeal.user
                  .studentVerificationSource,

              reviewedBy:
                appeal.reviewedByAdmin,
            })
          ),
      });
    } catch (error) {
      console.error(
        "Get Admin verification queue error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to load the verification queue.",
      });
    }
  };

export const getVerificationAppealById =
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

      const appeal =
        await prisma.verificationAppeal.findUnique({
          where: {
            id:
              appealId,
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

            university: {
              select: {
                id: true,
                name: true,
                shortName: true,
                state: true,
                city: true,
              },
            },

            user: {
              select: {
                id: true,
                name: true,
                email: true,

                studentVerificationStatus:
                  true,

                studentVerificationSource:
                  true,

                studentVerifiedAt:
                  true,

                role: true,
              },
            },

            reviewedByAdmin: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },

            evidence: {
              orderBy: {
                createdAt:
                  "asc",
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
            },
          },
        });

      if (!appeal) {
        return res.status(404).json({
          success: false,

          code:
            "VERIFICATION_APPEAL_NOT_FOUND",

          message:
            "Verification appeal not found.",
        });
      }

      return res.status(200).json({
        success: true,
        appeal,
      });
    } catch (error) {
      console.error(
        "Get Admin verification appeal error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to load the verification appeal.",
      });
    }
  };

export const getVerificationEvidenceAccess =
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

      const evidenceId =
        String(
          req.params.evidenceId ||
            ""
        ).trim();

      if (
        !appealId ||
        !evidenceId
      ) {
        return res.status(400).json({
          success: false,

          code:
            "EVIDENCE_DETAILS_REQUIRED",

          message:
            "Appeal and evidence IDs are required.",
        });
      }

      /*
       * Evidence must belong to the exact
       * appeal supplied in the request.
       */
      const evidence =
        await prisma.verificationAppealEvidence.findFirst({
          where: {
            id:
              evidenceId,

            appealId,
          },

          select: {
            id: true,

            appealId:
              true,

            type: true,

            storageKey:
              true,

            originalFileName:
              true,

            mimeType:
              true,

            fileSizeBytes:
              true,

            createdAt:
              true,

            appeal: {
              select: {
                status:
                  true,
              },
            },
          },
        });

      if (!evidence) {
        return res.status(404).json({
          success: false,

          code:
            "VERIFICATION_EVIDENCE_NOT_FOUND",

          message:
            "Verification evidence not found.",
        });
      }

      /*
       * Do not allow access to abandoned
       * drafts or cancelled appeals from
       * the Admin verification queue.
       */
      if (
        !REVIEWABLE_STATUSES.includes(
          evidence.appeal.status
        )
      ) {
        return res.status(409).json({
          success: false,

          code:
            "EVIDENCE_NOT_REVIEWABLE",

          message:
            "This verification evidence is not currently available for review.",
        });
      }

      const expiresIn =
        60;

      const {
        data,
        error,
      } =
        await supabaseAdmin.storage
          .from(
            VERIFICATION_EVIDENCE_BUCKET
          )
          .createSignedUrl(
            evidence.storageKey,
            expiresIn
          );

      if (
        error ||
        !data?.signedUrl
      ) {
        console.error(
          "Create verification evidence signed URL failed:",
          error
        );

        return res.status(500).json({
          success: false,

          message:
            "Unable to open this verification document.",
        });
      }

      // Audit evidence access without ever storing the signed URL or file contents.
      await prisma.adminAuditLog.create({ data: {
        actorAdminId: req.admin!.id,
        action: "verification.evidence_accessed",
        targetType: "verification_appeal",
        targetId: appealId,
        afterState: JSON.stringify({ evidenceId, evidenceType: evidence.type }),
      } });

      /*
       * Prevent browsers/proxies from
       * caching this sensitive response.
       */
      res.setHeader(
        "Cache-Control",
        "no-store, private"
      );

      res.setHeader(
        "Pragma",
        "no-cache"
      );

      return res.status(200).json({
        success: true,

        evidence: {
          id:
            evidence.id,

          type:
            evidence.type,

          originalFileName:
            evidence.originalFileName,

          mimeType:
            evidence.mimeType,

          fileSizeBytes:
            evidence.fileSizeBytes,

          createdAt:
            evidence.createdAt,
        },

        access: {
          signedUrl:
            data.signedUrl,

          expiresInSeconds:
            expiresIn,
        },
      });
    } catch (error) {
      console.error(
        "Get verification evidence access error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to open verification evidence.",
      });
    }
  };