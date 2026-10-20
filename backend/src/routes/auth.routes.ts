import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";

import {
  getMe,
  login,
  register,
  updateStudentDetails,
} from "../controllers/auth.controller";

import {
  updateAccountProfile,
} from "../controllers/accountProfile.controller";

import {
  changeAccountPassword,
} from "../controllers/password.controller";

import {
  requireAuth,
} from "../middleware/auth.middleware";

const router = Router();

/*
 * =======================================================
 * REGISTRATION PHONE REQUIREMENT
 * =======================================================
 */

const requireRegistrationPhone = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const phone = req.body?.phone;

  if (
    typeof phone !== "string" ||
    phone.trim().length === 0
  ) {
    res.status(400).json({
      success: false,
      code: "PHONE_REQUIRED",
      message:
        "Phone number is required to create a CampusMart account.",
    });

    return;
  }

  next();
};

/*
 * PUBLIC AUTHENTICATION
 */

router.post(
  "/register",
  requireRegistrationPhone,
  register
);

router.post(
  "/login",
  login
);

/*
 * CURRENT USER
 */

router.get(
  "/me",
  requireAuth,
  getMe
);

/*
 * ACCOUNT PROFILE
 */

router.patch(
  "/profile",
  requireAuth,
  updateAccountProfile
);

/*
 * CHANGE PASSWORD
 */

router.patch(
  "/change-password",
  requireAuth,
  changeAccountPassword
);

/*
 * STUDENT IDENTITY
 */

router.patch(
  "/student-details",
  requireAuth,
  updateStudentDetails
);

export default router;