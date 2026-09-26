import { Router } from "express";

import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  getVendorProducts,
  updateProduct,
} from "../controllers/product.controller";


import {
  requireAuth,
  requireVendor,
} from "../middleware/auth.middleware";

import { productImageUpload } from "../middleware/upload.middleware";

const router = Router();

// Public marketplace routes
router.get("/", getProducts);

// Logged-in vendor's own listings
router.get(
  "/mine",
  requireAuth,
  requireVendor,
  getVendorProducts
);

// Individual public product
router.get("/:id", getProductById);

// Vendor-only routes
router.post(
  "/",
  requireAuth,
  requireVendor,
  productImageUpload.array("images", 5),
  createProduct
);

router.patch(
  "/:id",
  requireAuth,
  requireVendor,
  productImageUpload.array("images", 5),
  updateProduct
);

router.delete(
  "/:id",
  requireAuth,
  requireVendor,
  deleteProduct
);

export default router;