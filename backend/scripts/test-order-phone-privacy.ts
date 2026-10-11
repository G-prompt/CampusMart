import "dotenv/config";

import jwt from "jsonwebtoken";

import app from "../src/app";

import {
  OrderStatus,
  PaymentStatus,
  UserRole,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

/*
 * =======================================================
 * CAMPUSMART BUYER PHONE PRIVACY TEST
 * =======================================================
 *
 * Proves:
 *
 * 1. Pending seller cannot see buyer phone.
 * 2. Another pending seller cannot see buyer phone.
 * 3. Confirmation alone does not unlock phone if unpaid.
 * 4. Paid + confirmed unlocks phone for that seller.
 * 5. Another seller in the same order remains locked.
 * 6. Individual order endpoint follows same rule.
 * 7. Seller B remains locked while pending.
 * 8. Seller B unlocks independently after confirmation.
 * 9. Completed seller loses phone access again.
 * 10. Seller B remains unlocked while still confirmed.
 * 11. Cancelled seller loses phone access.
 * 12. Buyer can still see their own phone on their order.
 * 13. Seller individual order contains only their items.
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
  Date.now().toString(
    36
  );

const buyerPhone =
  "08123456789";

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

async function apiRequest(
  baseUrl: string,
  path: string,
  token: string
) {
  const response =
    await fetch(
      `${baseUrl}${path}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
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
}

/*
 * =======================================================
 * MAIN
 * =======================================================
 */

async function main() {
  console.log(
    "\nCampusMart buyer phone privacy integration test\n"
  );

  /*
   * ---------------------------------------------------
   * USERS
   * ---------------------------------------------------
   */

  const buyer =
    await prisma.user.create({
      data: {
        name:
          "Phone Privacy Buyer",

        email:
          `phone-privacy-buyer-${suffix}@example.com`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.client,

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
          "Phone Privacy Seller A",

        email:
          `phone-privacy-a-${suffix}@example.com`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.vendor,
      },
    });

  vendorAId =
    vendorA.id;

  const vendorB =
    await prisma.user.create({
      data: {
        name:
          "Phone Privacy Seller B",

        email:
          `phone-privacy-b-${suffix}@example.com`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.vendor,
      },
    });

  vendorBId =
    vendorB.id;

  /*
   * ---------------------------------------------------
   * MULTI-VENDOR ORDER
   * ---------------------------------------------------
   *
   * We create this directly because payment integration
   * does not exist yet.
   *
   * This lets us explicitly simulate:
   *
   * pending -> paid
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
          "Campus Library Gate",

        preferredSlot:
          "4:30 PM",

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
   * ---------------------------------------------------
   * TOKENS
   * ---------------------------------------------------
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
   * ---------------------------------------------------
   * TEMP HTTP SERVER
   * ---------------------------------------------------
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
     * =================================================
     * PENDING + UNPAID
     * =================================================
     */

    const vendorAPending =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        vendorAToken
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
          ?.buyer
          ?.phone ===
          null &&
        vendorAOrderPending
          ?.buyer
          ?.phoneUnlocked ===
          false &&
        vendorAOrderPending
          ?.buyer
          ?.phoneAvailable ===
          false,
      "Seller A cannot see buyer phone while their portion is pending."
    );

    const vendorBPending =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        vendorBToken
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
          ?.buyer
          ?.phone ===
          null &&
        vendorBOrderPending
          ?.buyer
          ?.phoneUnlocked ===
          false,
      "Seller B also cannot see buyer phone while pending."
    );

    /*
     * =================================================
     * A CONFIRMED BUT PAYMENT STILL PENDING
     * =================================================
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
          OrderStatus.confirmed,
      },
    });

    await prisma.order.update({
      where: {
        id:
          order.id,
      },

      data: {
        status:
          OrderStatus.confirmed,
      },
    });

    const vendorAUnpaidConfirmed =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        vendorAToken
      );

    const vendorAUnpaidOrder =
      findOrder(
        vendorAUnpaidConfirmed.body,
        order.id
      );

    check(
      vendorAUnpaidOrder
        ?.vendorStatus ===
        OrderStatus.confirmed &&
        vendorAUnpaidOrder
          ?.paymentStatus ===
          PaymentStatus.pending &&
        vendorAUnpaidOrder
          ?.buyer
          ?.phone ===
          null &&
        vendorAUnpaidOrder
          ?.buyer
          ?.phoneUnlocked ===
          false,
      "Seller confirmation alone does not unlock buyer phone before payment."
    );

    /*
     * =================================================
     * PAYMENT BECOMES PAID
     * =================================================
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
        vendorAToken
      );

    const vendorAPaidOrder =
      findOrder(
        vendorAPaidConfirmed.body,
        order.id
      );

    check(
      vendorAPaidOrder
        ?.buyer
        ?.phone ===
        buyerPhone &&
        vendorAPaidOrder
          ?.buyer
          ?.phoneUnlocked ===
          true &&
        vendorAPaidOrder
          ?.buyer
          ?.phoneAvailable ===
          true,
      "Paid + confirmed unlocks buyer phone for Seller A."
    );

    const vendorBStillPending =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        vendorBToken
      );

    const vendorBStillPendingOrder =
      findOrder(
        vendorBStillPending.body,
        order.id
      );

    check(
      vendorBStillPendingOrder
        ?.paymentStatus ===
        PaymentStatus.paid &&
        vendorBStillPendingOrder
          ?.vendorStatus ===
          OrderStatus.pending &&
        vendorBStillPendingOrder
          ?.buyer
          ?.phone ===
          null &&
        vendorBStillPendingOrder
          ?.buyer
          ?.phoneUnlocked ===
          false,
      "Seller B remains locked even though the checkout is paid because Seller B is still pending."
    );

    /*
     * =================================================
     * INDIVIDUAL ORDER ENDPOINT
     * =================================================
     */

    const vendorAIndividual =
      await apiRequest(
        baseUrl,
        `/api/orders/${order.id}`,
        vendorAToken
      );

    check(
      vendorAIndividual.status ===
        200 &&
        vendorAIndividual.body
          ?.order
          ?.buyer
          ?.phone ===
          buyerPhone &&
        vendorAIndividual.body
          ?.order
          ?.buyer
          ?.phoneUnlocked ===
          true,
      "Individual order endpoint unlocks buyer phone for paid + confirmed Seller A."
    );

    const vendorBIndividual =
      await apiRequest(
        baseUrl,
        `/api/orders/${order.id}`,
        vendorBToken
      );

    check(
      vendorBIndividual.status ===
        200 &&
        vendorBIndividual.body
          ?.order
          ?.buyer
          ?.phone ===
          null &&
        vendorBIndividual.body
          ?.order
          ?.buyer
          ?.phoneUnlocked ===
          false,
      "Individual order endpoint keeps buyer phone hidden from pending Seller B."
    );

    /*
     * =================================================
     * SELLER-SPECIFIC ITEM PRIVACY
     * =================================================
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
     * =================================================
     * B CONFIRMS
     * =================================================
     */

    await prisma.orderItem.updateMany({
      where: {
        orderId:
          order.id,

        vendorId:
          vendorB.id,
      },

      data: {
        status:
          OrderStatus.confirmed,
      },
    });

    const vendorBAfterConfirm =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        vendorBToken
      );

    const vendorBConfirmedOrder =
      findOrder(
        vendorBAfterConfirm.body,
        order.id
      );

    check(
      vendorBConfirmedOrder
        ?.vendorStatus ===
        OrderStatus.confirmed &&
        vendorBConfirmedOrder
          ?.buyer
          ?.phone ===
          buyerPhone &&
        vendorBConfirmedOrder
          ?.buyer
          ?.phoneUnlocked ===
          true,
      "Seller B independently unlocks buyer phone after Seller B confirms."
    );

    /*
     * =================================================
     * A COMPLETES
     * =================================================
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
        vendorAToken
      );

    const vendorACompletedOrder =
      findOrder(
        vendorACompleted.body,
        order.id
      );

    check(
      vendorACompletedOrder
        ?.vendorStatus ===
        OrderStatus.completed &&
        vendorACompletedOrder
          ?.buyer
          ?.phone ===
          null &&
        vendorACompletedOrder
          ?.buyer
          ?.phoneUnlocked ===
          false,
      "Seller A loses buyer phone access after Seller A's portion completes."
    );

    /*
     * B is still confirmed, so A completing must not
     * affect B's own contact-access window.
     */

    const vendorBStillConfirmed =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        vendorBToken
      );

    const vendorBStillConfirmedOrder =
      findOrder(
        vendorBStillConfirmed.body,
        order.id
      );

    check(
      vendorBStillConfirmedOrder
        ?.vendorStatus ===
        OrderStatus.confirmed &&
        vendorBStillConfirmedOrder
          ?.buyer
          ?.phone ===
          buyerPhone &&
        vendorBStillConfirmedOrder
          ?.buyer
          ?.phoneUnlocked ===
          true,
      "Seller B keeps buyer phone access while Seller B remains confirmed."
    );

    /*
     * =================================================
     * B CANCELS
     * =================================================
     */

    await prisma.orderItem.updateMany({
      where: {
        orderId:
          order.id,

        vendorId:
          vendorB.id,
      },

      data: {
        status:
          OrderStatus.cancelled,
      },
    });

    await prisma.order.update({
      where: {
        id:
          order.id,
      },

      data: {
        status:
          OrderStatus.completed,
      },
    });

    const vendorBCancelled =
      await apiRequest(
        baseUrl,
        "/api/orders/vendor",
        vendorBToken
      );

    const vendorBCancelledOrder =
      findOrder(
        vendorBCancelled.body,
        order.id
      );

    check(
      vendorBCancelledOrder
        ?.vendorStatus ===
        OrderStatus.cancelled &&
        vendorBCancelledOrder
          ?.buyer
          ?.phone ===
          null &&
        vendorBCancelledOrder
          ?.buyer
          ?.phoneUnlocked ===
          false,
      "Seller B loses buyer phone access after Seller B's portion is cancelled."
    );

    /*
     * =================================================
     * BUYER ACCESS TO OWN ORDER
     * =================================================
     */

    const buyerOrder =
      await apiRequest(
        baseUrl,
        `/api/orders/${order.id}`,
        buyerToken
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
          buyerPhone,
      "Buyer can still see their own stored phone number on their own order."
    );

    /*
     * =================================================
     * SUMMARY
     * =================================================
     */

    console.log(
      "\n----------------------------------------"
    );

    console.log(
      `Order phone privacy tests: ${passed} passed / ${failed} failed`
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
        "\nOrder phone privacy test crashed:\n",
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
          "\nOrder phone privacy cleanup failed:\n",
          cleanupError
        );

        process.exitCode =
          1;
      }

      await prisma.$disconnect();
    }
  );