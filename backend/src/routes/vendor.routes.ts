import { Router } from "express";

import {
  completeVendorProfile,
} from "../controllers/vendor.controller";

import {
  requireAuth,
} from "../middleware/auth.middleware";

const router =
  Router();

router.post(
  "/profile",
  requireAuth,
  completeVendorProfile
);

export default router;