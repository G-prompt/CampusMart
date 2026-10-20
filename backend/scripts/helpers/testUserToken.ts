
import jwt from "jsonwebtoken";

import { getSessionVersion } from "../../src/lib/sessionVersion";

import type {
  UserRole,
} from "../../src/generated/prisma/client";

/**
 * Test-only JWT helper.
 *
 * Uses the password hash returned by Prisma when
 * creating the test user, so sessionVersion matches
 * production authentication.
 */
export function testUserToken(
  user: {
    id: string;
    role: UserRole;
    passwordHash: string;
  },
  expiresIn: "1h" | "10m" = "1h"
): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set.");
  }

  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      sessionVersion: getSessionVersion(
        user.passwordHash,
        secret
      ),
    },
    secret,
    {
      expiresIn,
    }
  );
}
