
import "dotenv/config";

import express from "express";
import type { AddressInfo } from "node:net";

import { testUserToken } from "./helpers/testUserToken";

import {
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../src/generated/prisma/client";

import { prisma } from "../src/lib/prisma";

import {
  requireAuth,
  requireVendorAccount,
  requireVendorOrderFulfillment,
} from "../src/middleware/auth.middleware";

const TEST_EMAILS = [
  "order-active@campusmart.local",
  "order-pending@campusmart.local",
  "order-restricted@campusmart.local",
  "order-suspended@campusmart.local",
  "order-buyer@campusmart.local",
];

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${message}`);
    return;
  }
  failed += 1;
  console.error(`FAIL  ${message}`);
}

async function cleanup() {
  await prisma.user.deleteMany({
    where: {
      email: { in: TEST_EMAILS },
    },
  });
}

async function createVendor({
  email,
  studentVerificationStatus,
  accessStatus,
}: {
  email: string;
  studentVerificationStatus: StudentVerificationStatus;
  accessStatus: VendorAccessStatus;
}) {
  return prisma.user.create({
    data: {
      name: "Order Access Test Seller",
      email,
      passwordHash: "test-only-not-a-login-hash",
      role: UserRole.vendor,
      fallbackUniversityName: "CampusMart Test University",
      fallbackState: "Test State",
      fallbackCity: "Test City",
      studentVerificationStatus,
      vendorProfile: {
        create: {
          businessName: "Order Access Test Shop",
          businessDescription:
            "Temporary order access test shop.",
          pickupLocation: "Test Campus",
          accessStatus,
        },
      },
    },
    select: {
      id: true,
      role: true,
      passwordHash: true,
    },
  });
}

async function createBuyer() {
  return prisma.user.create({
    data: {
      name: "Order Access Test Buyer",
      email: TEST_EMAILS[4],
      passwordHash: "test-only-not-a-login-hash",
      role: UserRole.client,
    },
    select: {
      id: true,
      role: true,
      passwordHash: true,
    },
  });
}

function makeToken(user: {
  id: string;
  role: UserRole;
  passwordHash: string;
}) {
  return testUserToken(user, "10m");
}

async function request(
  baseUrl: string,
  path: string,
  token: string,
  method: "GET" | "PATCH"
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body:
      method === "PATCH"
        ? JSON.stringify({ status: "confirmed" })
        : undefined,
  });

  const data = await response.json().catch(() => null);

  return {
    status: response.status,
    data,
  };
}

async function main() {
  console.log("");
  console.log("CampusMart vendor order access tests");
  console.log("------------------------------------");

  await cleanup();

  const app = express();
  app.use(express.json());

  app.get(
    "/orders",
    requireAuth,
    requireVendorAccount,
    (req, res) => {
      return res.status(200).json({
        success: true,
        message: "Order history available.",
      });
    }
  );

  app.patch(
    "/orders/status",
    requireAuth,
    requireVendorOrderFulfillment,
    (req, res) => {
      return res.status(200).json({
        success: true,
        message: "Order fulfilment action allowed.",
      });
    }
  );

  const server = app.listen(0, "127.0.0.1");

  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", reject);
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const active = await createVendor({
      email: TEST_EMAILS[0],
      studentVerificationStatus:
        StudentVerificationStatus.verified,
      accessStatus: VendorAccessStatus.active,
    });

    const activeToken = makeToken(active);

    const activeView = await request(
      baseUrl, "/orders", activeToken, "GET"
    );

    assert(
      activeView.status === 200,
      "Active seller can view existing orders"
    );

    const activeFulfil = await request(
      baseUrl, "/orders/status", activeToken, "PATCH"
    );

    assert(
      activeFulfil.status === 200,
      "Active seller can fulfil existing orders"
    );

    const pending = await createVendor({
      email: TEST_EMAILS[1],
      studentVerificationStatus:
        StudentVerificationStatus.not_started,
      accessStatus: VendorAccessStatus.pending_review,
    });

    const pendingToken = makeToken(pending);

    const pendingView = await request(
      baseUrl, "/orders", pendingToken, "GET"
    );

    assert(
      pendingView.status === 200,
      "Pending-review seller can view existing orders"
    );

    const pendingFulfil = await request(
      baseUrl, "/orders/status", pendingToken, "PATCH"
    );

    assert(
      pendingFulfil.status === 200,
      "Pending-review seller can fulfil existing orders"
    );

    const restricted = await createVendor({
      email: TEST_EMAILS[2],
      studentVerificationStatus:
        StudentVerificationStatus.verified,
      accessStatus: VendorAccessStatus.restricted,
    });

    const restrictedToken = makeToken(restricted);

    const restrictedView = await request(
      baseUrl, "/orders", restrictedToken, "GET"
    );

    assert(
      restrictedView.status === 200,
      "Restricted seller can view order history"
    );

    const restrictedFulfil = await request(
      baseUrl, "/orders/status", restrictedToken, "PATCH"
    );

    assert(
      restrictedFulfil.status === 403 &&
        restrictedFulfil.data?.code ===
          "SELLER_ORDER_ACTIONS_RESTRICTED",
      "Restricted seller cannot perform order actions"
    );

    const suspended = await createVendor({
      email: TEST_EMAILS[3],
      studentVerificationStatus:
        StudentVerificationStatus.verified,
      accessStatus: VendorAccessStatus.suspended,
    });

    const suspendedToken = makeToken(suspended);

    const suspendedView = await request(
      baseUrl, "/orders", suspendedToken, "GET"
    );

    assert(
      suspendedView.status === 200,
      "Suspended seller can view order history"
    );

    const suspendedFulfil = await request(
      baseUrl, "/orders/status", suspendedToken, "PATCH"
    );

    assert(
      suspendedFulfil.status === 403 &&
        suspendedFulfil.data?.code ===
          "SELLER_ORDER_ACTIONS_SUSPENDED",
      "Suspended seller cannot perform order actions"
    );

    const buyer = await createBuyer();
    const buyerToken = makeToken(buyer);

    const buyerView = await request(
      baseUrl, "/orders", buyerToken, "GET"
    );

    assert(
      buyerView.status === 403,
      "Buyer cannot access seller order history"
    );

    const buyerFulfil = await request(
      baseUrl, "/orders/status", buyerToken, "PATCH"
    );

    assert(
      buyerFulfil.status === 403,
      "Buyer cannot perform seller order actions"
    );

    console.log("");
    console.log("Vendor order access test summary");
    console.log("--------------------------------");
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed === 0) {
      console.log("");
      console.log("All vendor order access tests passed.");
    } else {
      process.exitCode = 1;
    }
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "Vendor order access test failed unexpectedly:"
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
      console.log("");
      console.log("Temporary order access accounts removed.");
    } catch (cleanupError) {
      console.error(
        "Temporary account cleanup failed:",
        cleanupError
      );
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
