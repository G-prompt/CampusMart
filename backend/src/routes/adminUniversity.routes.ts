import {
  Router,
} from "express";

import {
  createUniversity,
  getAdminUniversities,
  getAdminUniversityById,
  setUniversityActiveState,
  updateUniversity,
} from "../controllers/university.controller";

import {
  getActiveUniversityRoster,
  getUniversityRosterImportById,
  getUniversityRosterImports,
  importUniversityRoster,
  previewUniversityRoster,
} from "../controllers/universityRoster.controller";

import {
  requireAdmin,
  requireAdminRole,
} from "../middleware/adminAuth.middleware";

import {
  universityRosterUpload,
} from "../middleware/universityRosterUpload.middleware";

import {
  AdminRole,
} from "../generated/prisma/client";

const router =
  Router();

/*
 * =======================================================
 * CAMPUSMART ADMIN UNIVERSITY ROUTES
 * =======================================================
 *
 * All university-management routes require:
 *
 * 1. authenticated Admin
 * 2. university_manager permission
 *
 * Super Admin bypass behaviour is already handled by
 * requireAdminRole.
 *
 * Roster access remains inside the University Admin
 * permission boundary because university roster data is
 * sensitive student identity information.
 */

/*
 * =======================================================
 * UNIVERSITY DIRECTORY
 * =======================================================
 */

/*
 * GET
 *
 * /api/admin/universities
 */
router.get(
  "/",
  requireAdmin,
  requireAdminRole(
    AdminRole.university_manager
  ),
  getAdminUniversities
);

/*
 * POST
 *
 * /api/admin/universities
 */
router.post(
  "/",
  requireAdmin,
  requireAdminRole(
    AdminRole.university_manager
  ),
  createUniversity
);

/*
 * =======================================================
 * UNIVERSITY ROSTER IMPORT
 * =======================================================
 *
 * IMPORTANT:
 *
 * Static roster paths such as:
 *
 * /rosters/active
 *
 * are declared before:
 *
 * /rosters/:rosterImportId
 *
 * so Express never interprets "active" as a roster ID.
 */

/*
 * POST
 *
 * /api/admin/universities/:universityId/rosters/preview
 *
 * multipart/form-data:
 *
 * file = university-roster.csv
 *
 * No database writes happen here.
 */
router.post(
  "/:universityId/rosters/preview",
  requireAdmin,
  requireAdminRole(
    AdminRole.university_manager
  ),
  universityRosterUpload,
  previewUniversityRoster
);

/*
 * POST
 *
 * /api/admin/universities/:universityId/rosters
 *
 * multipart/form-data:
 *
 * file
 * academicSession
 * sourceIssuer
 * sourceReference optional
 * validFrom optional
 * expiresAt optional
 *
 * A successful import:
 *
 * - validates the entire CSV
 * - inserts roster records transactionally
 * - archives an older active roster
 * - activates the new roster
 *
 * It does NOT automatically enable roster verification
 * for the university.
 */
router.post(
  "/:universityId/rosters",
  requireAdmin,
  requireAdminRole(
    AdminRole.university_manager
  ),
  universityRosterUpload,
  importUniversityRoster
);

/*
 * GET
 *
 * /api/admin/universities/:universityId/rosters
 *
 * Returns import history and metadata.
 *
 * Individual student roster records are not returned.
 */
router.get(
  "/:universityId/rosters",
  requireAdmin,
  requireAdminRole(
    AdminRole.university_manager
  ),
  getUniversityRosterImports
);

/*
 * GET
 *
 * /api/admin/universities/:universityId/rosters/active
 *
 * Returns the university's currently-active imported
 * roster, if one exists.
 */
router.get(
  "/:universityId/rosters/active",
  requireAdmin,
  requireAdminRole(
    AdminRole.university_manager
  ),
  getActiveUniversityRoster
);

/*
 * GET
 *
 * /api/admin/universities/:universityId/rosters/:rosterImportId
 *
 * Returns metadata for one roster import.
 *
 * Student records remain private.
 */
router.get(
  "/:universityId/rosters/:rosterImportId",
  requireAdmin,
  requireAdminRole(
    AdminRole.university_manager
  ),
  getUniversityRosterImportById
);

/*
 * =======================================================
 * UNIVERSITY DETAIL
 * =======================================================
 */

/*
 * GET
 *
 * /api/admin/universities/:universityId
 */
router.get(
  "/:universityId",
  requireAdmin,
  requireAdminRole(
    AdminRole.university_manager
  ),
  getAdminUniversityById
);

/*
 * PATCH
 *
 * /api/admin/universities/:universityId
 */
router.patch(
  "/:universityId",
  requireAdmin,
  requireAdminRole(
    AdminRole.university_manager
  ),
  updateUniversity
);

/*
 * PATCH
 *
 * /api/admin/universities/:universityId/active
 */
router.patch(
  "/:universityId/active",
  requireAdmin,
  requireAdminRole(
    AdminRole.university_manager
  ),
  setUniversityActiveState
);

export default router;