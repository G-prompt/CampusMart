import {
  Router,
} from "express";

import {
  createVerificationAppeal,
  getCurrentVerificationAppeal,
  getMyVerificationAppeals,
  submitVerificationAppeal,
  uploadVerificationEvidence,
} from "../controllers/verification.controller";

import {
  requireAuth,
} from "../middleware/auth.middleware";

import {
  verificationEvidenceUpload,
} from "../middleware/verificationEvidenceUpload.middleware";

const router =
  Router();

router.post(
  "/appeals",
  requireAuth,
  createVerificationAppeal
);

router.post(
  "/appeals/:appealId/evidence",
  requireAuth,
  verificationEvidenceUpload,
  uploadVerificationEvidence
);

router.post(
  "/appeals/:appealId/submit",
  requireAuth,
  submitVerificationAppeal
);

router.get(
  "/appeals/mine",
  requireAuth,
  getMyVerificationAppeals
);

router.get(
  "/appeals/current",
  requireAuth,
  getCurrentVerificationAppeal
);

export default router;