import "dotenv/config";

import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/prisma";

import {
  AdminRole,
} from "../src/generated/prisma/client";

async function bootstrapSuperAdmin() {
  const name =
    process.env.ADMIN_BOOTSTRAP_NAME?.trim();

  const email =
    process.env.ADMIN_BOOTSTRAP_EMAIL
      ?.trim()
      .toLowerCase();

  const password =
    process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (
    !name ||
    !email ||
    !password
  ) {
    throw new Error(
      "ADMIN_BOOTSTRAP_NAME, ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set."
    );
  }

  if (
    password.length < 14
  ) {
    throw new Error(
      "The bootstrap admin password must be at least 14 characters long."
    );
  }

  /*
   * Only one initial Super Admin may be
   * created through this bootstrap script.
   *
   * Once one exists, future Admin accounts
   * should be created through the Admin
   * management system.
   */
  const existingSuperAdmin =
    await prisma.admin.findFirst({
      where: {
        role:
          AdminRole.super_admin,
      },

      select: {
        id: true,
        email: true,
      },
    });

  if (existingSuperAdmin) {
    throw new Error(
      `A Super Admin already exists (${existingSuperAdmin.email}). Bootstrap cancelled.`
    );
  }

  const existingAdminEmail =
    await prisma.admin.findUnique({
      where: {
        email,
      },

      select: {
        id: true,
      },
    });

  if (existingAdminEmail) {
    throw new Error(
      "An Admin account already exists with this email."
    );
  }

  const existingUserEmail =
    await prisma.user.findUnique({
      where: {
        email,
      },

      select: {
        id: true,
      },
    });

  if (existingUserEmail) {
    throw new Error(
      "This email is already being used by a normal CampusMart account. Use a dedicated Admin email."
    );
  }

  const passwordHash =
    await bcrypt.hash(
      password,
      12
    );

  const admin =
    await prisma.admin.create({
      data: {
        name,
        email,
        passwordHash,

        role:
          AdminRole.super_admin,

        active:
          true,
      },

      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

  console.log(
    "CampusMart Super Admin created successfully:"
  );

  console.log({
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
  });

  console.log(
    "\nRemove ADMIN_BOOTSTRAP_PASSWORD from .env now that the Super Admin has been created."
  );
}

bootstrapSuperAdmin()
  .catch(
    (error) => {
      console.error(
        "\nSuper Admin bootstrap failed:"
      );

      console.error(
        error instanceof Error
          ? error.message
          : error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    }
  );