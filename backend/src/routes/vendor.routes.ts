import {
  Router,
} from "express";

import {
  completeVendorProfile,
  getPublicVendorStorefront,
  getVendorEligibility,
} from "../controllers/vendor.controller";

import {
  requireAuth,
} from "../middleware/auth.middleware";

const router =
  Router();

/*
 * =======================================================
 * PUBLIC SELLER STOREFRONT
 * =======================================================
 *
 * No authentication required.
 *
 * Only active seller storefronts are returned by the
 * controller.
 */

router.get(
  "/storefront/:vendorId",
  getPublicVendorStorefront
);

/*
 * =======================================================
 * SELLER ELIGIBILITY
 * =======================================================
 *
 * Private seller/account endpoint.
 */

router.get(
  "/eligibility",
  requireAuth,
  getVendorEligibility
);

/*
 * =======================================================
 * COMPLETE SELLER PROFILE
 * =======================================================
 *
 * Private seller/account endpoint.
 */

router.post(
  "/profile",
  requireAuth,
  completeVendorProfile
);

export default router;