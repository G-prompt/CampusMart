import {
  Router,
} from "express";

import {
  adminLogin,
  getCurrentAdmin,
} from "../controllers/adminAuth.controller";

import {
  requireAdmin,
} from "../middleware/adminAuth.middleware";

const router =
  Router();

router.post(
  "/login",
  adminLogin
);

router.get(
  "/me",
  requireAdmin,
  getCurrentAdmin
);

export default router;