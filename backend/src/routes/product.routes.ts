import {
  Router,
} from "express";

import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  getVendorProducts,
  restoreProduct,
  updateProduct,
} from "../controllers/product.controller";

import {
  requireAuth,
  requireSellerEligibility,
  requireVendorAccount,
} from "../middleware/auth.middleware";

import {
  productImageUpload,
} from "../middleware/upload.middleware";

const router =
  Router();

/*
 * =======================================================
 * PUBLIC MARKETPLACE
 * =======================================================
 *
 * Archived listings are filtered out by the controller.
 */

router.get(
  "/",
  getProducts
);

/*
 * =======================================================
 * SELLER'S OWN LISTINGS
 * =======================================================
 *
 * Sellers can view both published and archived listings.
 *
 * Active selling eligibility is NOT required simply to
 * access listing history.
 */

router.get(
  "/mine",
  requireAuth,
  requireVendorAccount,
  getVendorProducts
);

/*
 * =======================================================
 * PUBLIC PRODUCT DETAIL
 * =======================================================
 *
 * Archived listings return 404 from the controller.
 */

router.get(
  "/:id",
  getProductById
);

/*
 * =======================================================
 * CREATE LISTING
 * =======================================================
 *
 * Creating new marketplace activity requires full current
 * seller eligibility.
 *
 * Eligibility runs before image upload.
 */

router.post(
  "/",
  requireAuth,
  requireSellerEligibility,
  productImageUpload.array(
    "images",
    5
  ),
  createProduct
);

/*
 * =======================================================
 * EDIT LISTING
 * =======================================================
 *
 * Editing an existing listing is also a seller operation,
 * so full current seller eligibility is required.
 */

router.patch(
  "/:id",
  requireAuth,
  requireSellerEligibility,
  productImageUpload.array(
    "images",
    5
  ),
  updateProduct
);

/*
 * =======================================================
 * RESTORE ARCHIVED LISTING
 * =======================================================
 *
 * Restoring puts a product back into public sale.
 *
 * Therefore the seller must currently satisfy the full
 * seller eligibility policy.
 */

router.patch(
  "/:id/restore",
  requireAuth,
  requireSellerEligibility,
  restoreProduct
);

/*
 * =======================================================
 * ARCHIVE LISTING
 * =======================================================
 *
 * DELETE remains the route for compatibility with the
 * current frontend, but this no longer hard-deletes the
 * database record.
 *
 * A vendor account may archive its own listing even if
 * current seller eligibility has been lost.
 *
 * Taking something OFF sale is risk-reducing and should
 * not require permission to start new selling activity.
 *
 * Ownership is still checked inside deleteProduct.
 */

router.delete(
  "/:id",
  requireAuth,
  requireVendorAccount,
  deleteProduct
);

export default router;