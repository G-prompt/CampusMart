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
 * CAMPUSMART SELLER MARKETPLACE AVAILABILITY TEST
 * =======================================================
 *
 * Proves that the same canonical seller eligibility rules
 * control:
 *
 * - public marketplace visibility
 * - public product detail
 * - new checkout
 *
 * It specifically protects against eligibility drift
 * between controllers.
 *
 * Important cases:
 *
 * - whitespace matric numbers
 * - whitespace seller-profile fields
 * - pending_review
 * - restricted
 * - suspended
 * - temporary ineligibility never archives a product
 * - public reads / checkout do not reconcile seller state
 * - existing orders survive later seller ineligibility
 */

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

async function marketplaceContainsProduct(
  productId: number
) {
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

  return {
    status:
      captured.statusCode,

    contains:
      products.some(
        (
          item: any
        ) =>
          item.id ===
          productId
      ),

    body:
      captured.body,
  };
}

async function getPublicProductDetail(
  productId: number
) {
  const {
    response,
    captured,
  } =
    createMockResponse();

  await getProductById(
    createPublicRequest({
      id:
        String(
          productId
        ),
    }),
    response
  );

  return captured;
}

async function attemptCheckout(
  buyer: {
    id: string;
    role: UserRole;
  },
  productId: number
) {
  const {
    response,
    captured,
  } =
    createMockResponse();

  await createOrder(
    createAuthenticatedRequest(
      buyer,
      {
        items: [
          {
            productId,
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

  return captured;
}

async function productArchiveState(
  productId: number
) {
  return prisma.product.findUnique({
    where: {
      id:
        productId,
    },

    select: {
      isArchived:
        true,

      archivedAt:
        true,
    },
  });
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

  let initialOrderId:
    | string
    | null =
    null;

  try {
    /*
     * =====================================================
     * UNIVERSITY
     * =====================================================
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
     * =====================================================
     * ACTIVE VERIFIED SELLER
     * =====================================================
     */

    const originalMatricNumber =
      `SATU-${testId}`;

    const originalBusinessName =
      "Availability Test Shop";

    const originalBusinessDescription =
      "Temporary seller used for availability testing.";

    const originalPickupLocation =
      "Campus Gate";

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
            originalMatricNumber,

          studentVerificationStatus:
            StudentVerificationStatus.verified,

          studentVerifiedAt:
            new Date(),

          vendorProfile: {
            create: {
              businessName:
                originalBusinessName,

              businessDescription:
                originalBusinessDescription,

              pickupLocation:
                originalPickupLocation,

              accessStatus:
                VendorAccessStatus.active,
            },
          },
        },
      });

    sellerId =
      seller.id;

    /*
     * =====================================================
     * BUYER
     * =====================================================
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
     * =====================================================
     * PUBLISHED PRODUCT
     * =====================================================
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

    const buyerIdentity = {
      id:
        buyer.id,

      role:
        buyer.role,
    };

    /*
     * =====================================================
     * 1-3. FULLY ELIGIBLE SELLER
     * =====================================================
     */

    {
      const marketplace =
        await marketplaceContainsProduct(
          product.id
        );

      check(
        marketplace.status ===
          200 &&
        marketplace.contains,
        "Eligible seller product appears in public marketplace."
      );
    }

    {
      const detail =
        await getPublicProductDetail(
          product.id
        );

      check(
        detail.statusCode ===
          200 &&
        detail.body
          ?.product
          ?.id ===
          product.id,
        "Eligible seller product detail is publicly available."
      );
    }

    {
      const checkout =
        await attemptCheckout(
          buyerIdentity,
          product.id
        );

      if (
        checkout.body
          ?.order
          ?.id
      ) {
        initialOrderId =
          checkout.body.order.id;
      }

      check(
        checkout.statusCode ===
          201 &&
        checkout.body
          ?.success ===
          true &&
        Boolean(
          checkout.body
            ?.order
            ?.id
        ),
        "Eligible seller can receive a new order."
      );
    }

    /*
     * =====================================================
     * WHITESPACE MATRIC NUMBER
     * =====================================================
     *
     * The old duplicated Prisma predicates only checked
     * matricNumber != null.
     *
     * Therefore "   " could incorrectly pass there while
     * canonical hasText() correctly rejects it.
     */

    await prisma.user.update({
      where: {
        id:
          seller.id,
      },

      data: {
        matricNumber:
          "   ",
      },
    });

    {
      const marketplace =
        await marketplaceContainsProduct(
          product.id
        );

      check(
        marketplace.status ===
          200 &&
        !marketplace.contains,
        "Whitespace-only matric number hides product from marketplace."
      );
    }

    {
      const detail =
        await getPublicProductDetail(
          product.id
        );

      check(
        detail.statusCode ===
          404,
        "Whitespace-only matric number hides direct product detail."
      );
    }

    {
      const checkout =
        await attemptCheckout(
          buyerIdentity,
          product.id
        );

      check(
        checkout.statusCode ===
          400 &&
        checkout.body
          ?.message ===
          "One or more products in your cart are no longer available.",
        "Whitespace-only matric number blocks new checkout."
      );
    }

    {
      const stored =
        await productArchiveState(
          product.id
        );

      check(
        stored
          ?.isArchived ===
          false &&
        stored
          ?.archivedAt ===
          null,
        "Whitespace matric ineligibility does not archive the listing."
      );
    }

    /*
     * =====================================================
     * RESTORE VALID MATRIC NUMBER
     * =====================================================
     */

    await prisma.user.update({
      where: {
        id:
          seller.id,
      },

      data: {
        matricNumber:
          originalMatricNumber,
      },
    });

    {
      const marketplace =
        await marketplaceContainsProduct(
          product.id
        );

      check(
        marketplace.status ===
          200 &&
        marketplace.contains,
        "Product returns to marketplace after valid matric number is restored."
      );
    }

    {
      const detail =
        await getPublicProductDetail(
          product.id
        );

      check(
        detail.statusCode ===
          200,
        "Product detail returns after valid matric number is restored."
      );
    }

    {
      const checkout =
        await attemptCheckout(
          buyerIdentity,
          product.id
        );

      check(
        checkout.statusCode ===
          201,
        "Checkout works again after valid matric number is restored."
      );
    }

    /*
     * =====================================================
     * WHITESPACE SELLER PROFILE FIELD
     * =====================================================
     *
     * The old duplicated Prisma predicates checked:
     *
     * businessDescription != ""
     *
     * which still accepts whitespace-only values.
     *
     * Canonical hasText() must reject this.
     */

    await prisma.vendorProfile.update({
      where: {
        userId:
          seller.id,
      },

      data: {
        businessDescription:
          "   ",
      },
    });

    {
      const marketplace =
        await marketplaceContainsProduct(
          product.id
        );

      check(
        marketplace.status ===
          200 &&
        !marketplace.contains,
        "Whitespace-only seller profile field hides product from marketplace."
      );
    }

    {
      const detail =
        await getPublicProductDetail(
          product.id
        );

      check(
        detail.statusCode ===
          404,
        "Whitespace-only seller profile field hides direct product detail."
      );
    }

    {
      const checkout =
        await attemptCheckout(
          buyerIdentity,
          product.id
        );

      check(
        checkout.statusCode ===
          400 &&
        checkout.body
          ?.message ===
          "One or more products in your cart are no longer available.",
        "Whitespace-only seller profile field blocks checkout."
      );
    }

    /*
     * =====================================================
     * RESTORE COMPLETE SELLER PROFILE
     * =====================================================
     */

    await prisma.vendorProfile.update({
      where: {
        userId:
          seller.id,
      },

      data: {
        businessDescription:
          originalBusinessDescription,
      },
    });

    {
      const marketplace =
        await marketplaceContainsProduct(
          product.id
        );

      check(
        marketplace.status ===
          200 &&
        marketplace.contains,
        "Product returns after seller profile is complete again."
      );
    }

    {
      const detail =
        await getPublicProductDetail(
          product.id
        );

      check(
        detail.statusCode ===
          200,
        "Product detail returns after seller profile is complete again."
      );
    }

    {
      const checkout =
        await attemptCheckout(
          buyerIdentity,
          product.id
        );

      check(
        checkout.statusCode ===
          201,
        "Checkout works after seller profile is complete again."
      );
    }

    /*
     * =====================================================
     * PENDING REVIEW
     * =====================================================
     *
     * Public reads and buyer checkout are deliberately
     * read-only with respect to seller access.
     *
     * They must NOT auto-promote pending_review back to
     * active simply because all other requirements are
     * currently complete.
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

    {
      const marketplace =
        await marketplaceContainsProduct(
          product.id
        );

      check(
        marketplace.status ===
          200 &&
        !marketplace.contains,
        "Pending-review seller product is hidden from marketplace."
      );
    }

    {
      const detail =
        await getPublicProductDetail(
          product.id
        );

      check(
        detail.statusCode ===
          404,
        "Pending-review seller product detail is hidden."
      );
    }

    {
      const checkout =
        await attemptCheckout(
          buyerIdentity,
          product.id
        );

      check(
        checkout.statusCode ===
          400,
        "Pending-review seller cannot receive a new checkout."
      );
    }

    {
      const profile =
        await prisma.vendorProfile.findUnique({
          where: {
            userId:
              seller.id,
          },

          select: {
            accessStatus:
              true,
          },
        });

      check(
        profile
          ?.accessStatus ===
          VendorAccessStatus.pending_review,
        "Public browsing and checkout do not reconcile pending_review seller state."
      );
    }

    /*
     * =====================================================
     * RESTRICTED
     * =====================================================
     */

    await prisma.vendorProfile.update({
      where: {
        userId:
          seller.id,
      },

      data: {
        accessStatus:
          VendorAccessStatus.restricted,
      },
    });

    {
      const marketplace =
        await marketplaceContainsProduct(
          product.id
        );

      check(
        marketplace.status ===
          200 &&
        !marketplace.contains,
        "Restricted seller product is hidden from marketplace."
      );
    }

    {
      const detail =
        await getPublicProductDetail(
          product.id
        );

      check(
        detail.statusCode ===
          404,
        "Restricted seller product detail is hidden."
      );
    }

    {
      const checkout =
        await attemptCheckout(
          buyerIdentity,
          product.id
        );

      check(
        checkout.statusCode ===
          400,
        "Restricted seller cannot receive a new checkout."
      );
    }

    {
      const profile =
        await prisma.vendorProfile.findUnique({
          where: {
            userId:
              seller.id,
          },

          select: {
            accessStatus:
              true,
          },
        });

      check(
        profile
          ?.accessStatus ===
          VendorAccessStatus.restricted,
        "Marketplace activity never overrides restricted seller state."
      );
    }

    /*
     * =====================================================
     * SUSPENDED
     * =====================================================
     */

    await prisma.vendorProfile.update({
      where: {
        userId:
          seller.id,
      },

      data: {
        accessStatus:
          VendorAccessStatus.suspended,
      },
    });

    {
      const marketplace =
        await marketplaceContainsProduct(
          product.id
        );

      check(
        marketplace.status ===
          200 &&
        !marketplace.contains,
        "Suspended seller product is hidden from marketplace."
      );
    }

    {
      const detail =
        await getPublicProductDetail(
          product.id
        );

      check(
        detail.statusCode ===
          404,
        "Suspended seller product detail is hidden."
      );
    }

    {
      const checkout =
        await attemptCheckout(
          buyerIdentity,
          product.id
        );

      check(
        checkout.statusCode ===
          400,
        "Suspended seller cannot receive a new checkout."
      );
    }

    {
      const profile =
        await prisma.vendorProfile.findUnique({
          where: {
            userId:
              seller.id,
          },

          select: {
            accessStatus:
              true,
          },
        });

      check(
        profile
          ?.accessStatus ===
          VendorAccessStatus.suspended,
        "Marketplace activity never overrides suspended seller state."
      );
    }

    /*
     * =====================================================
     * EXISTING ORDER PRESERVATION
     * =====================================================
     */

    if (
      initialOrderId
    ) {
      const existingOrder =
        await prisma.order.findUnique({
          where: {
            id:
              initialOrderId,
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
        "Existing order remains preserved after seller later becomes unavailable."
      );
    } else {
      check(
        false,
        "Existing order remains preserved after seller later becomes unavailable."
      );
    }

    /*
     * =====================================================
     * MANUAL REACTIVATION
     * =====================================================
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

    {
      const marketplace =
        await marketplaceContainsProduct(
          product.id
        );

      check(
        marketplace.status ===
          200 &&
        marketplace.contains,
        "Same product returns after seller access becomes active again."
      );
    }

    {
      const detail =
        await getPublicProductDetail(
          product.id
        );

      check(
        detail.statusCode ===
          200 &&
        detail.body
          ?.product
          ?.id ===
          product.id,
        "Same product detail becomes public after seller reactivation."
      );
    }

    {
      const checkout =
        await attemptCheckout(
          buyerIdentity,
          product.id
        );

      check(
        checkout.statusCode ===
          201,
        "Seller can receive new checkout again after reactivation."
      );
    }

    /*
     * =====================================================
     * FINAL ARCHIVE INVARIANT
     * =====================================================
     */

    {
      const stored =
        await productArchiveState(
          product.id
        );

      check(
        stored
          ?.isArchived ===
          false &&
        stored
          ?.archivedAt ===
          null,
        "All temporary seller eligibility transitions leave product archive state untouched."
      );
    }
  } finally {
    /*
     * =====================================================
     * CLEANUP
     * =====================================================
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