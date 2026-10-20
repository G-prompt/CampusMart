import {
  Router,
} from "express";

import {
  runAutomaticVerification,
} from "../controllers/automaticVerification.controller";

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

/*
 * =======================================================
 * CAMPUSMART CUSTOMER VERIFICATION ROUTES
 * =======================================================
 *
 * Every route in this router deals with private,
 * account-specific student verification state.
 *
 * All routes therefore require authenticated customer
 * access.
 */

/*
 * =======================================================
 * AUTOMATIC VERIFICATION
 * =======================================================
 *
 * POST
 *
 * /api/verification/automatic
 *
 * No body is required.
 *
 * The authenticated account supplies:
 *
 * - user ID
 * - official account name
 * - university
 * - matric number
 *
 * through existing stored profile data.
 */
router.post(
  "/automatic",
  requireAuth,
  runAutomaticVerification
);

/*
 * =======================================================
 * MANUAL REVIEW / APPEALS
 * =======================================================
 */

/*
 * Create a new verification appeal draft.
 *
 * POST
 *
 * /api/verification/appeals
 */
router.post(
  "/appeals",
  requireAuth,
  createVerificationAppeal
);

/*
 * Get the signed-in user's complete appeal history.
 *
 * GET
 *
 * /api/verification/appeals
 */
router.get(
  "/appeals",
  requireAuth,
  getMyVerificationAppeals
);

/*
 * Compatibility alias retained for existing frontend
 * callers.
 *
 * GET
 *
 * /api/verification/appeals/mine
 */
router.get(
  "/appeals/mine",
  requireAuth,
  getMyVerificationAppeals
);

/*
 * Get the signed-in user's currently-open verification
 * appeal.
 *
 * This route is now explicitly protected with
 * requireAuth as well.
 *
 * GET
 *
 * /api/verification/appeals/current
 */
router.get(
  "/appeals/current",
  requireAuth,
  getCurrentVerificationAppeal
);

/*
 * Upload private evidence to an editable appeal.
 *
 * POST
 *
 * /api/verification/appeals/:appealId/evidence
 */
router.post(
  "/appeals/:appealId/evidence",
  requireAuth,
  verificationEvidenceUpload,
  uploadVerificationEvidence
);

/*
 * Submit or resubmit an appeal for Admin review.
 *
 * POST
 *
 * /api/verification/appeals/:appealId/submit
 */
router.post(
  "/appeals/:appealId/submit",
  requireAuth,
  submitVerificationAppeal
);

export default router;