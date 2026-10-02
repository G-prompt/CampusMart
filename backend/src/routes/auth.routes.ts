import { Router } from "express";

import {
  getMe,
  login,
  register,
  updateStudentDetails,
} from "../controllers/auth.controller";

import {
  requireAuth,
} from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/register",
  register
);

router.post(
  "/login",
  login
);

router.get(
  "/me",
  requireAuth,
  getMe
);

router.patch(
  "/student-details",
  requireAuth,
  updateStudentDetails
);

export default router;