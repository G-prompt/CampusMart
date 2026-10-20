
import type { Response } from "express";

import { prisma } from "../lib/prisma";
import { normalizeSignupPhone } from "../lib/phone";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

import { getMe } from "./auth.controller";

/**
 * Update ordinary account details.
 *
 * University identity, student verification, account roles,
 * seller permissions and passwords cannot be modified here.
 */
export async function updateAccountProfile(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  try {
    const body = req.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PROFILE_DATA",
        message: "Invalid profile information.",
      });
    }

    const changes: {
      name?: string;
      phone?: string;
    } = {};

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "name"
      )
    ) {
      if (typeof body.name !== "string") {
        return res.status(400).json({
          success: false,
          code: "INVALID_NAME",
          message: "Enter a valid full name.",
        });
      }

      const name = body.name.trim();

      if (name.length < 2 || name.length > 120) {
        return res.status(400).json({
          success: false,
          code: "INVALID_NAME",
          message:
            "Your full name must contain between 2 and 120 characters.",
        });
      }

      changes.name = name;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "phone"
      )
    ) {
      if (typeof body.phone !== "string") {
        return res.status(400).json({
          success: false,
          code: "INVALID_PHONE",
          message: "Enter a valid phone number.",
        });
      }

      const phone = normalizeSignupPhone(body.phone);

      if (!phone) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PHONE",
          message:
            "Enter a valid Nigerian phone number using 10 digits after +234.",
        });
      }

      changes.phone = phone;
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({
        success: false,
        code: "NO_PROFILE_CHANGES",
        message: "No supported profile changes provided.",
      });
    }

    const updated = await prisma.user.updateMany({
      where: {
        id: req.user.id,
      },
      data: changes,
    });

    if (updated.count !== 1) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    // Return the same authoritative account shape as
    // login and GET /api/auth/me.
    return await getMe(req, res);
  } catch (error) {
    console.error("Update account profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save your profile.",
    });
  }
}
