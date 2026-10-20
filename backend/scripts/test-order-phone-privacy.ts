
import "dotenv/config";

import { handoffDeadline } from "../src/services/orderDeadline.service";
import { testUserToken } from "./helpers/testUserToken";
import app from "../src/app";

import {
  OrderStatus,
  PaymentStatus,
  PickupPointType,
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../src/generated/prisma/client";

import { prisma } from "../src/lib/prisma";

/*
 * Privacy contract:
 * - Buyer phone: paid + seller-confirmed only
 * - Seller pickup snapshot: visible immediately
 * - Other sellers' pickup snapshots: never visible
 * - Legacy global pickup and preferred slot: buyer-only
 * - Fulfilment secrets: never exposed to sellers
 */

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET is not set.");

const suffix =
  `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const buyerPhone = "08123456789";

const pickupA = `Vendor A Campus Gate ${suffix}`;
const pickupB = `Vendor B Library Door ${suffix}`;

const oldGlobalPickup =
  `Old Buyer Global Location ${suffix}`;

const oldPreferredSlot =
  `Old Buyer Private Time ${suffix}`;

const detailA = `Seller A handoff details ${suffix}`;
const detailB = `Seller B handoff details ${suffix}`;

let passed = 0;
let failed = 0;

let universityId: string | null = null;
let buyerId: string | null = null;
let vendorAId: string | null = null;
let vendorBId: string | null = null;
let orderId: string | null = null;

function check(
  condition: unknown,
  description: string
) {
  const label = `${passed + failed + 1}`;

  if (condition) {
    passed++;
    console.log(`PASS ${label}: ${description}`);
  } else {
    failed++;
    console.error(`FAIL ${label}: ${description}`);
  }
}

async function api(
  base: string,
  path: string,
  authToken: string,
  method: "GET" | "PATCH" = "GET",
  data?: unknown
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${authToken}`,
      ...(data === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      data === undefined
        ? undefined
        : JSON.stringify(data),
  });

  const raw = await response.text();
  let body: any = null;

  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }

  return {
    status: response.status,
    body,
  };
}

function findOrder(
  response: any,
  id: string
): any {
  return response?.body?.orders?.find(
    (order: any) => order.id === id
  );
}

function phoneIsLocked(order: any) {
  return (
    order?.buyer?.phone === null &&
    order?.buyer?.phoneUnlocked === false &&
    order?.buyer?.phoneAvailable === false
  );
}

function phoneIsUnlocked(order: any) {
  return (
    order?.buyer?.phone === buyerPhone &&
    order?.buyer?.phoneUnlocked === true &&
    order?.buyer?.phoneAvailable === true
  );
}

function pickupIsOwn(
  order: any,
  ownLabel: string,
  ownDetail: string
) {
  return (
    order?.pickupPoint?.label === ownLabel &&
    order?.pickupPoint?.detail === ownDetail &&
    order?.pickupLocation ===
      `${ownLabel} - ${ownDetail}` &&
    order?.pickupLocationUnlocked === true &&
    order?.pickupLocationAvailable === true
  );
}

function hasForbiddenSellerData(
  value: unknown,
  otherLabel: string,
  otherDetail: string
) {
  const raw = JSON.stringify(value ?? {});

  return (
    raw.includes(otherLabel) ||
    raw.includes(otherDetail) ||
    raw.includes(oldGlobalPickup) ||
    raw.includes(oldPreferredSlot) ||
    raw.includes("codeHash") ||
    raw.includes("codeCiphertext")
  );
}

function preferredSlotIsHidden(order: any) {
  return (
    order?.preferredSlot === null &&
    order?.preferredSlotUnlocked === false &&
    order?.preferredSlotAvailable === false
  );
}

async function cleanup() {
  if (orderId) {
    await prisma.order.deleteMany({
      where: { id: orderId },
    });
  }

  const ids = [
    buyerId,
    vendorAId,
    vendorBId,
  ].filter(
    (v): v is string => Boolean(v)
  );

  if (ids.length) {
    await prisma.user.deleteMany({
      where: {
        id: { in: ids },
      },
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
    "\nCampusMart order privacy / pickup isolation test\n"
  );

  const university = await prisma.university.create({
    data: {
      name: `Order Privacy University ${suffix}`,
      shortName: "OPU",
      slug: `order-privacy-${suffix}`,
      country: "Nigeria",
      state: "Rivers",
      city: "Port Harcourt",
      active: true,
    },
  });

  universityId = university.id;

  const buyer = await prisma.user.create({
    data: {
      name: "Order Privacy Buyer",
      email: `privacy-buyer-${suffix}@example.com`,
      passwordHash: "test-password-hash",
      role: UserRole.client,
      universityId: university.id,
      phone: buyerPhone,
    },
  });

  buyerId = buyer.id;

  async function createVendor(letter: "A" | "B") {
    return prisma.user.create({
      data: {
        name: `Order Privacy Seller ${letter}`,
        email:
          `privacy-vendor-${letter}-${suffix}@example.com`,
        passwordHash: "test-password-hash",
        role: UserRole.vendor,
        universityId: university.id,
        matricNumber: `OP${letter}-${suffix}`,
        studentVerificationStatus:
          StudentVerificationStatus.verified,
        studentVerifiedAt: new Date(),
        vendorProfile: {
          create: {
            businessName: `Order Privacy Store ${letter}`,
            businessDescription:
              `Seller ${letter} test store.`,
            pickupLocation:
              `Seller ${letter} configured pickup`,
            accessStatus: VendorAccessStatus.active,
          },
        },
      },
    });
  }

  const vendorA = await createVendor("A");
  vendorAId = vendorA.id;

  const vendorB = await createVendor("B");
  vendorBId = vendorB.id;

  const order = await prisma.order.create({
    data: {
      buyerId: buyer.id,
      status: OrderStatus.pending,
      paymentStatus: PaymentStatus.pending,
      subtotal: 30000,
      fee: 50,
      total: 30050,

      pickupLocation: oldGlobalPickup,
      preferredSlot: oldPreferredSlot,

      items: {
        create: [
          {
            vendorId: vendorA.id,
            productTitle: "Seller A Item",
            unitPrice: 15000,
            quantity: 1,
            lineTotal: 15000,
            status: OrderStatus.pending,
          },
          {
            vendorId: vendorB.id,
            productTitle: "Seller B Item",
            unitPrice: 15000,
            quantity: 1,
            lineTotal: 15000,
            status: OrderStatus.pending,
          },
        ],
      },

      vendorPickupSelections: {
        create: [
          {
            vendorId: vendorA.id,
            type: PickupPointType.campus,
            label: pickupA,
            detail: detailA,
          },
          {
            vendorId: vendorB.id,
            type: PickupPointType.faculty_building,
            label: pickupB,
            detail: detailB,
          },
        ],
      },
    },
  });

  orderId = order.id;

  const buyerToken = testUserToken(buyer);
  const tokenA = testUserToken(vendorA);
  const tokenB = testUserToken(vendorB);

  const server = await new Promise<
    ReturnType<typeof app.listen>
  >((resolve, reject) => {
    const instance = app.listen(
      0, "127.0.0.1", () => resolve(instance)
    );
    instance.once("error", reject);
  });

  try {
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("No test port");
    }

    const base = `http://127.0.0.1:${address.port}`;

    const vendorRoute = "/api/orders/vendor";
    const pickupRoute =
      `/api/orders/${order.id}/pickup-selections`;
    const timingRoute = "/api/orders/timings";
    const statusRoute =
      `/api/orders/vendor/${order.id}/status`;
    const singleRoute = `/api/orders/${order.id}`;

    // PENDING ORDERS

    const pendingA = findOrder(
      await api(base, vendorRoute, tokenA),
      order.id
    );

    const pendingB = findOrder(
      await api(base, vendorRoute, tokenB),
      order.id
    );

    check(
      pendingA?.vendorStatus === OrderStatus.pending &&
        phoneIsLocked(pendingA),
      "Seller A pending phone is locked"
    );

    check(
      pendingB?.vendorStatus === OrderStatus.pending &&
        phoneIsLocked(pendingB),
      "Seller B pending phone is locked"
    );

    check(
      pickupIsOwn(pendingA, pickupA, detailA),
      "Seller A sees own selected pickup immediately"
    );

    check(
      pickupIsOwn(pendingB, pickupB, detailB),
      "Seller B sees own selected pickup immediately"
    );

    check(
      !hasForbiddenSellerData(pendingA, pickupB, detailB),
      "Seller A response excludes Seller B pickup, global legacy pickup and preferred slot"
    );

    check(
      !hasForbiddenSellerData(pendingB, pickupA, detailA),
      "Seller B response excludes Seller A pickup, global legacy pickup and preferred slot"
    );

    check(
      preferredSlotIsHidden(pendingA) &&
        preferredSlotIsHidden(pendingB),
      "No seller sees deprecated preferredSlot"
    );

    // PICKUP ENDPOINT

    const pickupForA = await api(
      base, pickupRoute, tokenA
    );

    const pickupForB = await api(
      base, pickupRoute, tokenB
    );

    check(
      pickupForA.status === 200 &&
        pickupForA.body?.pickupSelection?.label ===
          pickupA &&
        !hasForbiddenSellerData(
          pickupForA.body, pickupB, detailB
        ),
      "Seller A pickup endpoint only returns Seller A snapshot"
    );

    check(
      pickupForB.status === 200 &&
        pickupForB.body?.pickupSelection?.label ===
          pickupB &&
        !hasForbiddenSellerData(
          pickupForB.body, pickupA, detailA
        ),
      "Seller B pickup endpoint only returns Seller B snapshot"
    );

    check(
      pickupForA.body?.preferredSlot === null &&
        pickupForA.body?.preferredSlotUnlocked === false &&
        pickupForB.body?.preferredSlot === null,
      "Pickup endpoint hides preferredSlot from both sellers"
    );

    const pickupForBuyer = await api(
      base, pickupRoute, buyerToken
    );

    check(
      pickupForBuyer.status === 200 &&
        pickupForBuyer.body?.pickupSelections?.length === 2 &&
        pickupForBuyer.body?.preferredSlot ===
          oldPreferredSlot,
      "Buyer sees both pickup snapshots and own historical slot"
    );

    // TIMING ACCESS

    const pendingTiming = await api(
      base, timingRoute, tokenA
    );

    const firstTiming =
      pendingTiming.body?.timings?.find(
        (x: any) => x.orderId === order.id
      );

    check(
      pendingTiming.status === 200 &&
        pendingTiming.body?.timings?.filter(
          (x: any) => x.orderId === order.id
        ).length === 1 &&
        firstTiming?.vendorId === vendorA.id &&
        firstTiming?.status === OrderStatus.pending,
      "Seller A timing endpoint is isolated from Seller B"
    );

    // SELLER A CONFIRMS, UNPAID

    const confirmedA = await api(
      base, statusRoute, tokenA, "PATCH",
      { status: "confirmed" }
    );

    const responseA = confirmedA.body?.order;

    check(
      confirmedA.status === 200 &&
        responseA?.vendorStatus === OrderStatus.confirmed &&
        phoneIsLocked(responseA),
      "Unpaid Seller A confirmation still hides phone"
    );

    check(
      pickupIsOwn(responseA, pickupA, detailA) &&
        !hasForbiddenSellerData(
          responseA, pickupB, detailB
        ),
      "Seller A confirmation exposes only its own pickup"
    );

    check(
      preferredSlotIsHidden(responseA),
      "Seller A confirmation hides retired preferred slot"
    );

    const firstConfirmedAt = Date.parse(
      responseA?.confirmedAt ?? ""
    );

    const firstDueAt = Date.parse(
      responseA?.deliveryDueAt ?? ""
    );

    check(
      Number.isFinite(firstConfirmedAt) &&
        firstDueAt ===
          handoffDeadline(
            new Date(firstConfirmedAt)
          ).getTime(),
      "Confirmation saves exact 72-hour delivery deadline"
    );

    const confirmAgain = await api(
      base, statusRoute, tokenA, "PATCH",
      { status: "confirmed" }
    );

    check(
      confirmAgain.status === 200 &&
        Date.parse(
          confirmAgain.body?.order?.confirmedAt ?? ""
        ) === firstConfirmedAt &&
        Date.parse(
          confirmAgain.body?.order?.deliveryDueAt ?? ""
        ) === firstDueAt,
      "Repeated confirmation cannot reset Seller A deadline"
    );

    const unpaidAHistory = findOrder(
      await api(base, vendorRoute, tokenA),
      order.id
    );

    check(
      phoneIsLocked(unpaidAHistory) &&
        pickupIsOwn(
          unpaidAHistory, pickupA, detailA
        ),
      "Unpaid confirmed Seller A keeps pickup but not phone"
    );

    const stillPendingB = findOrder(
      await api(base, vendorRoute, tokenB),
      order.id
    );

    check(
      stillPendingB?.vendorStatus ===
        OrderStatus.pending &&
        phoneIsLocked(stillPendingB) &&
        pickupIsOwn(
          stillPendingB, pickupB, detailB
        ),
      "Seller B unaffected by Seller A confirmation"
    );

    // PAYMENT STATUS TEST (NO LIVE PAYMENT PROCESSOR)

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.paid,
      },
    });

    const paidA = findOrder(
      await api(base, vendorRoute, tokenA),
      order.id
    );

    const paidPendingB = findOrder(
      await api(base, vendorRoute, tokenB),
      order.id
    );

    check(
      phoneIsUnlocked(paidA) &&
        pickupIsOwn(paidA, pickupA, detailA),
      "Paid + confirmed unlocks phone only for Seller A"
    );

    check(
      phoneIsLocked(paidPendingB) &&
        pickupIsOwn(
          paidPendingB, pickupB, detailB
        ),
      "Paid + pending still hides Seller B buyer phone"
    );

    // INDIVIDUAL ORDER ENDPOINT

    const individualA = (
      await api(base, singleRoute, tokenA)
    ).body?.order;

    const individualB = (
      await api(base, singleRoute, tokenB)
    ).body?.order;

    check(
      phoneIsUnlocked(individualA) &&
        pickupIsOwn(
          individualA, pickupA, detailA
        ) &&
        !hasForbiddenSellerData(
          individualA, pickupB, detailB
        ),
      "Seller A individual order respects privacy and pickup isolation"
    );

    check(
      phoneIsLocked(individualB) &&
        pickupIsOwn(
          individualB, pickupB, detailB
        ) &&
        !hasForbiddenSellerData(
          individualB, pickupA, detailA
        ),
      "Seller B individual order respects privacy and pickup isolation"
    );

    check(
      individualA?.items?.length === 1 &&
        individualA.items[0].vendorId === vendorA.id &&
        individualB?.items?.length === 1 &&
        individualB.items[0].vendorId === vendorB.id,
      "Seller individual order contains only its own items"
    );

    // SELLER B CONFIRMS INDEPENDENTLY

    const confirmedB = await api(
      base, statusRoute, tokenB, "PATCH",
      { status: "confirmed" }
    );

    check(
      confirmedB.status === 200 &&
        phoneIsUnlocked(confirmedB.body?.order) &&
        pickupIsOwn(
          confirmedB.body?.order, pickupB, detailB
        ),
      "Seller B independently unlocks phone when paid and confirmed"
    );

    const dueB = Date.parse(
      confirmedB.body?.order?.deliveryDueAt ?? ""
    );

    check(
      Number.isFinite(dueB) &&
        dueB >= firstDueAt,
      "Seller B has independent delivery deadline"
    );

    check(
      phoneIsUnlocked(
        findOrder(
          await api(base, vendorRoute, tokenB),
          order.id
        )
      ),
      "Seller B history reflects its own confirmed access"
    );

    // SELLER A COMPLETES

    await prisma.orderItem.updateMany({
      where: {
        orderId: order.id,
        vendorId: vendorA.id,
      },
      data: {
        status: OrderStatus.completed,
      },
    });

    const completedA = findOrder(
      await api(base, vendorRoute, tokenA),
      order.id
    );

    const completedIndividualA = (
      await api(base, singleRoute, tokenA)
    ).body?.order;

    check(
      completedA?.vendorStatus === OrderStatus.completed &&
        phoneIsLocked(completedA) &&
        pickupIsOwn(
          completedA, pickupA, detailA
        ),
      "Completed Seller A loses phone but retains its historical pickup snapshot"
    );

    check(
      phoneIsLocked(completedIndividualA) &&
        pickupIsOwn(
          completedIndividualA, pickupA, detailA
        ),
      "Completed Seller A individual order protects phone"
    );

    check(
      phoneIsUnlocked(
        findOrder(
          await api(base, vendorRoute, tokenB),
          order.id
        )
      ),
      "Seller B keeps access while independently confirmed"
    );

    // SELLER B CANCELS

    const cancelledB = await api(
      base, statusRoute, tokenB, "PATCH",
      { status: "cancelled" }
    );

    check(
      cancelledB.status === 200 &&
        cancelledB.body?.order?.vendorStatus ===
          OrderStatus.cancelled &&
        phoneIsLocked(cancelledB.body?.order) &&
        pickupIsOwn(
          cancelledB.body?.order, pickupB, detailB
        ),
      "Cancellation immediately re-locks Seller B phone without exposing other seller pickup"
    );

    const cancelledBHistory = findOrder(
      await api(base, vendorRoute, tokenB),
      order.id
    );

    check(
      phoneIsLocked(cancelledBHistory) &&
        !hasForbiddenSellerData(
          cancelledBHistory, pickupA, detailA
        ),
      "Cancelled Seller B history stays isolated"
    );

    // BUYER HISTORY

    const buyerOrder = (
      await api(base, singleRoute, buyerToken)
    ).body?.order;

    check(
      buyerOrder?.buyer?.phone === buyerPhone &&
        buyerOrder?.pickupLocation === oldGlobalPickup &&
        buyerOrder?.preferredSlot === oldPreferredSlot,
      "Buyer retains access to own historical order information"
    );

    const buyerHistory = findOrder(
      await api(base, "/api/orders/mine", buyerToken),
      order.id
    );

    check(
      buyerHistory?.pickupLocation === oldGlobalPickup &&
        buyerHistory?.preferredSlot === oldPreferredSlot,
      "Buyer order history preserves old data"
    );

    const finalTimingA = await api(
      base, timingRoute, tokenA
    );

    check(
      finalTimingA.status === 200 &&
        finalTimingA.body?.timings?.filter(
          (x: any) => x.orderId === order.id
        ).length === 1,
      "Seller timing endpoint never returns another seller's portion"
    );

    console.log(
      "\n----------------------------------------"
    );
    console.log(
      `Order privacy tests: ${passed} passed / ${failed} failed`
    );
    console.log(
      "----------------------------------------\n"
    );

    if (failed) process.exitCode = 1;
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) =>
        error ? reject(error) : resolve()
      );
    });
  }
}

main()
  .catch((error) => {
    console.error("\nOrder privacy test crashed:\n", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (error) {
      console.error("Order privacy cleanup failed:", error);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
