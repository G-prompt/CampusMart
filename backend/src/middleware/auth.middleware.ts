import type {
  NextFunction,
  Request,
  Response,
} from "express";

import jwt, {
  type JwtPayload,
} from "jsonwebtoken";

import { prisma } from "../lib/prisma";

import {
  UserRole,
  VendorAccessStatus,
} from "../generated/prisma/client";

import {
  reconcileSellerAccess,
} from "../services/sellerEligibility.service";

import {
  getSessionVersion,
} from "../lib/sessionVersion";

type TokenPayload = JwtPayload & {
  userId: string;
  role: UserRole;
  sessionVersion?: string;
};

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    vendorAccessStatus: VendorAccessStatus | null;
  };
}

/*
 * =======================================================
 * AUTHENTICATION
 * =======================================================
 */

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not set");
    }

    const decoded = jwt.verify(
      token,
      jwtSecret
    ) as TokenPayload;

    if (
      !decoded.userId ||
      typeof decoded.userId !== "string"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
        accountSuspendedAt: true,
        vendorProfile: {
          select: {
            accessStatus: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists.",
      });
    }

    /*
     * The token must have been issued for the password
     * hash currently stored for this user.
     *
     * Previously issued tokens without sessionVersion
     * are intentionally invalidated on deployment.
     */
    const expectedVersion = getSessionVersion(
      user.passwordHash,
      jwtSecret
    );

    if (
      typeof decoded.sessionVersion !== "string" ||
      decoded.sessionVersion !== expectedVersion
    ) {
      return res.status(401).json({
        success: false,
        code: "SESSION_EXPIRED",
        message:
          "Your session is no longer valid. Please sign in again.",
      });
    }

    if (user.accountSuspendedAt) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_SUSPENDED",
        message:
          "Your CampusMart account is suspended. Please contact support for review.",
      });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      vendorAccessStatus:
        user.vendorProfile?.accessStatus ?? null,
    };

    next();
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid or expired authentication token.",
      });
    }

    console.error(
      "Authentication middleware error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to authenticate request.",
    });
  }
};

/*
 * =======================================================
 * VENDOR ACCOUNT
 * =======================================================
 */

export const requireVendorAccount = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== UserRole.vendor) {
    return res.status(403).json({
      success: false,
      code: "VENDOR_ROLE_REQUIRED",
      message: "Seller account required.",
    });
  }

  next();
};

/*
 * =======================================================
 * EXISTING ORDER FULFILMENT
 * =======================================================
 *
 * Active and pending-review sellers can fulfil
 * existing obligations.
 *
 * Restricted and suspended sellers cannot perform
 * order actions, but may still view history.
 */

export const requireVendorOrderFulfillment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (req.user.role !== UserRole.vendor) {
      return res.status(403).json({
        success: false,
        code: "VENDOR_ROLE_REQUIRED",
        message: "Seller account required.",
      });
    }

    const eligibility = await reconcileSellerAccess(
      req.user.id
    );

    const accessStatus =
      eligibility.sellerProfile.accessStatus;

    req.user.vendorAccessStatus = accessStatus;

    if (
      accessStatus === VendorAccessStatus.active ||
      accessStatus === VendorAccessStatus.pending_review
    ) {
      return next();
    }

    if (accessStatus === VendorAccessStatus.restricted) {
      return res.status(403).json({
        success: false,
        code: "SELLER_ORDER_ACTIONS_RESTRICTED",
        message:
          "Your seller access is restricted. You can still view your existing orders, but order actions are currently unavailable.",
        eligibility,
      });
    }

    if (accessStatus === VendorAccessStatus.suspended) {
      return res.status(403).json({
        success: false,
        code: "SELLER_ORDER_ACTIONS_SUSPENDED",
        message:
          "Your seller account is suspended. You can still view your existing order history, but order actions are currently unavailable.",
        eligibility,
      });
    }

    return res.status(403).json({
      success: false,
      code: "SELLER_ORDER_ACTIONS_UNAVAILABLE",
      message:
        "Order fulfilment is not currently available for this seller account.",
      eligibility,
    });
  } catch (error) {
    console.error(
      "Vendor order fulfilment middleware error:",
      error
    );

    if (
      error instanceof Error &&
      error.message === "USER_NOT_FOUND"
    ) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to confirm seller order access.",
    });
  }
};

/*
 * =======================================================
 * LEGACY ACTIVE-VENDOR CHECK
 * =======================================================
 */

export const requireVendor = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== UserRole.vendor) {
    return res.status(403).json({
      success: false,
      message: "Vendor access required.",
    });
  }

  switch (req.user.vendorAccessStatus) {
    case VendorAccessStatus.active:
      return next();

    case VendorAccessStatus.pending_review:
      return res.status(403).json({
        success: false,
        code: "VENDOR_PENDING_REVIEW",
        message:
          "Your seller account is still under review. You can continue using CampusMart as a buyer while we review your seller access.",
      });

    case VendorAccessStatus.restricted:
      return res.status(403).json({
        success: false,
        code: "VENDOR_RESTRICTED",
        message:
          "Your seller access is currently restricted. Please contact CampusMart support.",
      });

    case VendorAccessStatus.suspended:
      return res.status(403).json({
        success: false,
        code: "VENDOR_SUSPENDED",
        message: "Your seller account is currently suspended.",
      });

    default:
      return res.status(403).json({
        success: false,
        code: "VENDOR_ACCESS_UNAVAILABLE",
        message:
          "Seller access is not currently available for this account.",
      });
  }
};

/*
 * =======================================================
 * SELLER ELIGIBILITY
 * =======================================================
 */

export const requireSellerEligibility = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (req.user.role !== UserRole.vendor) {
      return res.status(403).json({
        success: false,
        code: "VENDOR_ROLE_REQUIRED",
        message: "Seller account required.",
      });
    }

    const eligibility = await reconcileSellerAccess(
      req.user.id
    );

    req.user.vendorAccessStatus =
      eligibility.sellerProfile.accessStatus;

    if (eligibility.canSell) {
      return next();
    }

    let code = "SELLER_NOT_ELIGIBLE";

    switch (eligibility.nextRequiredAction) {
      case "complete_university_details":
        code = "SELLER_UNIVERSITY_DETAILS_REQUIRED";
        break;

      case "add_matric_number":
        code = "SELLER_MATRIC_REQUIRED";
        break;

      case "verify_student_identity":
        code = "STUDENT_VERIFICATION_REQUIRED";
        break;

      case "complete_seller_profile":
        code = "SELLER_PROFILE_REQUIRED";
        break;

      case "seller_access_pending":
        code = "SELLER_ACCESS_PENDING";
        break;

      case "seller_access_restricted":
        code = "SELLER_ACCESS_RESTRICTED";
        break;

      case "seller_access_suspended":
        code = "SELLER_ACCESS_SUSPENDED";
        break;

      case "not_a_seller":
        code = "VENDOR_ROLE_REQUIRED";
        break;

      default:
        code = "SELLER_NOT_ELIGIBLE";
    }

    return res.status(403).json({
      success: false,
      code,
      message: eligibility.message,
      eligibility,
    });
  } catch (error) {
    console.error(
      "Seller eligibility middleware error:",
      error
    );

    if (
      error instanceof Error &&
      error.message === "USER_NOT_FOUND"
    ) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to confirm seller access.",
    });
  }
};