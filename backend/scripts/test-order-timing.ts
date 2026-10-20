
import "dotenv/config";

import { handoffDeadline } from "../src/services/orderDeadline.service";
import { testUserToken } from "./helpers/testUserToken";
import app from "../src/app";

import {
  OrderStatus,
  PaymentStatus,
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../src/generated/prisma/client";

import { prisma } from "../src/lib/prisma";

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET is not set.");

const tag =
  `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const HOUR = 60 * 60 * 1000;

let passed = 0;
let failed = 0;

let universityId: string | null = null;
let orderId: string | null = null;
const createdUsers: string[] = [];

function check(condition: unknown, description: string) {
  const label = passed + failed + 1;
  if (condition) {
    passed++;
    console.log(`PASS ${label}: ${description}`);
  } else {
    failed++;
    console.error(`FAIL ${label}: ${description}`);
  }
}

async function request(
  base: string,
  path: string,
  token?: string,
  method: "GET" | "PATCH" = "GET",
  body?: unknown
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

function entries(result: any, targetOrderId: string) {
  return (result.data?.timings ?? []).filter(
    (entry: any) => entry.orderId === targetOrderId
  );
}

async function cleanup() {
  if (orderId) {
    await prisma.order.deleteMany({
      where: { id: orderId },
    });
  }

  if (createdUsers.length) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUsers } },
    });
  }

  if (universityId) {
    await prisma.university.deleteMany({
      where: { id: universityId },
    });
  }
}

async function main() {
  console.log(
    "\nCampusMart seller confirmation and delivery timing test\n"
  );

  let server: ReturnType<typeof app.listen> | null = null;

  try {
    const university = await prisma.university.create({
      data: {
        name: `Order Timing Test University ${tag}`,
        shortName: "OTT",
        slug: `order-timing-${tag}`,
        state: "Rivers",
        city: "Port Harcourt",
        active: true,
      },
    });

    universityId = university.id;

    const buyer = await prisma.user.create({
      data: {
        name: "Timing Test Buyer",
        email: `timing-buyer-${tag}@example.com`,
        passwordHash: "test-password-hash",
        role: UserRole.client,
        universityId: university.id,
        phone: "08123456789",
      },
    });

    createdUsers.push(buyer.id);

    async function createVendor(letter: string) {
      const user = await prisma.user.create({
        data: {
          name: `Timing Test Seller ${letter}`,
          email: `timing-seller-${letter}-${tag}@example.com`,
          passwordHash: "test-password-hash",
          role: UserRole.vendor,
          universityId: university.id,
          matricNumber: `TIM-${letter}-${tag}`,
          studentVerificationStatus:
            StudentVerificationStatus.verified,
          studentVerifiedAt: new Date(),
          vendorProfile: {
            create: {
              businessName: `Timing Store ${letter}`,
              businessDescription: "Temporary test store",
              pickupLocation: "Test campus pickup",
              accessStatus: VendorAccessStatus.active,
            },
          },
        },
      });
      createdUsers.push(user.id);
      return user;
    }

    const sellerA = await createVendor("A");
    const sellerB = await createVendor("B");
    const unrelatedSeller = await createVendor("C");

    const order = await prisma.order.create({
      data: {
        buyerId: buyer.id,
        status: OrderStatus.pending,
        paymentStatus: PaymentStatus.pending,
        subtotal: 20000,
        fee: 0,
        total: 20000,
        items: {
          create: [
            {
              vendorId: sellerA.id,
              productTitle: "Timing test A",
              unitPrice: 10000,
              quantity: 1,
              lineTotal: 10000,
              status: OrderStatus.pending,
            },
            {
              vendorId: sellerB.id,
              productTitle: "Timing test B",
              unitPrice: 10000,
              quantity: 1,
              lineTotal: 10000,
              status: OrderStatus.pending,
            },
          ],
        },
      },
    });

    orderId = order.id;

    server = await new Promise<
      ReturnType<typeof app.listen>
    >((resolve, reject) => {
      const instance = app.listen(
        0, "127.0.0.1", () => resolve(instance)
      );
      instance.once("error", reject);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("No test HTTP port");
    }

    const base = `http://127.0.0.1:${address.port}`;

    const buyerToken = testUserToken(buyer);
    const tokenA = testUserToken(sellerA);
    const tokenB = testUserToken(sellerB);
    const tokenC = testUserToken(unrelatedSeller);

    const timingPath = "/api/orders/timings";
    const statusPath = `/api/orders/vendor/${order.id}/status`;

    const unauthenticated = await request(base, timingPath);

    check(
      unauthenticated.status === 401,
      "Timings require authentication"
    );

    const initialBuyer = await request(
      base, timingPath, buyerToken
    );

    const initialBuyerEntries = entries(
      initialBuyer, order.id
    );

    check(
      initialBuyer.status === 200 &&
        initialBuyerEntries.length === 2,
      "Buyer sees both seller portions"
    );

    check(
      initialBuyerEntries.every(
        (t: any) =>
          t.status === OrderStatus.pending &&
          t.confirmedAt === null &&
          t.deliveryDueAt === null
      ),
      "Unconfirmed sellers have no delivery countdown"
    );

    check(
      initialBuyerEntries.every(
        (t: any) =>
          Date.parse(t.confirmationDueAt) -
            order.createdAt.getTime() ===
          24 * HOUR
      ),
      "Confirmation deadline equals order creation + 24 hours"
    );

    const initialA = await request(base, timingPath, tokenA);
    const initialB = await request(base, timingPath, tokenB);
    const initialC = await request(base, timingPath, tokenC);

    check(
      entries(initialA, order.id).length === 1 &&
        entries(initialA, order.id)[0].vendorId ===
          sellerA.id,
      "Seller A sees only their timing"
    );

    check(
      entries(initialB, order.id).length === 1 &&
        entries(initialB, order.id)[0].vendorId ===
          sellerB.id,
      "Seller B sees only their timing"
    );

    check(
      entries(initialC, order.id).length === 0,
      "Unrelated seller cannot see timing"
    );

    check(
      !JSON.stringify(initialBuyer.data).includes("codeHash") &&
        !JSON.stringify(initialA.data).includes("phone"),
      "Timing endpoint leaks no fulfilment secrets or phone"
    );

    const confirmedA = await request(
      base, statusPath, tokenA, "PATCH",
      { status: "confirmed" }
    );

    const timeA = confirmedA.data?.order;

    check(
      confirmedA.status === 200 &&
        timeA?.vendorStatus === OrderStatus.confirmed,
      "Seller A confirms their portion"
    );

    const confirmedAtA = Date.parse(
      timeA?.confirmedAt ?? ""
    );

    const dueAtA = Date.parse(
      timeA?.deliveryDueAt ?? ""
    );

    check(
      Number.isFinite(confirmedAtA) &&
        dueAtA ===
          handoffDeadline(new Date(confirmedAtA)).getTime(),
      "Seller A deadline is exactly 72 hours after confirmation"
    );

    const storedA =
      await prisma.orderVendorFulfillment.findUnique({
        where: {
          orderId_vendorId: {
            orderId: order.id,
            vendorId: sellerA.id,
          },
        },
      });

    check(
      storedA?.confirmedAt?.getTime() === confirmedAtA &&
        storedA?.deliveryDueAt?.getTime() === dueAtA,
      "Seller A timestamps persist in database"
    );

    const afterA = entries(
      await request(base, timingPath, buyerToken),
      order.id
    );

    const portionB = afterA.find(
      (entry: any) => entry.vendorId === sellerB.id
    );

    check(
      portionB?.status === OrderStatus.pending &&
        portionB.confirmedAt === null,
      "Seller B timer has not started"
    );

    const repeatedA = await request(
      base, statusPath, tokenA, "PATCH",
      { status: "confirmed" }
    );

    check(
      repeatedA.status === 200 &&
        Date.parse(
          repeatedA.data?.order?.confirmedAt
        ) === confirmedAtA &&
        Date.parse(
          repeatedA.data?.order?.deliveryDueAt
        ) === dueAtA,
      "Reconfirming cannot restart Seller A timer"
    );

    const buyerCannotConfirm = await request(
      base, statusPath, buyerToken, "PATCH",
      { status: "confirmed" }
    );

    check(
      buyerCannotConfirm.status === 403,
      "Buyer cannot confirm a seller portion"
    );

    const unrelatedCannotConfirm = await request(
      base, statusPath, tokenC, "PATCH",
      { status: "confirmed" }
    );

    check(
      unrelatedCannotConfirm.status >= 400,
      "Unrelated seller cannot modify this order"
    );

    const confirmedB = await request(
      base, statusPath, tokenB, "PATCH",
      { status: "confirmed" }
    );

    const confirmedAtB = Date.parse(
      confirmedB.data?.order?.confirmedAt ?? ""
    );

    const dueAtB = Date.parse(
      confirmedB.data?.order?.deliveryDueAt ?? ""
    );

    check(
      confirmedB.status === 200 &&
        Number.isFinite(confirmedAtB) &&
        dueAtB ===
          handoffDeadline(new Date(confirmedAtB)).getTime(),
      "Seller B gets an independent 72-hour timer"
    );

    const afterB = entries(
      await request(base, timingPath, buyerToken),
      order.id
    );

    const newA = afterB.find(
      (entry: any) => entry.vendorId === sellerA.id
    );

    check(
      afterB.length === 2 &&
        newA?.confirmedAt ===
          new Date(confirmedAtA).toISOString() &&
        newA?.deliveryDueAt ===
          new Date(dueAtA).toISOString(),
      "Seller B confirmation does not change Seller A deadline"
    );

    const directComplete = await request(
      base, statusPath, tokenA, "PATCH",
      { status: "completed" }
    );

    check(
      directComplete.status === 400 &&
        directComplete.data?.code ===
          "FULFILLMENT_CODE_REQUIRED",
      "Direct completion requires buyer code"
    );

    const overdueDate = new Date(
      Date.now() - 3 * HOUR
    );

    await prisma.orderVendorFulfillment.update({
      where: {
        orderId_vendorId: {
          orderId: order.id,
          vendorId: sellerA.id,
        },
      },
      data: {
        confirmedAt: new Date(
          overdueDate.getTime() - 72 * HOUR
        ),
        deliveryDueAt: overdueDate,
      },
    });

    const overdueA = entries(
      await request(base, timingPath, tokenA),
      order.id
    )[0];

    check(
      Date.parse(overdueA?.deliveryDueAt ?? "") <
        Date.now() &&
        overdueA?.status === OrderStatus.confirmed,
      "Expired deadline does not auto-cancel order"
    );

    const storedItemA = await prisma.orderItem.findFirst({
      where: {
        orderId: order.id,
        vendorId: sellerA.id,
      },
      select: { status: true },
    });

    check(
      storedItemA?.status === OrderStatus.confirmed,
      "Overdue seller item stays confirmed"
    );

    const cancelB = await request(
      base, statusPath, tokenB, "PATCH",
      { status: "cancelled" }
    );

    const afterCancel = entries(
      await request(base, timingPath, buyerToken),
      order.id
    );

    check(
      cancelB.status === 200 &&
        afterCancel.find(
          (entry: any) => entry.vendorId === sellerB.id
        )?.status === OrderStatus.cancelled,
      "Seller B cancellation is seller-specific"
    );

    check(
      afterCancel.find(
        (entry: any) => entry.vendorId === sellerA.id
      )?.status === OrderStatus.confirmed,
      "Seller A remains confirmed after Seller B cancels"
    );

    console.log(
      `\nOrder timing tests: ${passed} passed / ${failed} failed\n`
    );

    if (failed) process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) =>
          error ? reject(error) : resolve()
        )
      );
    }
    await cleanup();
  }
}

main()
  .catch((error) => {
    console.error("Order timing test crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
