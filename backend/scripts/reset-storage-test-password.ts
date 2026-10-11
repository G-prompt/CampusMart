import bcrypt from "bcryptjs";

import {
  prisma,
} from "../src/lib/prisma";

const TEST_EMAIL =
  "storage-test-1790876198867@campusmart.test";

async function main() {
  const newPassword =
    process.env.TEST_ACCOUNT_PASSWORD;

  if (!newPassword) {
    throw new Error(
      "TEST_ACCOUNT_PASSWORD is missing."
    );
  }

  if (newPassword.length < 8) {
    throw new Error(
      "Use a password with at least 8 characters."
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email:
          TEST_EMAIL,
      },

      select: {
        id: true,
        email: true,
        name: true,
      },
    });

  if (!user) {
    throw new Error(
      `No CampusMart user found with email ${TEST_EMAIL}.`
    );
  }

  const passwordHash =
    await bcrypt.hash(
      newPassword,
      12
    );

  await prisma.user.update({
    where: {
      id:
        user.id,
    },

    data: {
      passwordHash,
    },
  });

  console.log("");
  console.log(
    "✅ Test password reset successfully."
  );

  console.log(
    `User: ${user.name}`
  );

  console.log(
    `Email: ${user.email}`
  );

  console.log("");
}

main()
  .catch((error) => {
    console.error(
      "❌ Password reset failed:"
    );

    console.error(
      error
    );

    process.exitCode =
      1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });