import "dotenv/config";

import type {
  Response,
} from "express";

import {
  OrderStatus,
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

import {
  createOrder,
  getBuyerFulfillmentCodes,
  getVendorOrders,
  updateVendorOrderStatus,
  verifyVendorFulfillmentCode,
} from "../src/controllers/order.controller";

import type {
  AuthenticatedRequest,
} from "../src/middleware/auth.middleware";

/*
 * =======================================================
 * TEST HELPERS
 * =======================================================
 */

type CapturedResponse = {
  statusCode: number;
  body: any;
};

function createMockResponse() {
  const captured: CapturedResponse = {
    statusCode:
      200,

    body:
      null,
  };

  const response = {
    status(
      code: number
    ) {
      captured.statusCode =
        code;

      return this;
    },

    json(
      body: unknown
    ) {
      captured.body =
        body;

      return this;
    },
  } as Response;

  return {
    response,
    captured,
  };
}

function createAuthenticatedRequest(
  user: {
    id: string;
    role: UserRole;
  },

  body: unknown = {},

  params: Record<
    string,
    string
  > = {}
): AuthenticatedRequest {
  return {
    user,

    body,

    params,
  } as unknown as
    AuthenticatedRequest;
}

let passed =
  0;

let failed =
  0;

function check(
  condition: boolean,
  label: string
) {
  if (
    condition
  ) {
    passed +=
      1;

    console.log(
      `PASS: ${label}`
    );

    return;
  }

  failed +=
    1;

  console.error(
    `FAIL: ${label}`
  );
}

/*
 * =======================================================
 * MAIN TEST
 * =======================================================
 */

async function main() {
  const testId =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  let universityId:
    | string
    | null =
    null;

  let buyerId:
    | string
    | null =
    null;

  let sellerAId:
    | string
    | null =
    null;

  let sellerBId:
    | string
    | null =
    null;

  let productAId:
    | number
    | null =
    null;

  let productBId:
    | number
    | null =
    null;

  let orderId:
    | string
    | null =
    null;

  try {
    /*
     * ===================================================
     * TEST UNIVERSITY
     * ===================================================
     */

    const university =
      await prisma.university.create({
        data: {
          name:
            `Fulfillment Test University ${testId}`,

          shortName:
            "FTU",

          slug:
            `fulfillment-test-university-${testId}`,

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
     * ===================================================
     * SELLER A
     * ===================================================
     */

    const sellerA =
      await prisma.user.create({
        data: {
          name:
            "Fulfillment Seller A",

          email:
            `fulfillment-seller-a-${testId}@campusmart.test`,

          passwordHash:
            "test-password",

          role:
            UserRole.vendor,

          universityId:
            university.id,

          matricNumber:
            `FTUA-${testId}`,

          studentVerificationStatus:
            StudentVerificationStatus.verified,

          studentVerifiedAt:
            new Date(),

          vendorProfile: {
            create: {
              businessName:
                "Fulfillment Shop A",

              businessDescription:
                "Temporary seller A used for fulfilment testing.",

              pickupLocation:
                "Campus Gate A",

              accessStatus:
                VendorAccessStatus.active,
            },
          },
        },
      });

    sellerAId =
      sellerA.id;

    /*
     * ===================================================
     * SELLER B
     * ===================================================
     */

    const sellerB =
      await prisma.user.create({
        data: {
          name:
            "Fulfillment Seller B",

          email:
            `fulfillment-seller-b-${testId}@campusmart.test`,

          passwordHash:
            "test-password",

          role:
            UserRole.vendor,

          universityId:
            university.id,

          matricNumber:
            `FTUB-${testId}`,

          studentVerificationStatus:
            StudentVerificationStatus.verified,

          studentVerifiedAt:
            new Date(),

          vendorProfile: {
            create: {
              businessName:
                "Fulfillment Shop B",

              businessDescription:
                "Temporary seller B used for fulfilment testing.",

              pickupLocation:
                "Campus Gate B",

              accessStatus:
                VendorAccessStatus.active,
            },
          },
        },
      });

    sellerBId =
      sellerB.id;

    /*
     * ===================================================
     * BUYER
     * ===================================================
     */

    const buyer =
      await prisma.user.create({
        data: {
          name:
            "Fulfillment Test Buyer",

          email:
            `fulfillment-buyer-${testId}@campusmart.test`,

          passwordHash:
            "test-password",

          role:
            UserRole.client,

          universityId:
            university.id,
        },
      });

    buyerId =
      buyer.id;

    /*
     * ===================================================
     * SELLER A PRODUCT
     * ===================================================
     */

    const productA =
      await prisma.product.create({
        data: {
          slug:
            `fulfillment-product-a-${testId}`,

          title:
            "Fulfillment Product A",

          category:
            "Technology",

          price:
            15000,

          rating:
            0,

          description:
            "Temporary product from seller A.",

          images:
            [],

          vendorId:
            sellerA.id,

          isArchived:
            false,

          archivedAt:
            null,
        },
      });

    productAId =
      productA.id;

    /*
     * ===================================================
     * SELLER B PRODUCT
     * ===================================================
     */

    const productB =
      await prisma.product.create({
        data: {
          slug:
            `fulfillment-product-b-${testId}`,

          title:
            "Fulfillment Product B",

          category:
            "Books",

          price:
            8000,

          rating:
            0,

          description:
            "Temporary product from seller B.",

          images:
            [],

          vendorId:
            sellerB.id,

          isArchived:
            false,

          archivedAt:
            null,
        },
      });

    productBId =
      productB.id;

    /*
     * ===================================================
     * 1. CREATE MULTI-VENDOR ORDER
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await createOrder(
        createAuthenticatedRequest(
          {
            id:
              buyer.id,

            role:
              UserRole.client,
          },

          {
            items: [
              {
                productId:
                  productA.id,

                quantity:
                  2,
              },

              {
                productId:
                  productB.id,

                quantity:
                  1,
              },
            ],

            pickupLocation:
              "Main Campus",

            preferredSlot:
              "Afternoon",
          }
        ),

        response
      );

      if (
        captured.body
          ?.order
          ?.id
      ) {
        orderId =
          captured.body.order.id;
      }

      check(
        captured.statusCode ===
          201 &&
          captured.body
            ?.success ===
            true &&
          Boolean(
            captured.body
              ?.order
              ?.id
          ),
        "Multi-vendor buyer order is created"
      );
    }

    if (
      !orderId
    ) {
      throw new Error(
        "Order creation failed; remaining fulfilment tests cannot continue."
      );
    }

    /*
     * ===================================================
     * 2. ONE FULFILMENT RECORD PER SELLER
     * ===================================================
     */

    {
      const fulfillments =
        await prisma.orderVendorFulfillment.findMany({
          where: {
            orderId,
          },

          select: {
            vendorId:
              true,

            codeHash:
              true,

            codeCiphertext:
              true,
          },
        });

      const vendorIds =
        new Set(
          fulfillments.map(
            (
              fulfillment
            ) =>
              fulfillment.vendorId
          )
        );

      check(
        fulfillments.length ===
          2 &&
          vendorIds.size ===
            2 &&
          vendorIds.has(
            sellerA.id
          ) &&
          vendorIds.has(
            sellerB.id
          ) &&
          fulfillments.every(
            (
              fulfillment
            ) =>
              Boolean(
                fulfillment.codeHash
              ) &&
              Boolean(
                fulfillment.codeCiphertext
              )
          ),
        "Order creates exactly one secure fulfilment record per seller"
      );
    }

    /*
     * ===================================================
     * 3. CODES HIDDEN BEFORE SELLER CONFIRMATION
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getBuyerFulfillmentCodes(
        createAuthenticatedRequest(
          {
            id:
              buyer.id,

            role:
              UserRole.client,
          },

          {},

          {
            id:
              orderId,
          }
        ),

        response
      );

      const portions =
        Array.isArray(
          captured.body
            ?.portions
        )
          ? captured.body.portions
          : [];

      check(
        captured.statusCode ===
          200 &&
          portions.length ===
            2 &&
          portions.every(
            (
              portion: any
            ) =>
              portion.code ===
                null &&
              portion.codeAvailable ===
                false
          ),
        "Buyer cannot see fulfilment codes before seller confirmation"
      );
    }

    /*
     * ===================================================
     * 4. SELLER A CONFIRMS THEIR PORTION
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await updateVendorOrderStatus(
        createAuthenticatedRequest(
          {
            id:
              sellerA.id,

            role:
              UserRole.vendor,
          },

          {
            status:
              "confirmed",
          },

          {
            id:
              orderId,
          }
        ),

        response
      );

      check(
        captured.statusCode ===
          200 &&
          captured.body
            ?.success ===
            true &&
          captured.body
            ?.order
            ?.vendorStatus ===
            OrderStatus.confirmed,
        "Seller A can confirm their portion"
      );
    }

    /*
     * ===================================================
     * 5. BUYER SEES ONLY SELLER A CODE
     * ===================================================
     */

    let sellerACode =
      "";

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getBuyerFulfillmentCodes(
        createAuthenticatedRequest(
          {
            id:
              buyer.id,

            role:
              UserRole.client,
          },

          {},

          {
            id:
              orderId,
          }
        ),

        response
      );

      const portions =
        Array.isArray(
          captured.body
            ?.portions
        )
          ? captured.body.portions
          : [];

      const portionA =
        portions.find(
          (
            portion: any
          ) =>
            portion.vendorId ===
            sellerA.id
        );

      const portionB =
        portions.find(
          (
            portion: any
          ) =>
            portion.vendorId ===
            sellerB.id
        );

      sellerACode =
        typeof portionA
          ?.code ===
          "string"
          ? portionA.code
          : "";

      check(
        captured.statusCode ===
          200 &&
          /^\d{4}$/.test(
            sellerACode
          ) &&
          portionA
            ?.codeAvailable ===
            true &&
          portionB
            ?.code ===
            null &&
          portionB
            ?.codeAvailable ===
            false,
        "Buyer sees Seller A code only after Seller A confirms"
      );
    }

    /*
     * ===================================================
     * 6. SELLER CANNOT SELF-DECLARE COMPLETION
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await updateVendorOrderStatus(
        createAuthenticatedRequest(
          {
            id:
              sellerA.id,

            role:
              UserRole.vendor,
          },

          {
            status:
              "completed",
          },

          {
            id:
              orderId,
          }
        ),

        response
      );

      check(
        captured.statusCode ===
          400 &&
          captured.body
            ?.success ===
            false &&
          captured.body
            ?.code ===
            "FULFILLMENT_CODE_REQUIRED",
        "Seller cannot mark order completed through the old status endpoint"
      );
    }

    /*
     * ===================================================
     * WRONG CODE GUARANTEED NOT TO MATCH
     * ===================================================
     */

    const wrongCode =
      sellerACode ===
      "0000"
        ? "0001"
        : "0000";

    /*
     * ===================================================
     * 7. WRONG CODE IS REJECTED + ATTEMPT TRACKED
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await verifyVendorFulfillmentCode(
        createAuthenticatedRequest(
          {
            id:
              sellerA.id,

            role:
              UserRole.vendor,
          },

          {
            code:
              wrongCode,
          },

          {
            id:
              orderId,
          }
        ),

        response
      );

      const stored =
        await prisma.orderVendorFulfillment.findUnique({
          where: {
            orderId_vendorId: {
              orderId,

              vendorId:
                sellerA.id,
            },
          },

          select: {
            failedAttemptCount:
              true,

            lastFailedAttemptAt:
              true,
          },
        });

      check(
        captured.statusCode ===
          400 &&
          captured.body
            ?.code ===
            "INCORRECT_FULFILLMENT_CODE" &&
          stored
            ?.failedAttemptCount ===
            1 &&
          Boolean(
            stored
              ?.lastFailedAttemptAt
          ),
        "Incorrect fulfilment code is rejected and failed attempt is recorded"
      );
    }

    /*
     * ===================================================
     * 8. FIVE WRONG ATTEMPTS TRIGGER TEMPORARY LOCK
     * ===================================================
     *
     * We already made one failed attempt above.
     * Make four more.
     */

    {
      let lastStatusCode =
        0;

      let lastBody:
        any =
        null;

      for (
        let attempt =
          0;
        attempt <
        4;
        attempt +=
          1
      ) {
        const {
          response,
          captured,
        } =
          createMockResponse();

        await verifyVendorFulfillmentCode(
          createAuthenticatedRequest(
            {
              id:
                sellerA.id,

              role:
                UserRole.vendor,
            },

            {
              code:
                wrongCode,
            },

            {
              id:
                orderId,
            }
          ),

          response
        );

        lastStatusCode =
          captured.statusCode;

        lastBody =
          captured.body;
      }

      const stored =
        await prisma.orderVendorFulfillment.findUnique({
          where: {
            orderId_vendorId: {
              orderId,

              vendorId:
                sellerA.id,
            },
          },

          select: {
            failedAttemptCount:
              true,

            lockedUntil:
              true,
          },
        });

      check(
        lastStatusCode ===
          429 &&
          lastBody
            ?.code ===
            "FULFILLMENT_CODE_LOCKED" &&
          stored
            ?.failedAttemptCount ===
            0 &&
          Boolean(
            stored
              ?.lockedUntil &&
              stored.lockedUntil >
                new Date()
          ),
        "Five incorrect attempts temporarily lock fulfilment verification"
      );
    }

    /*
     * ===================================================
     * 9. EVEN CORRECT CODE IS BLOCKED DURING LOCK
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await verifyVendorFulfillmentCode(
        createAuthenticatedRequest(
          {
            id:
              sellerA.id,

            role:
              UserRole.vendor,
          },

          {
            code:
              sellerACode,
          },

          {
            id:
              orderId,
          }
        ),

        response
      );

      check(
        captured.statusCode ===
          429 &&
          captured.body
            ?.code ===
            "FULFILLMENT_CODE_LOCKED",
        "Correct code cannot bypass an active temporary lock"
      );
    }

    /*
     * Reset the temporary lock so the remainder of this
     * integration test can continue immediately.
     */

    await prisma.orderVendorFulfillment.update({
      where: {
        orderId_vendorId: {
          orderId,

          vendorId:
            sellerA.id,
        },
      },

      data: {
        failedAttemptCount:
          0,

        lastFailedAttemptAt:
          null,

        lockedUntil:
          null,
      },
    });

    /*
     * ===================================================
     * 10. CORRECT SELLER A CODE COMPLETES SELLER A
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await verifyVendorFulfillmentCode(
        createAuthenticatedRequest(
          {
            id:
              sellerA.id,

            role:
              UserRole.vendor,
          },

          {
            code:
              sellerACode,
          },

          {
            id:
              orderId,
          }
        ),

        response
      );

      check(
        captured.statusCode ===
          200 &&
          captured.body
            ?.success ===
            true &&
          captured.body
            ?.vendorStatus ===
            OrderStatus.completed,
        "Correct buyer code completes Seller A portion"
      );
    }

    /*
     * ===================================================
     * 11. SELLER A COMPLETION DOES NOT COMPLETE SELLER B
     * ===================================================
     */

    {
      const storedOrder =
        await prisma.order.findUnique({
          where: {
            id:
              orderId,
          },

          select: {
            status:
              true,

            items: {
              select: {
                vendorId:
                  true,

                status:
                  true,
              },
            },
          },
        });

      const sellerAItems =
        storedOrder
          ?.items.filter(
            (
              item
            ) =>
              item.vendorId ===
              sellerA.id
          ) ??
        [];

      const sellerBItems =
        storedOrder
          ?.items.filter(
            (
              item
            ) =>
              item.vendorId ===
              sellerB.id
          ) ??
        [];

      check(
        storedOrder
          ?.status ===
          OrderStatus.confirmed &&
          sellerAItems.length >
            0 &&
          sellerAItems.every(
            (
              item
            ) =>
              item.status ===
              OrderStatus.completed
          ) &&
          sellerBItems.length >
            0 &&
          sellerBItems.every(
            (
              item
            ) =>
              item.status ===
              OrderStatus.pending
          ),
        "Completing Seller A affects only Seller A items"
      );
    }

    /*
     * ===================================================
     * 12. COMPLETED SELLER CODE IS HIDDEN AGAIN
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getBuyerFulfillmentCodes(
        createAuthenticatedRequest(
          {
            id:
              buyer.id,

            role:
              UserRole.client,
          },

          {},

          {
            id:
              orderId,
          }
        ),

        response
      );

      const portionA =
        captured.body
          ?.portions
          ?.find(
            (
              portion: any
            ) =>
              portion.vendorId ===
              sellerA.id
          );

      check(
        captured.statusCode ===
          200 &&
          portionA
            ?.status ===
            OrderStatus.completed &&
          portionA
            ?.code ===
            null &&
          portionA
            ?.codeAvailable ===
            false &&
          portionA
            ?.verified ===
            true,
        "Completed seller code is hidden from buyer after successful handoff"
      );
    }

    /*
     * ===================================================
     * 13. BUYER CANNOT ACT AS SELLER TO COMPLETE ORDER
     * ===================================================
     *
     * The real route is additionally protected by
     * requireVendorOrderFulfillment.
     *
     * Even when calling the controller directly and
     * bypassing middleware, the buyer owns no seller items
     * and therefore cannot complete a seller portion.
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await verifyVendorFulfillmentCode(
        createAuthenticatedRequest(
          {
            id:
              buyer.id,

            role:
              UserRole.client,
          },

          {
            code:
              sellerACode,
          },

          {
            id:
              orderId,
          }
        ),

        response
      );

      check(
        captured.statusCode ===
          400 &&
          captured.body
            ?.success ===
            false,
        "Buyer cannot submit a seller fulfilment completion"
      );
    }

    /*
     * ===================================================
     * 14. SELLER CANNOT RETRIEVE BUYER'S CODES
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getBuyerFulfillmentCodes(
        createAuthenticatedRequest(
          {
            id:
              sellerA.id,

            role:
              UserRole.vendor,
          },

          {},

          {
            id:
              orderId,
          }
        ),

        response
      );

      check(
        captured.statusCode ===
          403 &&
          captured.body
            ?.success ===
            false,
        "Seller cannot retrieve buyer fulfilment codes"
      );
    }

    /*
     * ===================================================
     * 15. SELLER B CONFIRMS
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await updateVendorOrderStatus(
        createAuthenticatedRequest(
          {
            id:
              sellerB.id,

            role:
              UserRole.vendor,
          },

          {
            status:
              "confirmed",
          },

          {
            id:
              orderId,
          }
        ),

        response
      );

      check(
        captured.statusCode ===
          200 &&
          captured.body
            ?.order
            ?.vendorStatus ===
            OrderStatus.confirmed,
        "Seller B can independently confirm their portion"
      );
    }

    /*
     * ===================================================
     * 16. BUYER NOW RECEIVES SELLER B CODE
     * ===================================================
     */

    let sellerBCode =
      "";

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getBuyerFulfillmentCodes(
        createAuthenticatedRequest(
          {
            id:
              buyer.id,

            role:
              UserRole.client,
          },

          {},

          {
            id:
              orderId,
          }
        ),

        response
      );

      const portionA =
        captured.body
          ?.portions
          ?.find(
            (
              portion: any
            ) =>
              portion.vendorId ===
              sellerA.id
          );

      const portionB =
        captured.body
          ?.portions
          ?.find(
            (
              portion: any
            ) =>
              portion.vendorId ===
              sellerB.id
          );

      sellerBCode =
        typeof portionB
          ?.code ===
          "string"
          ? portionB.code
          : "";

      check(
        captured.statusCode ===
          200 &&
          portionA
            ?.code ===
            null &&
          portionA
            ?.verified ===
            true &&
          /^\d{4}$/.test(
            sellerBCode
          ) &&
          portionB
            ?.codeAvailable ===
            true,
        "Buyer receives Seller B code while completed Seller A code stays hidden"
      );
    }

    /*
     * ===================================================
     * 17. SELLER B COMPLETES WITH THEIR CODE
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await verifyVendorFulfillmentCode(
        createAuthenticatedRequest(
          {
            id:
              sellerB.id,

            role:
              UserRole.vendor,
          },

          {
            code:
              sellerBCode,
          },

          {
            id:
              orderId,
          }
        ),

        response
      );

      check(
        captured.statusCode ===
          200 &&
          captured.body
            ?.success ===
            true &&
          captured.body
            ?.vendorStatus ===
            OrderStatus.completed &&
          captured.body
            ?.overallStatus ===
            OrderStatus.completed,
        "Seller B code completes Seller B and finalises overall order"
      );
    }

    /*
     * ===================================================
     * 18. ALL ITEMS + OVERALL ORDER ARE COMPLETED
     * ===================================================
     */

    {
      const storedOrder =
        await prisma.order.findUnique({
          where: {
            id:
              orderId,
          },

          select: {
            status:
              true,

            items: {
              select: {
                status:
                  true,
              },
            },
          },
        });

      check(
        storedOrder
          ?.status ===
          OrderStatus.completed &&
          Boolean(
            storedOrder
              ?.items
              .length
          ) &&
          storedOrder
            ?.items
            .every(
              (
                item
              ) =>
                item.status ===
                OrderStatus.completed
            ) ===
            true,
        "Overall order completes only after every seller portion is completed"
      );
    }

    /*
     * ===================================================
     * 19. BOTH FULFILMENT RECORDS ARE VERIFIED
     * ===================================================
     */

    {
      const fulfillments =
        await prisma.orderVendorFulfillment.findMany({
          where: {
            orderId,
          },

          select: {
            vendorId:
              true,

            verifiedAt:
              true,

            failedAttemptCount:
              true,

            lockedUntil:
              true,
          },
        });

      check(
        fulfillments.length ===
          2 &&
          fulfillments.every(
            (
              fulfillment
            ) =>
              Boolean(
                fulfillment
                  .verifiedAt
              ) &&
              fulfillment
                .failedAttemptCount ===
                0 &&
              fulfillment
                .lockedUntil ===
                null
          ),
        "Both seller fulfilment records are securely marked verified"
      );
    }

    /*
     * ===================================================
     * 20. SELLER ORDER API DOES NOT LEAK SECRET CODE DATA
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getVendorOrders(
        createAuthenticatedRequest(
          {
            id:
              sellerA.id,

            role:
              UserRole.vendor,
          }
        ),

        response
      );

      const serialized =
        JSON.stringify(
          captured.body
        );

      check(
        captured.statusCode ===
          200 &&
          captured.body
            ?.success ===
            true &&
          !serialized.includes(
            "codeHash"
          ) &&
          !serialized.includes(
            "codeCiphertext"
          ) &&
          !serialized.includes(
            "lockedUntil"
          ),
        "Seller order response never exposes fulfilment secrets"
      );
    }
  } finally {
    /*
     * ===================================================
     * CLEANUP
     * ===================================================
     *
     * Deleting the buyer's orders automatically removes:
     *
     * - OrderItems
     * - OrderVendorFulfillment rows
     *
     * because both use onDelete: Cascade.
     */

    if (
      buyerId
    ) {
      await prisma.order.deleteMany({
        where: {
          buyerId,
        },
      });
    }

    const productIds =
      [
        productAId,
        productBId,
      ].filter(
        (
          value
        ): value is number =>
          typeof value ===
          "number"
      );

    if (
      productIds.length >
      0
    ) {
      await prisma.product.deleteMany({
        where: {
          id: {
            in:
              productIds,
          },
        },
      });
    }

    const userIds =
      [
        sellerAId,
        sellerBId,
        buyerId,
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
   * =====================================================
   * SUMMARY
   * =====================================================
   */

  console.log("");
  console.log(
    "=============================================="
  );

  console.log(
    `Order fulfillment tests: ${passed} passed, ${failed} failed`
  );

  console.log(
    "=============================================="
  );

  if (
    failed >
    0
  ) {
    process.exitCode =
      1;
  }
}

main()
  .catch(
    (
      error
    ) => {
      console.error(
        "Order fulfillment test crashed:",
        error
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