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
  createProductReview,
  getProductReviewEligibility,
  getProductReviews,
} from "../controllers/productReview.controller";

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

router.get(
  "/",
  getProducts
);

router.get(
  "/mine",
  requireAuth,
  requireVendorAccount,
  getVendorProducts
);

router.get(
  "/:id/reviews",
  getProductReviews
);

router.get(
  "/:id/reviews/eligibility",
  requireAuth,
  getProductReviewEligibility
);

router.post(
  "/:id/reviews",
  requireAuth,
  createProductReview
);

router.get(
  "/:id",
  getProductById
);

router.post(
  "/",
  requireAuth,
  requireSellerEligibility,
  productImageUpload.array(
    "images",
    6
  ),
  createProduct
);

router.patch(
  "/:id",
  requireAuth,
  requireSellerEligibility,
  productImageUpload.array(
    "images",
    6
  ),
  updateProduct
);

router.patch(
  "/:id/restore",
  requireAuth,
  requireSellerEligibility,
  restoreProduct
);

router.delete(
  "/:id",
  requireAuth,
  requireVendorAccount,
  deleteProduct
);

export default router;