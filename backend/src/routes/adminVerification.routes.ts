import {
  Router,
} from "express";

import {
  getVerificationAppealById,
  getVerificationAppealQueue,
  getVerificationEvidenceAccess,
} from "../controllers/adminVerification.controller";

import {
  approveVerificationAppeal,
  requestMoreVerificationInformation,
  startVerificationAppealReview,
} from "../controllers/adminVerificationActions.controller";

import {
  requireAdmin,
  requireAdminRole,
} from "../middleware/adminAuth.middleware";

import {
  AdminRole,
} from "../generated/prisma/client";

const router =
  Router();

router.get(
  "/appeals",
  requireAdmin,
  requireAdminRole(
    AdminRole.verification_officer
  ),
  getVerificationAppealQueue
);

router.get(
  "/appeals/:appealId",
  requireAdmin,
  requireAdminRole(
    AdminRole.verification_officer
  ),
  getVerificationAppealById
);

router.post(
  "/appeals/:appealId/start-review",
  requireAdmin,
  requireAdminRole(
    AdminRole.verification_officer
  ),
  startVerificationAppealReview
);

router.post(
  "/appeals/:appealId/request-more-information",
  requireAdmin,
  requireAdminRole(
    AdminRole.verification_officer
  ),
  requestMoreVerificationInformation
);

router.post(
  "/appeals/:appealId/approve",
  requireAdmin,
  requireAdminRole(
    AdminRole.verification_officer
  ),
  approveVerificationAppeal
);

router.post(
  "/appeals/:appealId/evidence/:evidenceId/access",
  requireAdmin,
  requireAdminRole(
    AdminRole.verification_officer
  ),
  getVerificationEvidenceAccess
);

export default router;