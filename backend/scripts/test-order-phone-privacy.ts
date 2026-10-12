import "dotenv/config";

import jwt from "jsonwebtoken";

import app from "../src/app";

import {
  OrderStatus,
  PaymentStatus,
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

/*
 * =======================================================
 * CAMPUSMART ORDER PRIVACY TEST
 * =======================================================
 *
 * Proves seller-specific privacy for:
 *
 * - buyer phone
 * - buyer-selected order pickup location
 * - buyer-selected preferred slot / availability
 *
 * Privacy window:
 *
 * UNPAID + PENDING
 *   phone          -> hidden
 *   pickup         -> hidden
 *   preferred slot -> hidden
 *
 * UNPAID + CONFIRMED
 *   phone          -> hidden
 *   pickup         -> hidden
 *   preferred slot -> hidden
 *
 * PAID + PENDING
 *   phone          -> hidden
 *   pickup         -> hidden
 *   preferred slot -> hidden
 *
 * PAID + CONFIRMED
 *   phone          -> visible
 *   pickup         -> visible
 *   preferred slot -> visible
 *
 * COMPLETED / CANCELLED
 *   phone          -> hidden again
 *   pickup         -> hidden again
 *   preferred slot -> hidden again
 *
 * Also proves:
 *
 * - multi-vendor isolation
 * - seller list endpoint privacy
 * - seller individual-order privacy
 * - seller status-update response privacy
 * - buyer still sees their own private order data
 * - seller individual order contains only that seller's items
 * - raw private fulfilment data is not leaked elsewhere
 */

/*
 * =======================================================
 * TEST HARNESS
 * =======================================================
 */

let passed =
  0;

let failed =
  0;

function check(
  condition: unknown,
  label: string
) {
  const number =
    passed +
    failed +
    1;

  if (
    condition
  ) {
    passed +=
      1;

    console.log(
      `PASS ${number}: ${label}`
    );

    return;
  }

  failed +=
    1;

  console.error(
    `FAIL ${number}: ${label}`
  );
}

/*
 * =======================================================
 * ENVIRONMENT
 * =======================================================
 */

const jwtSecret =
  process.env.JWT_SECRET;

if (
  !jwtSecret
) {
  throw new Error(
    "JWT_SECRET is not set."
  );
}

/*
 * =======================================================
 * TEST DATA
 * =======================================================
 */

const suffix =
  `${Date.now().toString(
    36
  )}-${Math.random()
    .toString(36)
    .slice(
      2,
      8
    )}`;

const buyerPhone =
  "08123456789";

const buyerPickupLocation =
  "Private Buyer Pickup - Campus Library Gate";

const buyerPreferredSlot =
  "After my 4:30 PM lecture";

let universityId:
  string | null =
    null;

let buyerId:
  string | null =
    null;

let vendorAId:
  string | null =
    null;

let vendorBId:
  string | null =
    null;

let orderId:
  string | null =
    null;

/*
 * =======================================================
 * JWT
 * =======================================================
 */

function createToken(
  userId: string,
  role: UserRole
) {
  return jwt.sign(
    {
      userId,
      role,
    },
    jwtSecret!,
    {
      expiresIn:
        "1h",
    }
  );
}

/*
 * =======================================================
 * HTTP
 * =======================================================
 */

type ApiResult = {
  status: number;
  body: any;
};

async function apiRequest(
  baseUrl: string,
  path: string,
  options: {
    token: string;

    method?:
      | "GET"
      | "POST"
      | "PATCH"
      | "PUT"
      | "DELETE";

    body?: unknown;
  }
): Promise<ApiResult> {
  const headers:
    Record<
      string,
      string
    > = {
      Authorization:
        `Bearer ${options.token}`,
    };

  if (
    options.body !==
    undefined
  ) {
    headers[
      "Content-Type"
    ] =
      "application/json";
  }

  const response =
    await fetch(
      `${baseUrl}${path}`,
      {
        method:
          options.method ??
          "GET",

        headers,

        body:
          options.body !==
          undefined
            ? JSON.stringify(
                options.body
              )
            : undefined,
      }
    );

  const text =
    await response.text();

  let body:
    any =
      null;

  if (
    text
  ) {
    try {
      body =
        JSON.parse(
          text
        );
    } catch {
      body =
        text;
    }
  }

  return {
    status:
      response.status,

    body,
  };
}

/*
 * =======================================================
 * RESPONSE HELPERS
 * =======================================================
 */

function findOrder(
  responseBody: any,
  targetOrderId: string
) {
  return responseBody
    ?.orders
    ?.find(
      (
        order: any
      ) =>
        order.id ===
        targetOrderId
    );
}

function privateSellerDataIsLocked(
  order: any
) {
  return (
    order
      ?.buyer
      ?.phone ===
      null &&
    order
      ?.buyer
      ?.phoneUnlocked ===
      false &&
    order
      ?.buyer
      ?.phoneAvailable ===
      false &&

    order
      ?.pickupLocation ===
      null &&
    order
      ?.pickupLocationUnlocked ===
      false &&
    order
      ?.pickupLocationAvailable ===
      false &&

    order
      ?.preferredSlot ===
      null &&
    order
      ?.preferredSlotUnlocked ===
      false &&
    order
      ?.preferredSlotAvailable ===
      false
  );
}

function privateSellerDataIsUnlocked(
  order: any
) {
  return (
    order
      ?.buyer
      ?.phone ===
      buyerPhone &&
    order
      ?.buyer
      ?.phoneUnlocked ===
      true &&
    order
      ?.buyer
      ?.phoneAvailable ===
      true &&

    order
      ?.pickupLocation ===
      buyerPickupLocation &&
    order
      ?.pickupLocationUnlocked ===
      true &&
    order
      ?.pickupLocationAvailable ===
      true &&

    order
      ?.preferredSlot ===
      buyerPreferredSlot &&
    order
      ?.preferredSlotUnlocked ===
      true &&
    order
      ?.preferredSlotAvailable ===
      true
  );
}

function containsBuyerPickupLocation(
  value: unknown
) {
  return JSON.stringify(
    value
  ).includes(
    buyerPickupLocation
  );
}

function containsBuyerPreferredSlot(
  value: unknown
) {
  return JSON.stringify(
    value
  ).includes(
    buyerPreferredSlot
  );
}

function containsBuyerPrivateFulfillmentData(
  value: unknown
) {
  return (
    containsBuyerPickupLocation(
      value
    ) ||
    containsBuyerPreferredSlot(
      value
    )
  );
}

/*
 * =======================================================
 * CLEANUP
 * =======================================================
 */

async function cleanup() {
  if (
    orderId
  ) {
    await prisma.order.deleteMany({
      where: {
        id:
          orderId,
      },
    });
  }

  const userIds =
    [
      buyerId,
      vendorAId,
      vendorBId,
    ].filter(
      (
        value
      ): value is string =>
        Boolean(
          value
        )
    );

  if (
    userIds.length >
    0
  ) {
    await prisma.user.deleteMany({
      where: {
        id: {
          in:
            userIds,
        },
      },
    });
  }

  if (
    universityId
  ) {
    await prisma.university.deleteMany({
      where: {
        id:
          universityId,
      },
    });
  }
}

/*
 * =======================================================
 * MAIN
 * =======================================================
 */

async function main() {
  console.log(
    "\nCampusMart order privacy integration test\n"
  );

  /*
   * =====================================================
   * UNIVERSITY
   * =====================================================
   */

  const university =
    await prisma.university.create({
      data: {
        name:
          `Order Privacy University ${suffix}`,

        shortName:
          "OPU",

        slug:
          `order-privacy-university-${suffix}`,

        country:
          "Nigeria",

        state:
          "Rivers",

        city:
          "Port Harcourt",

        active:
          true,
      },
    });

  universityId =
    university.id;

  /*
   * =====================================================
   * USERS
   * =====================================================
   */

  const buyer =
    await prisma.user.create({
      data: {
        name:
          "Order Privacy Buyer",

        email:
          `order-privacy-buyer-${suffix}@example.com`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.client,

        universityId:
          university.id,

        phone:
          buyerPhone,
      },
    });

  buyerId =
    buyer.id;

  const vendorA =
    await prisma.user.create({
      data: {
        name:
          "Order Privacy Seller A",

        email:
          `order-privacy-a-${suffix}@example.com`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.vendor,

        universityId:
          university.id,

        matricNumber:
          `OPA-${suffix}`,

        studentVerificationStatus:
          StudentVerificationStatus.verified,

        studentVerifiedAt:
          new Date(),

        vendorProfile: {
          create: {
            businessName:
              "Order Privacy Store A",

            businessDescription:
              "Seller A privacy-test store.",

            pickupLocation:
              "Seller A Public Store Pickup",

            accessStatus:
              VendorAccessStatus.active,
          },
        },
      },
    });

  vendorAId =
    vendorA.id;

  const vendorB =
    await prisma.user.create({
      data: {
        name:
          "Order Privacy Seller B",

        email:
          `order-privacy-b-${suffix}@example.com`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.vendor,

        universityId:
          university.id,

        matricNumber:
          `OPB-${suffix}`,

        studentVerificationStatus:
          StudentVerificationStatus.verified,

        studentVerifiedAt:
          new Date(),

        vendorProfile: {
          create: {
            businessName:
              "Order Privacy Store B",

            businessDescription:
              "Seller B privacy-test store.",

            pickupLocation:
              "Seller B Public Store Pickup",

            accessStatus:
              VendorAccessStatus.active,
          },
        },
      },
    });

  vendorBId =
    vendorB.id;

  /*
   * =====================================================
   * MULTI-VENDOR ORDER
   * =====================================================
   *
   * Payment integration is not live yet, so this order
   * is intentionally created directly.
   *
   * This allows the test to move precisely through:
   *
   * pending
   * confirmed
   * paid
   * completed
   * cancelled
   */

  const order =
    await prisma.order.create({
      data: {
        buyerId:
          buyer.id,

        status:
          OrderStatus.pending,

        paymentStatus:
          PaymentStatus.pending,

        subtotal:
          30000,

        fee:
          50,

        total:
          30050,

        pickupLocation:
          buyerPickupLocation,

        preferredSlot:
          buyerPreferredSlot,

        items: {
          create: [
            {
              vendorId:
                vendorA.id,

              productTitle:
                "Seller A Test Item",

              unitPrice:
                15000,

              quantity:
                1,

              lineTotal:
                15000,

              status:
                OrderStatus.pending,
            },

            {
              vendorId:
                vendorB.id,

              productTitle:
                "Seller B Test Item",

              unitPrice:
                15000,

              quantity:
                1,

              lineTotal:
                15000,

              status:
                OrderStatus.pending,
            },
          ],
        },
      },
    });

  orderId =
    order.id;

  /*
   * =====================================================
   * TOKENS
   * =====================================================
   */

  const buyerToken =
    createToken(
      buyer.id,
      buyer.role
    );

  const vendorAToken =
    createToken(
      vendorA.id,
      vendorA.role
    );

  const vendorBToken =
    createToken(
      vendorB.id,
      vendorB.role
    );

  /*
   * =====================================================
   * TEMP HTTP SERVER
   * =====================================================
   */

  const server =
    await new Promise<
      ReturnType<
        typeof app.listen
      >
    >(
      (
        resolve,
        reject
      ) => {
        const instance =
          app.listen(
            0,
            "127.0.0.1",
            () => {
              resolve(
                instance
              );
            }
          );

        instance.once(
          "error",
          reject
        );
      }
    );

  try {
    const address =
      server.address();

    if (
      !address ||
      typeof address ===
        "string"
    ) {
      throw new Error(
        "Unable to determine test server port."
      );
    }

    const baseUrl =
      `http://127.0.0.1:${address.port}`;

    /*
     * ===================================================
     * 1. SELLER A — PENDING + UNPAID
     * ===================================================
     */

    const vendorAPending =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        {
          token:
            vendorAToken,
        }
      );

    const vendorAOrderPending =
      findOrder(
        vendorAPending.body,
        order.id
      );

    check(
      vendorAPending.status ===
        200 &&
      vendorAOrderPending
        ?.vendorStatus ===
        OrderStatus.pending &&
      vendorAOrderPending
        ?.paymentStatus ===
        PaymentStatus.pending &&
      privateSellerDataIsLocked(
        vendorAOrderPending
      ),
      "Seller A cannot see buyer phone, pickup location or preferred slot while pending and unpaid."
    );

    /*
     * Ensure the raw buyer-selected fulfilment values are
     * not merely hidden from their main properties while
     * leaking elsewhere inside the seller response.
     */

    check(
      !containsBuyerPickupLocation(
        vendorAOrderPending
      ),
      "Seller A pending order contains no hidden copy of the buyer pickup location."
    );

    check(
      !containsBuyerPreferredSlot(
        vendorAOrderPending
      ),
      "Seller A pending order contains no hidden copy of the buyer preferred slot."
    );

    /*
     * ===================================================
     * 2. SELLER B — PENDING + UNPAID
     * ===================================================
     */

    const vendorBPending =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        {
          token:
            vendorBToken,
        }
      );

    const vendorBOrderPending =
      findOrder(
        vendorBPending.body,
        order.id
      );

    check(
      vendorBPending.status ===
        200 &&
      vendorBOrderPending
        ?.vendorStatus ===
        OrderStatus.pending &&
      privateSellerDataIsLocked(
        vendorBOrderPending
      ),
      "Seller B also cannot see buyer phone, pickup location or preferred slot while pending."
    );

    /*
     * ===================================================
     * 3. SELLER A CONFIRMS WHILE PAYMENT IS PENDING
     * ===================================================
     */

    const confirmAUnpaid =
      await apiRequest(
        baseUrl,
        `/api/orders/vendor/${order.id}/status`,
        {
          method:
            "PATCH",

          token:
            vendorAToken,

          body: {
            status:
              "confirmed",
          },
        }
      );

    check(
      confirmAUnpaid.status ===
        200 &&
      confirmAUnpaid.body
        ?.order
        ?.vendorStatus ===
        OrderStatus.confirmed &&
      confirmAUnpaid.body
        ?.order
        ?.paymentStatus ===
        PaymentStatus.pending &&
      privateSellerDataIsLocked(
        confirmAUnpaid.body
          ?.order
      ),
      "Seller A confirmation response keeps phone, pickup and preferred slot locked while payment is pending."
    );

    /*
     * ===================================================
     * 4. SELLER HISTORY AFTER UNPAID CONFIRMATION
     * ===================================================
     */

    const vendorAUnpaidConfirmed =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        {
          token:
            vendorAToken,
        }
      );

    const vendorAUnpaidOrder =
      findOrder(
        vendorAUnpaidConfirmed.body,
        order.id
      );

    check(
      vendorAUnpaidConfirmed.status ===
        200 &&
      vendorAUnpaidOrder
        ?.vendorStatus ===
        OrderStatus.confirmed &&
      vendorAUnpaidOrder
        ?.paymentStatus ===
        PaymentStatus.pending &&
      privateSellerDataIsLocked(
        vendorAUnpaidOrder
      ),
      "Seller confirmation alone does not unlock private fulfilment data before payment."
    );

    /*
     * ===================================================
     * 5. PAYMENT BECOMES PAID
     * ===================================================
     */

    await prisma.order.update({
      where: {
        id:
          order.id,
      },

      data: {
        paymentStatus:
          PaymentStatus.paid,
      },
    });

    const vendorAPaidConfirmed =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        {
          token:
            vendorAToken,
        }
      );

    const vendorAPaidOrder =
      findOrder(
        vendorAPaidConfirmed.body,
        order.id
      );

    check(
      vendorAPaidConfirmed.status ===
        200 &&
      vendorAPaidOrder
        ?.vendorStatus ===
        OrderStatus.confirmed &&
      vendorAPaidOrder
        ?.paymentStatus ===
        PaymentStatus.paid &&
      privateSellerDataIsUnlocked(
        vendorAPaidOrder
      ),
      "Paid + confirmed unlocks buyer phone, pickup location and preferred slot for Seller A."
    );

    /*
     * ===================================================
     * 6. MULTI-VENDOR ISOLATION
     * ===================================================
     */

    const vendorBStillPending =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        {
          token:
            vendorBToken,
        }
      );

    const vendorBStillPendingOrder =
      findOrder(
        vendorBStillPending.body,
        order.id
      );

    check(
      vendorBStillPending.status ===
        200 &&
      vendorBStillPendingOrder
        ?.paymentStatus ===
        PaymentStatus.paid &&
      vendorBStillPendingOrder
        ?.vendorStatus ===
        OrderStatus.pending &&
      privateSellerDataIsLocked(
        vendorBStillPendingOrder
      ),
      "Seller B remains locked even though payment is paid and Seller A has confirmed."
    );

    /*
     * ===================================================
     * 7. SELLER A INDIVIDUAL ORDER
     * ===================================================
     */

    const vendorAIndividual =
      await apiRequest(
        baseUrl,
        `/api/orders/${order.id}`,
        {
          token:
            vendorAToken,
        }
      );

    check(
      vendorAIndividual.status ===
        200 &&
      vendorAIndividual.body
        ?.order
        ?.vendorStatus ===
        OrderStatus.confirmed &&
      privateSellerDataIsUnlocked(
        vendorAIndividual.body
          ?.order
      ),
      "Individual order endpoint unlocks phone, pickup and preferred slot for paid + confirmed Seller A."
    );

    /*
     * ===================================================
     * 8. SELLER B INDIVIDUAL ORDER
     * ===================================================
     */

    const vendorBIndividual =
      await apiRequest(
        baseUrl,
        `/api/orders/${order.id}`,
        {
          token:
            vendorBToken,
        }
      );

    check(
      vendorBIndividual.status ===
        200 &&
      vendorBIndividual.body
        ?.order
        ?.vendorStatus ===
        OrderStatus.pending &&
      privateSellerDataIsLocked(
        vendorBIndividual.body
          ?.order
      ) &&
      !containsBuyerPrivateFulfillmentData(
        vendorBIndividual.body
          ?.order
      ),
      "Individual order endpoint keeps pending Seller B's private fulfilment data locked."
    );

    /*
     * ===================================================
     * 9. SELLER-SPECIFIC ITEM PRIVACY
     * ===================================================
     */

    check(
      Array.isArray(
        vendorAIndividual.body
          ?.order
          ?.items
      ) &&
      vendorAIndividual.body
        .order
        .items
        .length ===
        1 &&
      vendorAIndividual.body
        .order
        .items[0]
        ?.vendorId ===
        vendorA.id,
      "Seller A individual order response contains only Seller A's items."
    );

    /*
     * ===================================================
     * 10. SELLER B CONFIRMS WHILE PAID
     * ===================================================
     */

    const confirmBPaid =
      await apiRequest(
        baseUrl,
        `/api/orders/vendor/${order.id}/status`,
        {
          method:
            "PATCH",

          token:
            vendorBToken,

          body: {
            status:
              "confirmed",
          },
        }
      );

    check(
      confirmBPaid.status ===
        200 &&
      confirmBPaid.body
        ?.order
        ?.vendorStatus ===
        OrderStatus.confirmed &&
      confirmBPaid.body
        ?.order
        ?.paymentStatus ===
        PaymentStatus.paid &&
      privateSellerDataIsUnlocked(
        confirmBPaid.body
          ?.order
      ),
      "Seller B status-update response unlocks all private fulfilment data after paid + confirmed."
    );

    /*
     * ===================================================
     * 11. SELLER B HISTORY IS NOW UNLOCKED
     * ===================================================
     */

    const vendorBAfterConfirm =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        {
          token:
            vendorBToken,
        }
      );

    const vendorBConfirmedOrder =
      findOrder(
        vendorBAfterConfirm.body,
        order.id
      );

    check(
      vendorBAfterConfirm.status ===
        200 &&
      vendorBConfirmedOrder
        ?.vendorStatus ===
        OrderStatus.confirmed &&
      privateSellerDataIsUnlocked(
        vendorBConfirmedOrder
      ),
      "Seller B independently gains private fulfilment access after Seller B confirms."
    );

    /*
     * ===================================================
     * 12. SELLER A COMPLETES
     * ===================================================
     */

    await prisma.orderItem.updateMany({
      where: {
        orderId:
          order.id,

        vendorId:
          vendorA.id,
      },

      data: {
        status:
          OrderStatus.completed,
      },
    });

    const vendorACompleted =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        {
          token:
            vendorAToken,
        }
      );

    const vendorACompletedOrder =
      findOrder(
        vendorACompleted.body,
        order.id
      );

    check(
      vendorACompleted.status ===
        200 &&
      vendorACompletedOrder
        ?.vendorStatus ===
        OrderStatus.completed &&
      privateSellerDataIsLocked(
        vendorACompletedOrder
      ),
      "Seller A loses phone, pickup and preferred-slot access after Seller A's portion completes."
    );

    /*
     * ===================================================
     * 13. COMPLETED SELLER INDIVIDUAL ORDER
     * ===================================================
     */

    const vendorACompletedIndividual =
      await apiRequest(
        baseUrl,
        `/api/orders/${order.id}`,
        {
          token:
            vendorAToken,
        }
      );

    check(
      vendorACompletedIndividual.status ===
        200 &&
      vendorACompletedIndividual.body
        ?.order
        ?.vendorStatus ===
        OrderStatus.completed &&
      privateSellerDataIsLocked(
        vendorACompletedIndividual.body
          ?.order
      ) &&
      !containsBuyerPrivateFulfillmentData(
        vendorACompletedIndividual.body
          ?.order
      ),
      "Completed Seller A's individual order hides all private fulfilment data again."
    );

    /*
     * ===================================================
     * 14. SELLER B REMAINS CONFIRMED
     * ===================================================
     */

    const vendorBStillConfirmed =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        {
          token:
            vendorBToken,
        }
      );

    const vendorBStillConfirmedOrder =
      findOrder(
        vendorBStillConfirmed.body,
        order.id
      );

    check(
      vendorBStillConfirmed.status ===
        200 &&
      vendorBStillConfirmedOrder
        ?.vendorStatus ===
        OrderStatus.confirmed &&
      privateSellerDataIsUnlocked(
        vendorBStillConfirmedOrder
      ),
      "Seller B keeps private fulfilment access while Seller B remains confirmed."
    );

    /*
     * ===================================================
     * 15. SELLER B CANCELS
     * ===================================================
     */

    const cancelB =
      await apiRequest(
        baseUrl,
        `/api/orders/vendor/${order.id}/status`,
        {
          method:
            "PATCH",

          token:
            vendorBToken,

          body: {
            status:
              "cancelled",
          },
        }
      );

    check(
      cancelB.status ===
        200 &&
      cancelB.body
        ?.order
        ?.vendorStatus ===
        OrderStatus.cancelled &&
      privateSellerDataIsLocked(
        cancelB.body
          ?.order
      ) &&
      !containsBuyerPrivateFulfillmentData(
        cancelB.body
          ?.order
      ),
      "Cancelling Seller B's portion immediately re-locks phone, pickup and preferred slot."
    );

    /*
     * ===================================================
     * 16. SELLER B HISTORY AFTER CANCELLATION
     * ===================================================
     */

    const vendorBCancelled =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        {
          token:
            vendorBToken,
        }
      );

    const vendorBCancelledOrder =
      findOrder(
        vendorBCancelled.body,
        order.id
      );

    check(
      vendorBCancelled.status ===
        200 &&
      vendorBCancelledOrder
        ?.vendorStatus ===
        OrderStatus.cancelled &&
      privateSellerDataIsLocked(
        vendorBCancelledOrder
      ) &&
      !containsBuyerPrivateFulfillmentData(
        vendorBCancelledOrder
      ),
      "Seller B remains unable to see private fulfilment data after cancellation."
    );

    /*
     * ===================================================
     * 17. BUYER ACCESS TO OWN INDIVIDUAL ORDER
     * ===================================================
     */

    const buyerOrder =
      await apiRequest(
        baseUrl,
        `/api/orders/${order.id}`,
        {
          token:
            buyerToken,
        }
      );

    check(
      buyerOrder.status ===
        200 &&
      buyerOrder.body
        ?.order
        ?.buyer
        ?.id ===
        buyer.id &&
      buyerOrder.body
        ?.order
        ?.buyer
        ?.phone ===
        buyerPhone &&
      buyerOrder.body
        ?.order
        ?.pickupLocation ===
        buyerPickupLocation &&
      buyerOrder.body
        ?.order
        ?.preferredSlot ===
        buyerPreferredSlot,
      "Buyer can still see their own phone, pickup location and preferred slot on their own order."
    );

    /*
     * ===================================================
     * 18. BUYER ORDER HISTORY
     * ===================================================
     */

    const buyerHistory =
      await apiRequest(
        baseUrl,
        "/api/orders/mine",
        {
          token:
            buyerToken,
        }
      );

    const buyerHistoryOrder =
      findOrder(
        buyerHistory.body,
        order.id
      );

    check(
      buyerHistory.status ===
        200 &&
      buyerHistoryOrder
        ?.pickupLocation ===
        buyerPickupLocation &&
      buyerHistoryOrder
        ?.preferredSlot ===
        buyerPreferredSlot,
      "Buyer order history still contains the buyer's own pickup location and preferred slot."
    );

    /*
     * ===================================================
     * SUMMARY
     * ===================================================
     */

    console.log(
      "\n----------------------------------------"
    );

    console.log(
      `Order privacy tests: ${passed} passed / ${failed} failed`
    );

    console.log(
      "----------------------------------------\n"
    );

    if (
      failed >
      0
    ) {
      process.exitCode =
        1;
    }
  } finally {
    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        server.close(
          (
            error
          ) => {
            if (
              error
            ) {
              reject(
                error
              );

              return;
            }

            resolve();
          }
        );
      }
    );
  }
}

/*
 * =======================================================
 * EXECUTION
 * =======================================================
 */

main()
  .catch(
    (
      error
    ) => {
      console.error(
        "\nOrder privacy test crashed:\n",
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
      } catch (
        cleanupError
      ) {
        console.error(
          "\nOrder privacy cleanup failed:\n",
        cleanupError
      );

      process.exitCode =
        1;
      }

      await prisma.$disconnect();
    }
  );