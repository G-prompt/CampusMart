
import {
  Router,
} from "express";

import {
  completeVendorProfile,
  getPublicVendorStorefront,
  getVendorEligibility,
  upgradeBuyerToVendor,
} from "../controllers/vendor.controller";

import {
  createVendorPickupPoint,
  getMyVendorPickupPoints,
  getPublicVendorPickupPoints,
  removeVendorPickupPoint,
  updateVendorPickupPoint,
} from "../controllers/vendorPickupPoint.controller";

import {
  requireAuth,
  requireVendorAccount,
} from "../middleware/auth.middleware";

const router =
  Router();

/*
 * =======================================================
 * BUYER -> SELLER
 * =======================================================
 */

// The existing frontend calls /become-seller.
// /upgrade remains supported for compatibility.
// Both use the same authenticated controller.

router.post(
  ["/upgrade", "/become-seller"],
  requireAuth,
  upgradeBuyerToVendor
);

/*
 * =======================================================
 * SELLER ELIGIBILITY
 * =======================================================
 */

router.get(
  "/eligibility",
  requireAuth,
  getVendorEligibility
);

/*
 * =======================================================
 * SELLER PROFILE
 * =======================================================
 */

router.post(
  "/profile",
  requireAuth,
  completeVendorProfile
);

/*
 * =======================================================
 * PRIVATE PICKUP-POINT MANAGEMENT
 * =======================================================
 */

router.get(
  "/pickup-points",
  requireAuth,
  requireVendorAccount,
  getMyVendorPickupPoints
);

router.post(
  "/pickup-points",
  requireAuth,
  requireVendorAccount,
  createVendorPickupPoint
);

router.patch(
  "/pickup-points/:pickupPointId",
  requireAuth,
  requireVendorAccount,
  updateVendorPickupPoint
);

router.delete(
  "/pickup-points/:pickupPointId",
  requireAuth,
  requireVendorAccount,
  removeVendorPickupPoint
);

/*
 * =======================================================
 * PUBLIC CHECKOUT PICKUP POINTS
 * =======================================================
 */

router.get(
  "/storefront/:vendorId/pickup-points",
  getPublicVendorPickupPoints
);

/*
 * =======================================================
 * PUBLIC STOREFRONT
 * =======================================================
 */

router.get(
  "/storefront/:vendorId",
  getPublicVendorStorefront
);

export default router;
