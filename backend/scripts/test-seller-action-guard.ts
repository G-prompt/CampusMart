import "dotenv/config";

import express from "express";

import jwt from "jsonwebtoken";

import type {
  AddressInfo,
} from "node:net";

import {
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

import {
  requireAuth,
  requireSellerEligibility,
} from "../src/middleware/auth.middleware";

const TEST_EMAILS = [
  "guard-unverified@campusmart.local",
  "guard-verified@campusmart.local",
  "guard-restricted@campusmart.local",
  "guard-buyer@campusmart.local",
];

let passed =
  0;

let failed =
  0;

function assert(
  condition: boolean,
  message: string
) {
  if (condition) {
    passed +=
      1;

    console.log(
      `PASS  ${message}`
    );

    return;
  }

  failed +=
    1;

  console.error(
    `FAIL  ${message}`
  );
}

async function cleanup() {
  await prisma.user.deleteMany({
    where: {
      email: {
        in:
          TEST_EMAILS,
      },
    },
  });
}

async function createVendor({
  email,
  studentVerificationStatus,
  accessStatus,
}: {
  email: string;

  studentVerificationStatus:
    StudentVerificationStatus;

  accessStatus:
    VendorAccessStatus;
}) {
  return prisma.user.create({
    data: {
      name:
        "Seller Guard Test",

      email,

      passwordHash:
        "test-only-not-a-login-hash",

      role:
        UserRole.vendor,

      /*
       * Use the supported Other/not-listed university
       * route so this security test does not depend on
       * any real university configuration.
       */
      fallbackUniversityName:
        "CampusMart Test University",

      fallbackState:
        "Test State",

      fallbackCity:
        "Test City",

      studentVerificationStatus,

      vendorProfile: {
        create: {
          businessName:
            "Seller Guard Test Shop",

          businessDescription:
            "Temporary seller security test.",

          pickupLocation:
            "Test Campus",

          accessStatus,
        },
      },
    },

    select: {
      id:
        true,

      email:
        true,

      role:
        true,
    },
  });
}

async function createBuyer() {
  return prisma.user.create({
    data: {
      name:
        "Buyer Guard Test",

      email:
        TEST_EMAILS[3],

      passwordHash:
        "test-only-not-a-login-hash",

      role:
        UserRole.client,
    },

    select: {
      id:
        true,

      email:
        true,

      role:
        true,
    },
  });
}

function makeToken(
  userId: string,
  role: UserRole
) {
  const secret =
    process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set."
    );
  }

  return jwt.sign(
    {
      userId,
      role,
    },
    secret,
    {
      expiresIn:
        "10m",
    }
  );
}

async function requestSellerAction(
  baseUrl: string,
  token: string
) {
  const response =
    await fetch(
      `${baseUrl}/seller-action`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({}),
      }
    );

  const data =
    await response
      .json()
      .catch(
        () =>
          null
      );

  return {
    status:
      response.status,

    data,
  };
}

async function main() {
  console.log("");
  console.log(
    "CampusMart seller action guard tests"
  );

  console.log(
    "-----------------------------------"
  );

  await cleanup();

  const app =
    express();

  app.use(
    express.json()
  );

  /*
   * This reproduces the security stack now used by
   * protected seller marketplace actions.
   */
  app.post(
    "/seller-action",
    requireAuth,
    requireSellerEligibility,
    (
      req,
      res
    ) => {
      return res.status(200).json({
        success:
          true,

        message:
          "Seller action allowed.",
      });
    }
  );

  const server =
    app.listen(
      0,
      "127.0.0.1"
    );

  await new Promise<void>(
    (
      resolve,
      reject
    ) => {
      server.once(
        "listening",
        () =>
          resolve()
      );

      server.once(
        "error",
        reject
      );
    }
  );

  const address =
    server.address() as
      AddressInfo;

  const baseUrl =
    `http://127.0.0.1:${address.port}`;

  try {
    /*
     * ===================================================
     * TEST 1
     *
     * Legacy unsafe state:
     *
     * accessStatus = active
     * student = not verified
     *
     * Middleware must reconcile to pending_review and
     * BLOCK the seller action.
     * ===================================================
     */

    const unverified =
      await createVendor({
        email:
          TEST_EMAILS[0],

        studentVerificationStatus:
          StudentVerificationStatus.not_started,

        accessStatus:
          VendorAccessStatus.active,
      });

    const unverifiedResponse =
      await requestSellerAction(
        baseUrl,
        makeToken(
          unverified.id,
          unverified.role
        )
      );

    assert(
      unverifiedResponse.status ===
        403,

      "Unverified seller receives HTTP 403"
    );

    assert(
      unverifiedResponse.data
        ?.code ===
        "STUDENT_VERIFICATION_REQUIRED",

      "Unverified seller is blocked by student verification requirement"
    );

    const correctedProfile =
      await prisma.vendorProfile.findUnique({
        where: {
          userId:
            unverified.id,
        },

        select: {
          accessStatus:
            true,
        },
      });

    assert(
      correctedProfile
        ?.accessStatus ===
        VendorAccessStatus.pending_review,

      "Unsafe active seller state is reconciled to pending_review"
    );

    /*
     * ===================================================
     * TEST 2
     *
     * Student verified
     * Profile complete
     * accessStatus = pending_review
     *
     * Middleware should reconcile to active and ALLOW.
     * ===================================================
     */

    const verified =
      await createVendor({
        email:
          TEST_EMAILS[1],

        studentVerificationStatus:
          StudentVerificationStatus.verified,

        accessStatus:
          VendorAccessStatus.pending_review,
      });

    const verifiedResponse =
      await requestSellerAction(
        baseUrl,
        makeToken(
          verified.id,
          verified.role
        )
      );

    assert(
      verifiedResponse.status ===
        200,

      "Verified eligible seller is allowed through seller-action guard"
    );

    assert(
      verifiedResponse.data
        ?.success ===
        true,

      "Eligible seller reaches protected seller action"
    );

    const promotedProfile =
      await prisma.vendorProfile.findUnique({
        where: {
          userId:
            verified.id,
        },

        select: {
          accessStatus:
            true,
        },
      });

    assert(
      promotedProfile
        ?.accessStatus ===
        VendorAccessStatus.active,

      "Verified pending seller is promoted to active"
    );

    /*
     * ===================================================
     * TEST 3
     *
     * Restricted sellers stay restricted even when their
     * student identity is verified.
     * ===================================================
     */

    const restricted =
      await createVendor({
        email:
          TEST_EMAILS[2],

        studentVerificationStatus:
          StudentVerificationStatus.verified,

        accessStatus:
          VendorAccessStatus.restricted,
      });

    const restrictedResponse =
      await requestSellerAction(
        baseUrl,
        makeToken(
          restricted.id,
          restricted.role
        )
      );

    assert(
      restrictedResponse.status ===
        403,

      "Restricted seller receives HTTP 403"
    );

    assert(
      restrictedResponse.data
        ?.code ===
        "SELLER_ACCESS_RESTRICTED",

      "Restricted seller remains blocked by administrative access control"
    );

    const stillRestricted =
      await prisma.vendorProfile.findUnique({
        where: {
          userId:
            restricted.id,
        },

        select: {
          accessStatus:
            true,
        },
      });

    assert(
      stillRestricted
        ?.accessStatus ===
        VendorAccessStatus.restricted,

      "Reconciliation does not override restricted status"
    );

    /*
     * ===================================================
     * TEST 4
     *
     * A normal buyer must never pass a seller-action gate.
     * ===================================================
     */

    const buyer =
      await createBuyer();

    const buyerResponse =
      await requestSellerAction(
        baseUrl,
        makeToken(
          buyer.id,
          buyer.role
        )
      );

    assert(
      buyerResponse.status ===
        403,

      "Buyer receives HTTP 403 on seller action"
    );

    assert(
      buyerResponse.data
        ?.code ===
        "VENDOR_ROLE_REQUIRED",

      "Buyer cannot bypass seller role requirement"
    );

    console.log("");
    console.log(
      "Seller action guard test summary"
    );

    console.log(
      "--------------------------------"
    );

    console.log(
      `Passed: ${passed}`
    );

    console.log(
      `Failed: ${failed}`
    );

    if (
      failed ===
      0
    ) {
      console.log("");
      console.log(
        "All seller action guard tests passed."
      );
    } else {
      process.exitCode =
        1;
    }
  } finally {
    await new Promise<void>(
      (
        resolve
      ) => {
        server.close(
          () =>
            resolve()
        );
      }
    );
  }
}

main()
  .catch(
    (
      error
    ) => {
      console.error("");
      console.error(
        "Seller action guard test failed unexpectedly:"
      );

      console.error(
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      try {
        await cleanup();

        console.log("");
        console.log(
          "Temporary seller guard accounts removed."
        );
      } catch (
        cleanupError
      ) {
        console.error(
          "Temporary seller cleanup failed:",
          cleanupError
        );

        process.exitCode =
          1;
      }

      await prisma.$disconnect();
    }
  );