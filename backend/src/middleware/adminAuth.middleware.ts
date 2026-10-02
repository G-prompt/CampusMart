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
  AdminRole,
} from "../generated/prisma/client";

type AdminTokenPayload =
  JwtPayload & {
    adminId: string;
    role: AdminRole;
    tokenType: "admin";
  };

export interface AuthenticatedAdminRequest
  extends Request {
  admin?: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
  };
}

export const requireAdmin =
  async (
    req: AuthenticatedAdminRequest,
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
            "Admin authentication required.",
        });
      }

      const token =
        authHeader.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message:
            "Admin authentication required.",
        });
      }

      const secret =
        process.env.ADMIN_JWT_SECRET;

      if (!secret) {
        throw new Error(
          "ADMIN_JWT_SECRET is not configured."
        );
      }

      const decoded =
        jwt.verify(
          token,
          secret,
          {
            algorithms: [
              "HS256",
            ],

            issuer:
              "campusmart-admin",

            audience:
              "campusmart-admin",
          }
        ) as AdminTokenPayload;

      if (
        !decoded.adminId ||
        decoded.tokenType !==
          "admin"
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid admin authentication token.",
        });
      }

      const admin =
        await prisma.admin.findUnique({
          where: {
            id:
              decoded.adminId,
          },

          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
          },
        });

      if (
        !admin ||
        !admin.active
      ) {
        return res.status(403).json({
          success: false,

          code:
            "ADMIN_ACCESS_UNAVAILABLE",

          message:
            "Admin access is not currently available for this account.",
        });
      }

      req.admin = {
        id:
          admin.id,

        name:
          admin.name,

        email:
          admin.email,

        role:
          admin.role,
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
            "Invalid or expired admin authentication token.",
        });
      }

      console.error(
        "Admin authentication middleware error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to authenticate Admin request.",
      });
    }
  };

export const requireAdminRole =
  (
    ...allowedRoles:
      AdminRole[]
  ) =>
  (
    req:
      AuthenticatedAdminRequest,

    res:
      Response,

    next:
      NextFunction
  ) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message:
          "Admin authentication required.",
      });
    }

    /*
     * Super Admin can access all
     * role-protected Admin routes.
     */
    if (
      req.admin.role ===
      AdminRole.super_admin
    ) {
      next();

      return;
    }

    if (
      !allowedRoles.includes(
        req.admin.role
      )
    ) {
      return res.status(403).json({
        success: false,

        code:
          "ADMIN_PERMISSION_REQUIRED",

        message:
          "You do not have permission to perform this Admin action.",
      });
    }

    next();
  };