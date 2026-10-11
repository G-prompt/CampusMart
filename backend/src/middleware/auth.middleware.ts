import {
  NextFunction,
  Request,
  Response,
} from "express";

import jwt, {
  JwtPayload,
} from "jsonwebtoken";

import {
  prisma,
} from "../lib/prisma";

import {
  UserRole,
  VendorAccessStatus,
} from "../generated/prisma/client";

import {
  reconcileSellerAccess,
} from "../services/sellerEligibility.service";

type TokenPayload =
  JwtPayload & {
    userId: string;
    role: UserRole;
  };

export interface AuthenticatedRequest
  extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;

    vendorAccessStatus:
      | VendorAccessStatus
      | null;
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
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader?.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        success: false,

        message:
          "Authentication required.",
      });
    }

    const token =
      authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,

        message:
          "Authentication required.",
      });
    }

    const jwtSecret =
      process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error(
        "JWT_SECRET is not set"
      );
    }

    const decoded =
      jwt.verify(
        token,
        jwtSecret
      ) as TokenPayload;

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,

        message:
          "Invalid authentication token.",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id:
            decoded.userId,
        },

        select: {
          id:
            true,

          name:
            true,

          email:
            true,

          role:
            true,

          vendorProfile: {
            select: {
              accessStatus:
                true,
            },
          },
        },
      });

    if (!user) {
      return res.status(401).json({
        success: false,

        message:
          "User account no longer exists.",
      });
    }

    req.user = {
      id:
        user.id,

      name:
        user.name,

      email:
        user.email,

      role:
        user.role,

      vendorAccessStatus:
        user.vendorProfile
          ?.accessStatus ??
        null,
    };

    next();
  } catch (
    error
  ) {
    if (
      error instanceof
        jwt.JsonWebTokenError ||
      error instanceof
        jwt.TokenExpiredError
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

      message:
        "Unable to authenticate request.",
    });
  }
};

/*
 * =======================================================
 * VENDOR ACCOUNT
 * =======================================================
 *
 * Checks only whether the user has a seller/vendor account.
 *
 * It deliberately does NOT require active seller access.
 *
 * Suitable for:
 *
 * - seller dashboard
 * - seller setup
 * - seller listing history
 * - existing order history
 */

export const requireVendorAccount = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,

      message:
        "Authentication required.",
    });
  }

  if (
    req.user.role !==
    UserRole.vendor
  ) {
    return res.status(403).json({
      success: false,

      code:
        "VENDOR_ROLE_REQUIRED",

      message:
        "Seller account required.",
    });
  }

  next();
};

/*
 * =======================================================
 * EXISTING ORDER FULFILMENT
 * =======================================================
 *
 * Existing buyer obligations are different from creating
 * new commercial activity.
 *
 * ACTIVE
 *   -> may fulfil existing orders
 *
 * PENDING_REVIEW
 *   -> may fulfil existing orders
 *
 * RESTRICTED
 *   -> blocked
 *
 * SUSPENDED
 *   -> blocked
 *
 * This middleware reconciles seller state first so stale
 * access values are corrected before the decision.
 */

export const requireVendorOrderFulfillment =
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,

          message:
            "Authentication required.",
        });
      }

      if (
        req.user.role !==
        UserRole.vendor
      ) {
        return res.status(403).json({
          success: false,

          code:
            "VENDOR_ROLE_REQUIRED",

          message:
            "Seller account required.",
        });
      }

      const eligibility =
        await reconcileSellerAccess(
          req.user.id
        );

      const accessStatus =
        eligibility
          .sellerProfile
          .accessStatus;

      /*
       * Keep request-local state synced
       * after reconciliation.
       */
      req.user.vendorAccessStatus =
        accessStatus;

      if (
        accessStatus ===
          VendorAccessStatus.active ||
        accessStatus ===
          VendorAccessStatus.pending_review
      ) {
        return next();
      }

      if (
        accessStatus ===
        VendorAccessStatus.restricted
      ) {
        return res.status(403).json({
          success: false,

          code:
            "SELLER_ORDER_ACTIONS_RESTRICTED",

          message:
            "Your seller access is restricted. You can still view your existing orders, but order actions are currently unavailable.",

          eligibility,
        });
      }

      if (
        accessStatus ===
        VendorAccessStatus.suspended
      ) {
        return res.status(403).json({
          success: false,

          code:
            "SELLER_ORDER_ACTIONS_SUSPENDED",

          message:
            "Your seller account is suspended. You can still view your existing order history, but order actions are currently unavailable.",

          eligibility,
        });
      }

      return res.status(403).json({
        success: false,

        code:
          "SELLER_ORDER_ACTIONS_UNAVAILABLE",

        message:
          "Order fulfilment is not currently available for this seller account.",

        eligibility,
      });
    } catch (
      error
    ) {
      console.error(
        "Vendor order fulfilment middleware error:",
        error
      );

      if (
        error instanceof
          Error &&
        error.message ===
          "USER_NOT_FOUND"
      ) {
        return res.status(401).json({
          success: false,

          message:
            "User account no longer exists.",
        });
      }

      return res.status(500).json({
        success: false,

        message:
          "Unable to confirm seller order access.",
      });
    }
  };

/*
 * =======================================================
 * LEGACY ACTIVE-VENDOR CHECK
 * =======================================================
 *
 * Retained for compatibility while older routes are being
 * migrated to more specific access policies.
 */

export const requireVendor = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,

      message:
        "Authentication required.",
    });
  }

  if (
    req.user.role !==
    UserRole.vendor
  ) {
    return res.status(403).json({
      success: false,

      message:
        "Vendor access required.",
    });
  }

  if (
    req.user.vendorAccessStatus ===
    VendorAccessStatus.pending_review
  ) {
    return res.status(403).json({
      success: false,

      code:
        "VENDOR_PENDING_REVIEW",

      message:
        "Your seller account is still under review. You can continue using CampusMart as a buyer while we review your seller access.",
    });
  }

  if (
    req.user.vendorAccessStatus ===
    VendorAccessStatus.restricted
  ) {
    return res.status(403).json({
      success: false,

      code:
        "VENDOR_RESTRICTED",

      message:
        "Your seller access is currently restricted. Please contact CampusMart support.",
    });
  }

  if (
    req.user.vendorAccessStatus ===
    VendorAccessStatus.suspended
  ) {
    return res.status(403).json({
      success: false,

      code:
        "VENDOR_SUSPENDED",

      message:
        "Your seller account is currently suspended.",
    });
  }

  if (
    req.user.vendorAccessStatus !==
    VendorAccessStatus.active
  ) {
    return res.status(403).json({
      success: false,

      code:
        "VENDOR_ACCESS_UNAVAILABLE",

      message:
        "Seller access is not currently available for this account.",
    });
  }

  next();
};

/*
 * =======================================================
 * SELLER ELIGIBILITY
 * =======================================================
 *
 * Authoritative gate for creating or modifying commercial
 * marketplace content.
 *
 * Checks:
 *
 * - vendor role
 * - university details
 * - matric number where required
 * - verified student identity
 * - complete seller profile
 * - active seller access
 *
 * It also safely reconciles:
 *
 * pending_review -> active
 * active         -> pending_review
 *
 * Restricted and suspended statuses are never
 * automatically overridden.
 */

export const requireSellerEligibility =
  async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,

          message:
            "Authentication required.",
        });
      }

      if (
        req.user.role !==
        UserRole.vendor
      ) {
        return res.status(403).json({
          success: false,

          code:
            "VENDOR_ROLE_REQUIRED",

          message:
            "Seller account required.",
        });
      }

      const eligibility =
        await reconcileSellerAccess(
          req.user.id
        );

      req.user.vendorAccessStatus =
        eligibility
          .sellerProfile
          .accessStatus;

      if (
        eligibility.canSell
      ) {
        return next();
      }

      let code =
        "SELLER_NOT_ELIGIBLE";

      switch (
        eligibility.nextRequiredAction
      ) {
        case "complete_university_details":
          code =
            "SELLER_UNIVERSITY_DETAILS_REQUIRED";
          break;

        case "add_matric_number":
          code =
            "SELLER_MATRIC_REQUIRED";
          break;

        case "verify_student_identity":
          code =
            "STUDENT_VERIFICATION_REQUIRED";
          break;

        case "complete_seller_profile":
          code =
            "SELLER_PROFILE_REQUIRED";
          break;

        case "seller_access_pending":
          code =
            "SELLER_ACCESS_PENDING";
          break;

        case "seller_access_restricted":
          code =
            "SELLER_ACCESS_RESTRICTED";
          break;

        case "seller_access_suspended":
          code =
            "SELLER_ACCESS_SUSPENDED";
          break;

        case "not_a_seller":
          code =
            "VENDOR_ROLE_REQUIRED";
          break;

        default:
          code =
            "SELLER_NOT_ELIGIBLE";
      }

      return res.status(403).json({
        success: false,

        code,

        message:
          eligibility.message,

        eligibility,
      });
    } catch (
      error
    ) {
      console.error(
        "Seller eligibility middleware error:",
        error
      );

      if (
        error instanceof
          Error &&
        error.message ===
          "USER_NOT_FOUND"
      ) {
        return res.status(401).json({
          success: false,

          message:
            "User account no longer exists.",
        });
      }

      return res.status(500).json({
        success: false,

        message:
          "Unable to confirm seller access.",
      });
    }
  };