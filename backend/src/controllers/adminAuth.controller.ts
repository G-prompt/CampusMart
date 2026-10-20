import {
  Request,
  Response,
} from "express";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import type {
  AuthenticatedAdminRequest,
} from "../middleware/adminAuth.middleware";

import { prisma } from "../lib/prisma";

function cleanText(
  value: unknown
): string {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
}

export const adminLogin =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const email =
        cleanText(
          req.body.email
        ).toLowerCase();

      const password =
        typeof req.body.password ===
        "string"
          ? req.body.password
          : "";

      if (
        !email ||
        !password
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Email and password are required.",
        });
      }

      const admin =
        await prisma.admin.findUnique({
          where: {
            email,
          },

          select: {
            id: true,
            name: true,
            email: true,
            passwordHash:
              true,
            role: true,
            active: true,
            createdAt:
              true,
          },
        });

      /*
       * Keep invalid credentials generic
       * so the login endpoint does not
       * reveal whether an Admin email
       * exists.
       */
      if (!admin) {
        return res.status(401).json({
          success: false,

          message:
            "Invalid email or password.",
        });
      }

      const passwordMatches =
        await bcrypt.compare(
          password,
          admin.passwordHash
        );

      if (
        !passwordMatches
      ) {
        return res.status(401).json({
          success: false,

          message:
            "Invalid email or password.",
        });
      }

      if (!admin.active) {
        return res.status(403).json({
          success: false,

          code:
            "ADMIN_ACCOUNT_INACTIVE",

          message:
            "Admin access is not currently available for this account.",
        });
      }

      const secret =
        process.env.ADMIN_JWT_SECRET;

      if (!secret) {
        throw new Error(
          "ADMIN_JWT_SECRET is not configured."
        );
      }

      const token =
        jwt.sign(
          {
            adminId:
              admin.id,

            role:
              admin.role,

            tokenType:
              "admin",
          },
          secret,
          {
            algorithm:
              "HS256",

            expiresIn:
              "8h",

            issuer:
              "campusmart-admin",

            audience:
              "campusmart-admin",
          }
        );

      return res.status(200).json({
        success: true,

        message:
          "Admin login successful.",

        token,

        admin: {
          id:
            admin.id,

          name:
            admin.name,

          email:
            admin.email,

          role:
            admin.role,

          active:
            admin.active,

          createdAt:
            admin.createdAt,
        },
      });
    } catch (error) {
      console.error(
        "Admin login error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to sign in to the Admin platform.",
      });
    }
  };

export const getCurrentAdmin =
  async (
    req:
      AuthenticatedAdminRequest,

    res:
      Response
  ) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          success: false,

          message:
            "Admin authentication required.",
        });
      }

      const admin =
        await prisma.admin.findUnique({
          where: {
            id:
              req.admin.id,
          },

          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            createdAt:
              true,
            updatedAt:
              true,

            createdByAdmin:
              {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
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

      return res.status(200).json({
        success: true,
        admin,
      });
    } catch (error) {
      console.error(
        "Get current Admin error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to load Admin account.",
      });
    }
  };