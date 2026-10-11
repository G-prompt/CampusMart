import type {
  Response,
} from "express";

import {
  UserRole,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

import type {
  AuthenticatedRequest,
} from "../src/middleware/auth.middleware";

import {
  createOrder,
} from "../src/controllers/order.controller";

import {
  deleteProduct,
  getProductById,
  getProducts,
  getVendorProducts,
  restoreProduct,
} from "../src/controllers/product.controller";

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
    status(code: number) {
      captured.statusCode =
        code;

      return this;
    },

    json(body: unknown) {
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

function createRequest(
  overrides: Record<
    string,
    unknown
  > = {}
): AuthenticatedRequest {
  return {
    params: {},
    body: {},
    query: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
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
 * TEST
 * =======================================================
 */

async function main() {
  const testId =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  const vendorEmail =
    `archive-vendor-${testId}@campusmart.test`;

  const buyerEmail =
    `archive-buyer-${testId}@campusmart.test`;

  let vendorId:
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
     * CREATE TEMP USERS
     * ---------------------------------------------------
     */

    const vendor =
      await prisma.user.create({
        data: {
          name:
            "Archive Test Vendor",

          email:
            vendorEmail,

          passwordHash:
            "archive-test-password",

          role:
            UserRole.vendor,
        },
      });

    vendorId =
      vendor.id;

    const buyer =
      await prisma.user.create({
        data: {
          name:
            "Archive Test Buyer",

          email:
            buyerEmail,

          passwordHash:
            "archive-test-password",

          role:
            UserRole.client,
        },
      });

    buyerId =
      buyer.id;

    /*
     * ---------------------------------------------------
     * CREATE PUBLISHED PRODUCT
     * ---------------------------------------------------
     */

    const product =
      await prisma.product.create({
        data: {
          slug:
            `archive-test-${testId}`,

          title:
            "Archive Test Product",

          category:
            "Testing",

          price:
            2500,

          rating:
            0,

          description:
            "Temporary product used by the product archiving test.",

          images:
            [],

          vendorId:
            vendor.id,

          isArchived:
            false,

          archivedAt:
            null,
        },
      });

    productId =
      product.id;

    /*
     * ---------------------------------------------------
     * 1. PUBLISHED PRODUCT APPEARS PUBLICLY
     * ---------------------------------------------------
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getProducts(
        {} as any,
        response
      );

      const products =
        Array.isArray(
          captured.body?.products
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
        "Published listing appears in public marketplace"
      );
    }

    /*
     * ---------------------------------------------------
     * 2. PUBLISHED PRODUCT DETAIL IS AVAILABLE
     * ---------------------------------------------------
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      const request =
        createRequest({
          params: {
            id:
              String(
                product.id
              ),
          },
        });

      await getProductById(
        request as any,
        response
      );

      check(
        captured.statusCode ===
          200 &&
          captured.body?.product?.id ===
            product.id,
        "Published listing public detail is available"
      );
    }

    /*
     * ---------------------------------------------------
     * 3. PUBLISHED PRODUCT CAN BE ORDERED
     * ---------------------------------------------------
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      const request =
        createRequest({
          user: {
            id:
              buyer.id,

            role:
              UserRole.client,
          },

          body: {
            items: [
              {
                productId:
                  product.id,

                quantity:
                  1,
              },
            ],

            pickupLocation:
              "Archive Test Pickup",

            preferredSlot:
              "12:00 PM",
          },
        });

      await createOrder(
        request,
        response
      );

      check(
        captured.statusCode ===
          201 &&
          captured.body?.success ===
            true,
        "Published listing can be purchased"
      );

      if (
        captured.body?.order?.id
      ) {
        orderId =
          captured.body.order.id;
      }
    }

    /*
     * ---------------------------------------------------
     * 4. ARCHIVE PRODUCT
     * ---------------------------------------------------
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      const request =
        createRequest({
          user: {
            id:
              vendor.id,

            role:
              UserRole.vendor,
          },

          params: {
            id:
              String(
                product.id
              ),
          },
        });

      await deleteProduct(
        request,
        response
      );

      check(
        captured.statusCode ===
          200 &&
          captured.body?.success ===
            true &&
          captured.body?.product
            ?.isArchived ===
            true,
        "Seller can archive own listing"
      );
    }

    /*
     * ---------------------------------------------------
     * 5. DATABASE ROW STILL EXISTS
     * ---------------------------------------------------
     */

    {
      const archived =
        await prisma.product.findUnique({
          where: {
            id:
              product.id,
          },
        });

      check(
        archived !==
          null &&
          archived.isArchived ===
            true &&
          archived.archivedAt !==
            null,
        "Archived listing remains in database with archivedAt timestamp"
      );
    }

    /*
     * ---------------------------------------------------
     * 6. ARCHIVED PRODUCT DISAPPEARS FROM MARKETPLACE
     * ---------------------------------------------------
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getProducts(
        {} as any,
        response
      );

      const products =
        Array.isArray(
          captured.body?.products
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
        "Archived listing is hidden from public marketplace"
      );
    }

    /*
     * ---------------------------------------------------
     * 7. ARCHIVED PRODUCT DETAIL RETURNS 404
     * ---------------------------------------------------
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      const request =
        createRequest({
          params: {
            id:
              String(
                product.id
              ),
          },
        });

      await getProductById(
        request as any,
        response
      );

      check(
        captured.statusCode ===
          404,
        "Archived listing public detail returns 404"
      );
    }

    /*
     * ---------------------------------------------------
     * 8. STALE CART CANNOT ORDER ARCHIVED PRODUCT
     * ---------------------------------------------------
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      const request =
        createRequest({
          user: {
            id:
              buyer.id,

            role:
              UserRole.client,
          },

          body: {
            items: [
              {
                productId:
                  product.id,

                quantity:
                  1,
              },
            ],
          },
        });

      await createOrder(
        request,
        response
      );

      check(
        captured.statusCode ===
          400 &&
          captured.body?.success ===
            false &&
          typeof captured.body
            ?.message ===
            "string" &&
          captured.body.message.includes(
            "no longer available"
          ),
        "Archived listing is rejected at checkout from stale cart"
      );
    }

    /*
     * ---------------------------------------------------
     * 9. SELLER STILL SEES ARCHIVED LISTING
     * ---------------------------------------------------
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      const request =
        createRequest({
          user: {
            id:
              vendor.id,

            role:
              UserRole.vendor,
          },
        });

      await getVendorProducts(
        request,
        response
      );

      const products =
        Array.isArray(
          captured.body?.products
        )
          ? captured.body.products
          : [];

      const archived =
        products.find(
          (
            item: any
          ) =>
            item.id ===
            product.id
        );

      check(
        captured.statusCode ===
          200 &&
          archived?.isArchived ===
            true,
        "Seller history still contains archived listing"
      );
    }

    /*
     * ---------------------------------------------------
     * 10. RESTORE PRODUCT
     * ---------------------------------------------------
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      const request =
        createRequest({
          user: {
            id:
              vendor.id,

            role:
              UserRole.vendor,
          },

          params: {
            id:
              String(
                product.id
              ),
          },
        });

      await restoreProduct(
        request,
        response
      );

      check(
        captured.statusCode ===
          200 &&
          captured.body?.success ===
            true &&
          captured.body?.product
            ?.isArchived ===
            false &&
          captured.body?.product
            ?.archivedAt ===
            null,
        "Archived listing can be restored"
      );
    }

    /*
     * ---------------------------------------------------
     * 11. RESTORED PRODUCT IS PUBLIC AGAIN
     * ---------------------------------------------------
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getProducts(
        {} as any,
        response
      );

      const products =
        Array.isArray(
          captured.body?.products
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
              product.id &&
              item.isArchived ===
                false
          ),
        "Restored listing returns to public marketplace"
      );
    }

    /*
     * ---------------------------------------------------
     * 12. HISTORICAL ORDER SURVIVES ARCHIVE / RESTORE
     * ---------------------------------------------------
     */

    if (
      orderId
    ) {
      const historicalOrder =
        await prisma.order.findUnique({
          where: {
            id:
              orderId,
          },

          include: {
            items:
              true,
          },
        });

      check(
        historicalOrder !==
          null &&
          historicalOrder.items.some(
            (
              item
            ) =>
              item.productId ===
              product.id
          ),
        "Existing order history remains connected to listing"
      );
    } else {
      check(
        false,
        "Existing order history remains connected to listing"
      );
    }
  } finally {
    /*
     * ===================================================
     * CLEANUP
     * ===================================================
     *
     * Orders must be removed before the temporary users.
     */

    if (
      buyerId ||
      vendorId
    ) {
      await prisma.order.deleteMany({
        where: {
          OR: [
            ...(buyerId
              ? [
                  {
                    buyerId,
                  },
                ]
              : []),

            ...(vendorId
              ? [
                  {
                    items: {
                      some: {
                        vendorId,
                      },
                    },
                  },
                ]
              : []),
          ],
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

    if (
      buyerId ||
      vendorId
    ) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              ...(buyerId
                ? [
                    buyerId,
                  ]
                : []),

              ...(vendorId
                ? [
                    vendorId,
                  ]
                : []),
            ],
          },
        },
      });
    }
  }

  console.log("");
  console.log(
    "======================================"
  );
  console.log(
    `Product archiving tests: ${passed} passed, ${failed} failed`
  );
  console.log(
    "======================================"
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
        "Product archiving test crashed:",
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