import "dotenv/config";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import app from "../src/app";

import {
  UserRole,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error("JWT_SECRET is not set.");
}

const testId = randomUUID();
const email = `password-test-${testId}@example.com`;

const oldPassword = `OldPassword-${testId}`;
const newPassword = `NewPassword-${testId}`;

let passed = 0;
let failed = 0;

let userId: string | null = null;

function check(
  condition: unknown,
  description: string
) {
  if (condition) {
    passed++;
    console.log(`PASS ${passed + failed}: ${description}`);
  } else {
    failed++;
    console.error(`FAIL ${passed + failed}: ${description}`);
  }
}

async function request(
  base: string,
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH";
    token?: string;
    body?: unknown;
  } = {}
) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.token
        ? {
            Authorization: `Bearer ${options.token}`,
          }
        : {}),
      ...(options.body !== undefined
        ? {
            "Content-Type": "application/json",
          }
        : {}),
    },
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  });

  const data = await response.json().catch(
    () => null
  );

  return {
    status: response.status,
    data,
  };
}

async function main() {
  let server: ReturnType<typeof app.listen> | null =
    null;

  try {
    const passwordHash = await bcrypt.hash(
      oldPassword,
      12
    );

    const user = await prisma.user.create({
      data: {
        name: "Password Change Test",
        email,
        passwordHash,
        role: UserRole.client,
      },
    });

    userId = user.id;

    server = await new Promise<
      ReturnType<typeof app.listen>
    >((resolve, reject) => {
      const instance = app.listen(
        0,
        "127.0.0.1",
        () => resolve(instance)
      );

      instance.once("error", reject);
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Test server unavailable.");
    }

    const base = `http://127.0.0.1:${address.port}`;

    const loginBefore = await request(
      base,
      "/api/auth/login",
      {
        method: "POST",
        body: {
          email,
          password: oldPassword,
        },
      }
    );

    const oldToken =
      loginBefore.data?.token ?? "";

    check(
      loginBefore.status === 200 &&
        typeof oldToken === "string" &&
        oldToken.length > 0,
      "Original password logs in successfully"
    );

    const initialMe = await request(
      base,
      "/api/auth/me",
      {
        token: oldToken,
      }
    );

    check(
      initialMe.status === 200 &&
        initialMe.data?.user?.id === user.id,
      "Original session works before password change"
    );

    const unauthenticated = await request(
      base,
      "/api/auth/change-password",
      {
        method: "PATCH",
        body: {
          currentPassword: oldPassword,
          newPassword,
        },
      }
    );

    check(
      unauthenticated.status === 401,
      "Password changes require authentication"
    );

    const wrongCurrent = await request(
      base,
      "/api/auth/change-password",
      {
        method: "PATCH",
        token: oldToken,
        body: {
          currentPassword: "NotTheCurrentPassword",
          newPassword,
        },
      }
    );

    check(
      wrongCurrent.status === 401 &&
        wrongCurrent.data?.code ===
          "INCORRECT_CURRENT_PASSWORD",
      "Incorrect current password is rejected"
    );

    const tooShort = await request(
      base,
      "/api/auth/change-password",
      {
        method: "PATCH",
        token: oldToken,
        body: {
          currentPassword: oldPassword,
          newPassword: "short",
        },
      }
    );

    check(
      tooShort.status === 400 &&
        tooShort.data?.code ===
          "INVALID_NEW_PASSWORD",
      "Short new password is rejected"
    );

    const reused = await request(
      base,
      "/api/auth/change-password",
      {
        method: "PATCH",
        token: oldToken,
        body: {
          currentPassword: oldPassword,
          newPassword: oldPassword,
        },
      }
    );

    check(
      reused.status === 409 &&
        reused.data?.code === "PASSWORD_REUSE",
      "Current password cannot be reused"
    );

    const changed = await request(
      base,
      "/api/auth/change-password",
      {
        method: "PATCH",
        token: oldToken,
        body: {
          currentPassword: oldPassword,
          newPassword,
        },
      }
    );

    check(
      changed.status === 200 &&
        changed.data?.success === true &&
        changed.data?.mustSignInAgain === true,
      "Valid password change succeeds"
    );

    const stored = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        passwordHash: true,
      },
    });

    check(
      Boolean(stored) &&
        stored?.passwordHash !== passwordHash &&
        (await bcrypt.compare(
          newPassword,
          stored!.passwordHash
        )),
      "New password is securely hashed in the database"
    );

    const oldSession = await request(
      base,
      "/api/auth/me",
      {
        token: oldToken,
      }
    );

    check(
      oldSession.status === 401 &&
        oldSession.data?.code === "SESSION_EXPIRED",
      "Previously issued JWT is invalidated"
    );

    const legacyToken = jwt.sign(
      {
        userId: user.id,
        role: UserRole.client,
      },
      secret!,
      {
        expiresIn: "1h",
      }
    );

    const legacySession = await request(
      base,
      "/api/auth/me",
      {
        token: legacyToken,
      }
    );

    check(
      legacySession.status === 401 &&
        legacySession.data?.code === "SESSION_EXPIRED",
      "Legacy token without session version is rejected"
    );

    const oldLogin = await request(
      base,
      "/api/auth/login",
      {
        method: "POST",
        body: {
          email,
          password: oldPassword,
        },
      }
    );

    check(
      oldLogin.status === 401,
      "Old password can no longer log in"
    );

    const newLogin = await request(
      base,
      "/api/auth/login",
      {
        method: "POST",
        body: {
          email,
          password: newPassword,
        },
      }
    );

    check(
      newLogin.status === 200 &&
        typeof newLogin.data?.token === "string",
      "New password logs in successfully"
    );

    const newSession = await request(
      base,
      "/api/auth/me",
      {
        token: newLogin.data?.token,
      }
    );

    check(
      newSession.status === 200 &&
        newSession.data?.user?.id === user.id,
      "Freshly issued JWT has valid account access"
    );

    console.log(
      `\nPassword tests: ${passed} passed / ${failed} failed\n`
    );

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) =>
          error ? reject(error) : resolve()
        );
      });
    }

    if (userId) {
      await prisma.user.delete({
        where: {
          id: userId,
        },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(
      "Password change tests crashed:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });