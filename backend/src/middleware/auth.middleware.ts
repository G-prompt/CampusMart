import {
  NextFunction,
  Request,
  Response,
} from "express";

import jwt, {
  JwtPayload,
} from "jsonwebtoken";

import { prisma } from "../lib/prisma";

import {
  UserRole,
  VendorAccessStatus,
} from "../generated/prisma/client";

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
          id: true,
          name: true,
          email: true,
          role: true,

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
  } catch (error) {
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