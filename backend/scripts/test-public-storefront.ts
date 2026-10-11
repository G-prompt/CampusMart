import type {
  Request,
  Response,
} from "express";

import {
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
  VendorVerificationStatus,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

import {
  getPublicVendorStorefront,
} from "../src/controllers/vendor.controller";

/*
 * =======================================================
 * MOCK RESPONSE
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
  vendorId:
    string
): Request {
  return {
    params: {
      vendorId,
    },
  } as unknown as Request;
}

/*
 * =======================================================
 * TEST HELPERS
 * =======================================================
 */

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

  const createdUserIds:
    string[] = [];

  let universityId:
    | string
    | null =
    null;

  try {
    /*
     * ---------------------------------------------------
     * TEMP UNIVERSITY
     * ---------------------------------------------------
     */

    const university =
      await prisma.university.create({
        data: {
          name:
            `Storefront Test University ${testId}`,

          shortName:
            "STU",

          slug:
            `storefront-test-university-${testId}`,

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

    const activeSeller =
      await prisma.user.create({
        data: {
          name:
            "Storefront Test Seller",

          email:
            `storefront-active-${testId}@campusmart.test`,

          passwordHash:
            "test-password",

          role:
            UserRole.vendor,

          phone:
            "08000000000",

          bio:
            "Private account bio test",

          universityId:
            university.id,

          matricNumber:
            `STU-${testId}`,

          studentVerificationStatus:
            StudentVerificationStatus.verified,

          studentVerifiedAt:
            new Date(),

          vendorProfile: {
            create: {
              businessName:
                "Storefront Test Shop",

              businessDescription:
                "Campus fashion and accessories.",

              pickupLocation:
                "Private Exact Pickup Location",

              accessStatus:
                VendorAccessStatus.active,

              vendorVerificationStatus:
                VendorVerificationStatus.verified,

              vendorVerifiedAt:
                new Date(),
            },
          },
        },
      });

    createdUserIds.push(
      activeSeller.id
    );

    /*
     * ---------------------------------------------------
     * ACTIVE SELLER PRODUCTS
     * ---------------------------------------------------
     */

    const publishedProduct =
      await prisma.product.create({
        data: {
          slug:
            `storefront-published-${testId}`,

          title:
            "Published Storefront Product",

          category:
            "Fashion",

          price:
            5000,

          rating:
            4.5,

          description:
            "This product should appear publicly.",

          images:
            [],

          vendorId:
            activeSeller.id,

          isArchived:
            false,

          archivedAt:
            null,
        },
      });

    const archivedProduct =
      await prisma.product.create({
        data: {
          slug:
            `storefront-archived-${testId}`,

          title:
            "Archived Storefront Product",

          category:
            "Fashion",

          price:
            6500,

          rating:
            4,

          description:
            "This product must not appear publicly.",

          images:
            [],

          vendorId:
            activeSeller.id,

          isArchived:
            true,

          archivedAt:
            new Date(),
        },
      });

    /*
     * ---------------------------------------------------
     * OTHER SELLER ACCESS STATES
     * ---------------------------------------------------
     */

    const pendingSeller =
      await prisma.user.create({
        data: {
          name:
            "Pending Storefront Seller",

          email:
            `storefront-pending-${testId}@campusmart.test`,

          passwordHash:
            "test-password",

          role:
            UserRole.vendor,

          universityId:
            university.id,

          studentVerificationStatus:
            StudentVerificationStatus.pending,

          vendorProfile: {
            create: {
              businessName:
                "Pending Shop",

              businessDescription:
                "Pending seller",

              pickupLocation:
                "Pending pickup",

              accessStatus:
                VendorAccessStatus.pending_review,
            },
          },
        },
      });

    createdUserIds.push(
      pendingSeller.id
    );

    const restrictedSeller =
      await prisma.user.create({
        data: {
          name:
            "Restricted Storefront Seller",

          email:
            `storefront-restricted-${testId}@campusmart.test`,

          passwordHash:
            "test-password",

          role:
            UserRole.vendor,

          universityId:
            university.id,

          studentVerificationStatus:
            StudentVerificationStatus.verified,

          vendorProfile: {
            create: {
              businessName:
                "Restricted Shop",

              businessDescription:
                "Restricted seller",

              pickupLocation:
                "Restricted pickup",

              accessStatus:
                VendorAccessStatus.restricted,
            },
          },
        },
      });

    createdUserIds.push(
      restrictedSeller.id
    );

    const suspendedSeller =
      await prisma.user.create({
        data: {
          name:
            "Suspended Storefront Seller",

          email:
            `storefront-suspended-${testId}@campusmart.test`,

          passwordHash:
            "test-password",

          role:
            UserRole.vendor,

          universityId:
            university.id,

          studentVerificationStatus:
            StudentVerificationStatus.verified,

          vendorProfile: {
            create: {
              businessName:
                "Suspended Shop",

              businessDescription:
                "Suspended seller",

              pickupLocation:
                "Suspended pickup",

              accessStatus:
                VendorAccessStatus.suspended,
            },
          },
        },
      });

    createdUserIds.push(
      suspendedSeller.id
    );

    /*
     * ---------------------------------------------------
     * BUYER ACCOUNT
     * ---------------------------------------------------
     */

    const buyer =
      await prisma.user.create({
        data: {
          name:
            "Storefront Test Buyer",

          email:
            `storefront-buyer-${testId}@campusmart.test`,

          passwordHash:
            "test-password",

          role:
            UserRole.client,

          universityId:
            university.id,
        },
      });

    createdUserIds.push(
      buyer.id
    );

    /*
     * ===================================================
     * 1. ACTIVE SELLER STOREFRONT RETURNS 200
     * ===================================================
     */

    let activeStorefrontBody:
      any =
      null;

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getPublicVendorStorefront(
        createRequest(
          activeSeller.id
        ),
        response
      );

      activeStorefrontBody =
        captured.body;

      check(
        captured.statusCode ===
          200 &&
          captured.body?.success ===
            true,
        "Active seller storefront returns 200"
      );
    }

    /*
     * ===================================================
     * 2. PUBLIC BUSINESS IDENTITY IS CORRECT
     * ===================================================
     */

    check(
      activeStorefrontBody
        ?.storefront
        ?.businessName ===
        "Storefront Test Shop" &&
        activeStorefrontBody
          ?.storefront
          ?.ownerName ===
          "Storefront Test Seller",
      "Storefront exposes correct public seller identity"
    );

    /*
     * ===================================================
     * 3. UNIVERSITY INFORMATION IS EXPOSED SAFELY
     * ===================================================
     */

    check(
      activeStorefrontBody
        ?.storefront
        ?.university
        ?.name ===
        university.name &&
        activeStorefrontBody
          ?.storefront
          ?.university
          ?.shortName ===
          "STU" &&
        activeStorefrontBody
          ?.storefront
          ?.university
          ?.managed ===
          true,
      "Storefront returns managed university information"
    );

    /*
     * ===================================================
     * 4. STUDENT VERIFICATION BADGE IS ACCURATE
     * ===================================================
     */

    check(
      activeStorefrontBody
        ?.storefront
        ?.badges
        ?.studentVerified ===
        true,
      "Student verified badge is accurate"
    );

    /*
     * ===================================================
     * 5. VENDOR VERIFICATION BADGE IS ACCURATE
     * ===================================================
     */

    check(
      activeStorefrontBody
        ?.storefront
        ?.badges
        ?.vendorVerified ===
        true,
      "Vendor verified badge is accurate"
    );

    /*
     * ===================================================
     * 6. PUBLISHED PRODUCT IS INCLUDED
     * ===================================================
     */

    const returnedProducts =
      Array.isArray(
        activeStorefrontBody
          ?.products
      )
        ? activeStorefrontBody.products
        : [];

    check(
      returnedProducts.some(
        (
          product: any
        ) =>
          product.id ===
          publishedProduct.id
      ),
      "Published product appears on storefront"
    );

    /*
     * ===================================================
     * 7. ARCHIVED PRODUCT IS EXCLUDED
     * ===================================================
     */

    check(
      !returnedProducts.some(
        (
          product: any
        ) =>
          product.id ===
          archivedProduct.id
      ) &&
        activeStorefrontBody
          ?.storefront
          ?.listingCount ===
          1,
      "Archived product is excluded from storefront"
    );

    /*
     * ===================================================
     * 8. PRIVATE ACCOUNT DATA IS NOT EXPOSED
     * ===================================================
     */

    const storefrontText =
      JSON.stringify(
        activeStorefrontBody
      );

    check(
      !storefrontText.includes(
        activeSeller.email
      ) &&
        !storefrontText.includes(
          "08000000000"
        ) &&
        !storefrontText.includes(
          `STU-${testId}`
        ) &&
        !storefrontText.includes(
          "Private Exact Pickup Location"
        ) &&
        !storefrontText.includes(
          "Private account bio test"
        ),
      "Private seller fields are not exposed publicly"
    );

    /*
     * ===================================================
     * 9. PENDING SELLER RETURNS 404
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getPublicVendorStorefront(
        createRequest(
          pendingSeller.id
        ),
        response
      );

      check(
        captured.statusCode ===
          404 &&
          captured.body?.message ===
            "Seller storefront not available.",
        "Pending seller storefront is hidden"
      );
    }

    /*
     * ===================================================
     * 10. RESTRICTED SELLER RETURNS 404
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getPublicVendorStorefront(
        createRequest(
          restrictedSeller.id
        ),
        response
      );

      check(
        captured.statusCode ===
          404 &&
          captured.body?.message ===
            "Seller storefront not available.",
        "Restricted seller storefront is hidden"
      );
    }

    /*
     * ===================================================
     * 11. SUSPENDED SELLER RETURNS 404
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getPublicVendorStorefront(
        createRequest(
          suspendedSeller.id
        ),
        response
      );

      check(
        captured.statusCode ===
          404 &&
          captured.body?.message ===
            "Seller storefront not available.",
        "Suspended seller storefront is hidden"
      );
    }

    /*
     * ===================================================
     * 12. BUYER ACCOUNT RETURNS 404
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getPublicVendorStorefront(
        createRequest(
          buyer.id
        ),
        response
      );

      check(
        captured.statusCode ===
          404 &&
          captured.body?.message ===
            "Seller storefront not available.",
        "Buyer account cannot expose a seller storefront"
      );
    }

    /*
     * ===================================================
     * 13. UNKNOWN SELLER RETURNS 404
     * ===================================================
     */

    {
      const {
        response,
        captured,
      } =
        createMockResponse();

      await getPublicVendorStorefront(
        createRequest(
          "this-seller-does-not-exist"
        ),
        response
      );

      check(
        captured.statusCode ===
          404 &&
          captured.body?.message ===
            "Seller storefront not available.",
        "Unknown seller returns generic storefront 404"
      );
    }
  } finally {
    /*
     * ===================================================
     * CLEANUP
     * ===================================================
     */

    if (
      createdUserIds.length >
      0
    ) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in:
              createdUserIds,
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
    "======================================"
  );
  console.log(
    `Public storefront tests: ${passed} passed, ${failed} failed`
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
        "Public storefront test crashed:",
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