import type {
  Request,
  Response,
} from "express";

import {
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

import {
  getProductById,
  getProducts,
} from "../src/controllers/product.controller";

import {
  createOrder,
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
    statusCode: 200,
    body: null,
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

function createPublicRequest(
  params: Record<
    string,
    string
  > = {}
): Request {
  return {
    params,
  } as unknown as Request;
}

function createAuthenticatedRequest(
  user: {
    id: string;
    role: UserRole;
  },
  body: unknown
): AuthenticatedRequest {
  return {
    user,

    body,

    params: {},
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

  let sellerId:
    | string
    | null =
    null;

  let buyerId:
    | string
    | null =
    null;

  let productId:
    | number
    | null =
    null;

  let orderId:
    | string
    | null =
    null;

  try {
    /*
     * ---------------------------------------------------
     * UNIVERSITY
     * ---------------------------------------------------
     */

    const university =
      await prisma.university.create({
        data: {
          name:
            `Seller Availability Test University ${testId}`,

          shortName:
            "SATU",

          slug:
            `seller-availability-test-${testId}`,

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
     * ---------------------------------------------------
     * ACTIVE VERIFIED SELLER
     * ---------------------------------------------------
     */

    const seller =
      await prisma.user.create({
        data: {
          name:
            "Availability Test Seller",

          email:
            `availability-seller-${testId}@campusmart.test`,

          passwordHash:
            "test-password",

          role:
            UserRole.vendor,

          universityId:
            university.id,

          matricNumber:
            `SATU-${testId}`,

          studentVerificationStatus:
            StudentVerificationStatus.verified,

          studentVerifiedAt:
            new Date(),

          vendorProfile: {
            create: {
              businessName:
                "Availability Test Shop",

              businessDescription:
                "Temporary seller used for availability testing.",

              pickupLocation:
                "Campus Gate",

              accessStatus:
                VendorAccessStatus.active,
            },
          },
        },
      });

    sellerId =
      seller.id;

    /*
     * ---------------------------------------------------
     * BUYER
     * ---------------------------------------------------
     */

    const buyer =
      await prisma.user.create({
        data: {
          name:
            "Availability Test Buyer",

          email:
            `availability-buyer-${testId}@campusmart.test`,

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
     * ---------------------------------------------------
     * PUBLISHED PRODUCT
     * ---------------------------------------------------
     */

    const product =
      await prisma.product.create({
        data: {
          slug:
            `seller-availability-product-${testId}`,

          title:
            "Seller Availability Test Product",

          category:
            "Technology",

          price:
            12500,

          rating:
            0,

          description:
            "Temporary product used to test seller availability.",

          images:
            [],

          vendorId:
            seller.id,

          isArchived:
            false,

          archivedAt:
            null,
        },
      });

    productId =
      product.id;

    /*
     * ===================================================
     * 1. ACTIVE SELLER PRODUCT APPEARS PUBLICLY
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getProducts(
        createPublicRequest(),
        response
      );

      const products =
        Array.isArray(
          captured.body
            ?.products
        )
          ? captured.body.products
          : [];

      check(
        captured.statusCode ===
          200 &&
          products.some(
            (
              item: any
            ) =>
              item.id ===
              product.id
          ),
        "Active seller product appears in public marketplace"
      );
    }

    /*
     * ===================================================
     * 2. ACTIVE SELLER PRODUCT DETAIL IS PUBLIC
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getProductById(
        createPublicRequest({
          id:
            String(
              product.id
            ),
        }),
        response
      );

      check(
        captured.statusCode ===
          200 &&
          captured.body
            ?.product
            ?.id ===
            product.id,
        "Active seller product detail is publicly available"
      );
    }

    /*
     * ===================================================
     * 3. BUYER CAN CREATE ORDER WHILE SELLER ACTIVE
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
                  product.id,

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
        "Active seller can receive a new order"
      );
    }

    /*
     * ===================================================
     * SELLER BECOMES PENDING REVIEW
     * ===================================================
     */

    await prisma.vendorProfile.update({
      where: {
        userId:
          seller.id,
      },

      data: {
        accessStatus:
          VendorAccessStatus.pending_review,
      },
    });

    /*
     * ===================================================
     * 4. PRODUCT RECORD REMAINS PUBLISHED
     * ===================================================
     */

    {
      const storedProduct =
        await prisma.product.findUnique({
          where: {
            id:
              product.id,
          },

          select: {
            isArchived:
              true,

            archivedAt:
              true,
          },
        });

      check(
        storedProduct
          ?.isArchived ===
          false &&
          storedProduct
            ?.archivedAt ===
            null,
        "Seller access change does not archive or delete product"
      );
    }

    /*
     * ===================================================
     * 5. PRODUCT DISAPPEARS FROM PUBLIC MARKETPLACE
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getProducts(
        createPublicRequest(),
        response
      );

      const products =
        Array.isArray(
          captured.body
            ?.products
        )
          ? captured.body.products
          : [];

      check(
        captured.statusCode ===
          200 &&
          !products.some(
            (
              item: any
            ) =>
              item.id ===
              product.id
          ),
        "Pending-review seller product is hidden from marketplace"
      );
    }

    /*
     * ===================================================
     * 6. DIRECT PRODUCT URL BECOMES UNAVAILABLE
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getProductById(
        createPublicRequest({
          id:
            String(
              product.id
            ),
        }),
        response
      );

      check(
        captured.statusCode ===
          404,
        "Pending-review seller product detail is hidden"
      );
    }

    /*
     * ===================================================
     * 7. STALE CART / DIRECT CHECKOUT IS BLOCKED
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
                  product.id,

                quantity:
                  1,
              },
            ],
          }
        ),
        response
      );

      check(
        captured.statusCode ===
          400 &&
          captured.body
            ?.message ===
            "One or more products in your cart are no longer available.",
        "Stale cart checkout is blocked after seller loses access"
      );
    }

    /*
     * ===================================================
     * 8. EXISTING ORDER IS STILL PRESERVED
     * ===================================================
     */

    if (
      orderId
    ) {
      const existingOrder =
        await prisma.order.findUnique({
          where: {
            id:
              orderId,
          },

          include: {
            items: {
              select: {
                productId:
                  true,

                vendorId:
                  true,

                productTitle:
                  true,
              },
            },
          },
        });

      check(
        Boolean(
          existingOrder
        ) &&
          existingOrder
            ?.items
            .some(
              (
                item
              ) =>
                item.productId ===
                  product.id &&
                item.vendorId ===
                  seller.id
            ) ===
            true,
        "Existing order remains preserved after seller loses access"
      );
    } else {
      check(
        false,
        "Existing order remains preserved after seller loses access"
      );
    }

    /*
     * ===================================================
     * SELLER BECOMES ACTIVE AGAIN
     * ===================================================
     */

    await prisma.vendorProfile.update({
      where: {
        userId:
          seller.id,
      },

      data: {
        accessStatus:
          VendorAccessStatus.active,
      },
    });

    /*
     * ===================================================
     * 9. SAME PRODUCT AUTOMATICALLY REAPPEARS
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getProducts(
        createPublicRequest(),
        response
      );

      const products =
        Array.isArray(
          captured.body
            ?.products
        )
          ? captured.body.products
          : [];

      check(
        captured.statusCode ===
          200 &&
          products.some(
            (
              item: any
            ) =>
              item.id ===
              product.id
          ),
        "Same product automatically returns when seller access becomes active"
      );
    }

    /*
     * ===================================================
     * 10. DIRECT PRODUCT DETAIL RETURNS AGAIN
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getProductById(
        createPublicRequest({
          id:
            String(
              product.id
            ),
        }),
        response
      );

      check(
        captured.statusCode ===
          200 &&
          captured.body
            ?.product
            ?.id ===
            product.id,
        "Same product detail becomes public again after reactivation"
      );
    }

    /*
     * ===================================================
     * 11. PRODUCT WAS NEVER ARCHIVED DURING TRANSITION
     * ===================================================
     */

    {
      const storedProduct =
        await prisma.product.findUnique({
          where: {
            id:
              product.id,
          },

          select: {
            isArchived:
              true,

            archivedAt:
              true,
          },
        });

      check(
        storedProduct
          ?.isArchived ===
          false &&
          storedProduct
            ?.archivedAt ===
            null,
        "Temporary seller restriction never changes product archive state"
      );
    }
  } finally {
    /*
     * ===================================================
     * CLEANUP
     * ===================================================
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

    if (
      productId
    ) {
      await prisma.product.deleteMany({
        where: {
          id:
            productId,
        },
      });
    }

    const userIds =
      [
        sellerId,
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

  console.log("");
  console.log(
    "=============================================="
  );

  console.log(
    `Seller availability tests: ${passed} passed, ${failed} failed`
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
        "Seller availability test crashed:",
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