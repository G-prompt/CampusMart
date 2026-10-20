import type { Response } from "express";

import bcrypt from "bcryptjs";

import { prisma } from "../lib/prisma";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

export async function changeAccountPassword(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const { currentPassword, newPassword } = req.body ?? {};

  if (
    typeof currentPassword !== "string" ||
    !currentPassword ||
    typeof newPassword !== "string" ||
    !newPassword
  ) {
    return res.status(400).json({
      success: false,
      code: "PASSWORD_FIELDS_REQUIRED",
      message:
        "Enter your current password and a new password.",
    });
  }

  if (newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({
      success: false,
      code: "INVALID_NEW_PASSWORD",
      message:
        "Your new password must contain between 8 and 128 characters.",
    });
  }

  try {
    const account = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!account) {
      return res.status(401).json({
        success: false,
        message: "Account no longer exists.",
      });
    }

    const correct = await bcrypt.compare(
      currentPassword,
      account.passwordHash
    );

    if (!correct) {
      return res.status(401).json({
        success: false,
        code: "INCORRECT_CURRENT_PASSWORD",
        message: "Your current password is incorrect.",
      });
    }

    const isSamePassword = await bcrypt.compare(
      newPassword,
      account.passwordHash
    );

    if (isSamePassword) {
      return res.status(409).json({
        success: false,
        code: "PASSWORD_REUSE",
        message:
          "Choose a new password different from your current password.",
      });
    }

    const passwordHash = await bcrypt.hash(
      newPassword,
      12
    );

    /*
     * Conditional update protects against concurrent
     * password changes.
     *
     * Updating passwordHash also rotates the session
     * version derived in requireAuth.
     */
    const result = await prisma.user.updateMany({
      where: {
        id: account.id,
        passwordHash: account.passwordHash,
      },
      data: {
        passwordHash,
      },
    });

    if (result.count !== 1) {
      return res.status(409).json({
        success: false,
        code: "PASSWORD_CHANGED_CONCURRENTLY",
        message:
          "Your password was changed from another session. Please sign in again.",
      });
    }

    return res.status(200).json({
      success: true,
      code: "PASSWORD_CHANGED",
      message:
        "Password updated successfully. Please sign in again with your new password.",
      mustSignInAgain: true,
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to change your password.",
    });
  }
}