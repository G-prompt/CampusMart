import { createHmac } from "node:crypto";

/**
 * A session version bound to the currently stored password hash.
 *
 * Changing the password changes this version automatically,
 * invalidating every previously issued user JWT.
 *
 * No database migration or persistent token blacklist required.
 */
export function getSessionVersion(
  passwordHash: string,
  jwtSecret: string
): string {
  return createHmac("sha256", jwtSecret)
    .update(passwordHash, "utf8")
    .digest("hex");
}