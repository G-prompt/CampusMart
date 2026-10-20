
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

import { prisma } from "../src/lib/prisma";

import {
  createFulfillmentCodeMaterial,
} from "../src/services/fulfillmentCode.service";

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error("JWT_SECRET is not set.");
}

const stamp = `${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

const HOUR = 60 * 60 * 1000;

const userIds: string[] = [];
const productIds: number[] = [];
const orderIds: string[] = [];

let universityId: string | null = null;
let passed = 0;
let failed = 0;

function check(
  condition: unknown,
  description: string
) {
  const number = passed + failed + 1;

  if (condition) {
    passed++;
    console.log(`PASS ${number}: ${description}`);
  } else {
    failed++;
    console.error(`FAIL ${number}: ${description}`);
  }
}

function token(id: string, role: UserRole) {
  return jwt.sign(
    { userId: id, role },
    secret!,
    { expiresIn: "1h" }
  );
}

async function api(
  base: string,
  url: string,
  authToken?: string,
  body?: unknown
) {
  const response = await fetch(base + url, {
    method: body === undefined ? "GET" : "POST",

    headers: {
      ...(authToken
        ? { Authorization: `Bearer ${authToken}` }
        : {}),

      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },

    body:
      body === undefined
        ? undefined
        : JSON.stringify(body),
  });

  const raw = await response.text();

  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  return {
    status: response.status,
    data,
  };
}

async function cleanup() {
  if (orderIds.length) {
    await prisma.order.deleteMany({
      where: {
        id: { in: orderIds },
      },
    });
  }

  if (productIds.length) {
    await prisma.product.deleteMany({
      where: {
        id: { in: productIds },
      },
    });
  }

  if (userIds.length) {
    await prisma.user.deleteMany({
      where: {
        id: { in: userIds },
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
    "\nCampusMart verified-purchase product review tests\n"
  );

  let server:
    | ReturnType<typeof app.listen>
    | null = null;

  try {
    const university = await prisma.university.create({
      data: {
        name: `Review QA University ${stamp}`,
        shortName: "RQA",
        slug: `review-qa-${stamp}`,
        country: "Nigeria",
        state: "Rivers",
        city: "Port Harcourt",
        active: true,
      },
    });

    universityId = university.id;

    async function createBuyer(name: string) {
      const person = await prisma.user.create({
        data: {
          name,

          email: `review-${name
            .toLowerCase()
            .replace(/\s/g, "-")}-${stamp}@example.com`,

          passwordHash: "test-only-password-hash",
          phone: "08123456789",
          universityId: university.id,
          role: UserRole.client,
        },
      });

      userIds.push(person.id);

      return person;
    }

    async function createSeller(name: string) {
      const person = await prisma.user.create({
        data: {
          name,

          email: `review-${name
            .toLowerCase()
            .replace(/\s/g, "-")}-${stamp}@example.com`,

          passwordHash: "test-only-password-hash",
          phone: "08123456789",
          universityId: university.id,
          role: UserRole.vendor,

          matricNumber: `REVIEW-${name}-${stamp}`,

          studentVerificationStatus:
            StudentVerificationStatus.verified,

          studentVerifiedAt: new Date(),

          vendorProfile: {
            create: {
              businessName: `${name} Store`,

              businessDescription:
                "Review integration test store",

              pickupLocation: "Campus Gate",

              accessStatus:
                VendorAccessStatus.active,
            },
          },
        },
      });

      userIds.push(person.id);

      return person;
    }

    const buyerA = await createBuyer("Buyer A");
    const buyerB = await createBuyer("Buyer B");
    const stranger = await createBuyer("Stranger");

    const sellerA = await createSeller("Seller A");
    const sellerB = await createSeller("Seller B");

    async function createProduct(
      name: string,
      vendorId: string
    ) {
      const product = await prisma.product.create({
        data: {
          slug: `review-qa-${name.toLowerCase()}-${stamp}`,
          title: `Review QA ${name}`,
          category: "Electronics",
          price: 10000,
          rating: 0,

          description:
            "Temporary product for review eligibility tests",

          images: [],
          sizes: [],
          colors: [],
          vendorId,
        },
      });

      productIds.push(product.id);

      return product;
    }

    const productA = await createProduct(
      "A",
      sellerA.id
    );

    const productB = await createProduct(
      "B",
      sellerB.id
    );

    /*
     * MULTI-SELLER ORDER
     */

    const mixedOrder = await prisma.order.create({
      data: {
        buyerId: buyerA.id,
        paymentStatus: PaymentStatus.paid,
        status: OrderStatus.pending,
        subtotal: 20000,
        fee: 0,
        total: 20000,

        items: {
          create: [
            {
              productId: productA.id,
              vendorId: sellerA.id,
              productTitle: productA.title,
              unitPrice: 10000,
              lineTotal: 10000,
              quantity: 1,
              status: OrderStatus.pending,
            },
            {
              productId: productB.id,
              vendorId: sellerB.id,
              productTitle: productB.title,
              unitPrice: 10000,
              lineTotal: 10000,
              quantity: 1,
              status: OrderStatus.pending,
            },
          ],
        },
      },
    });

    orderIds.push(mixedOrder.id);

    const buyerAToken = token(
      buyerA.id,
      buyerA.role
    );

    const buyerBToken = token(
      buyerB.id,
      buyerB.role
    );

    const strangerToken = token(
      stranger.id,
      stranger.role
    );

    const sellerAToken = token(
      sellerA.id,
      sellerA.role
    );

    server = await new Promise<
      ReturnType<typeof app.listen>
    >((resolve, reject) => {
      const instance = app.listen(
        0,
        "127.0.0.1",
        () => resolve(instance)
      );

      instance.once("error", reject);
    });

    const address = server.address();

    if (
      !address ||
      typeof address === "string"
    ) {
      throw new Error("No test HTTP port");
    }

    const base =
      `http://127.0.0.1:${address.port}`;

    const reviewA =
      `/api/products/${productA.id}/reviews`;

    const reviewB =
      `/api/products/${productB.id}/reviews`;

    const eligibilityA =
      `${reviewA}/eligibility`;

    const eligibilityB =
      `${reviewB}/eligibility`;

    /*
     * PUBLIC ACCESS AND AUTHENTICATION
     */

    const publicEmpty = await api(base, reviewA);

    check(
      publicEmpty.status === 200 &&
        publicEmpty.data?.reviewCount === 0 &&
        Array.isArray(publicEmpty.data?.reviews) &&
        publicEmpty.data.reviews.length === 0,
      "Public reviews initially empty"
    );

    check(
      (await api(base, eligibilityA)).status === 401,
      "Anonymous eligibility is rejected"
    );

    check(
      (
        await api(
          base,
          reviewA,
          undefined,
          { rating: 5, comment: "fake" }
        )
      ).status === 401,
      "Anonymous review POST is rejected"
    );

    const neverPurchased = await api(
      base,
      eligibilityA,
      strangerToken
    );

    check(
      neverPurchased.status === 200 &&
        neverPurchased.data?.eligibility?.reason ===
          "purchase_required",
      "Non-buyer cannot review"
    );

    /*
     * ORDER EXISTS BUT IS NOT COMPLETED
     */

    const pendingA = await api(
      base,
      eligibilityA,
      buyerAToken
    );

    const pendingB = await api(
      base,
      eligibilityB,
      buyerAToken
    );

    check(
      pendingA.data?.eligibility?.reason ===
        "purchase_required",
      "Pending purchase A cannot be reviewed"
    );

    check(
      pendingB.data?.eligibility?.reason ===
        "purchase_required",
      "Pending purchase B cannot be reviewed"
    );

    /*
     * COMPLETION WITHOUT CODE VERIFICATION
     */

    await prisma.orderItem.updateMany({
      where: {
        orderId: mixedOrder.id,
        vendorId: sellerA.id,
      },

      data: {
        status: OrderStatus.completed,
      },
    });

    const completedWithoutCode = await api(
      base,
      eligibilityA,
      buyerAToken
    );

    check(
      completedWithoutCode.data?.eligibility?.reason ===
        "purchase_required",
      "Completed item without verified handoff remains ineligible"
    );

    /*
     * VERIFIED HANDOFF — ONLY FIVE HOURS AGO
     */

    const fiveHoursAgo = new Date(
      Date.now() - 5 * HOUR
    );

    const sevenHoursAgo = new Date(
      Date.now() - 7 * HOUR
    );

    const materialA =
      createFulfillmentCodeMaterial();

    await prisma.orderVendorFulfillment.create({
      data: {
        orderId: mixedOrder.id,
        vendorId: sellerA.id,

        codeHash: materialA.codeHash,

        codeCiphertext:
          materialA.codeCiphertext,

        verifiedAt: fiveHoursAgo,
      },
    });

    const tooSoon = await api(
      base,
      eligibilityA,
      buyerAToken
    );

    const eligibleAt = Date.parse(
      tooSoon.data?.eligibility?.eligibleAt ?? ""
    );

    check(
      tooSoon.data?.eligibility?.reason ===
        "wait_period" &&
        tooSoon.data?.eligibility?.canReview === false,
      "Verified handoff under 6 hours stays locked"
    );

    check(
      Number.isFinite(eligibleAt) &&
        Math.abs(
          eligibleAt -
            (fiveHoursAgo.getTime() + 6 * HOUR)
        ) < 1000,
      "Eligibility timestamp equals handoff + 6 hours"
    );

    const rejectedEarly = await api(
      base,
      reviewA,
      buyerAToken,
      {
        rating: 5,
        comment: "Too early",
      }
    );

    check(
      rejectedEarly.status === 403 &&
        rejectedEarly.data?.code ===
          "REVIEW_NOT_ELIGIBLE",
      "Backend rejects early review POST"
    );

    check(
      (
        await api(
          base,
          eligibilityB,
          buyerAToken
        )
      ).data?.eligibility?.reason ===
        "purchase_required",
      "Seller A handoff cannot unlock seller B product"
    );

    /*
     * SIX-HOUR WAIT EXPIRES
     */

    await prisma.orderVendorFulfillment.update({
      where: {
        orderId_vendorId: {
          orderId: mixedOrder.id,
          vendorId: sellerA.id,
        },
      },

      data: {
        verifiedAt: sevenHoursAgo,
      },
    });

    const readyA = await api(
      base,
      eligibilityA,
      buyerAToken
    );

    check(
      readyA.status === 200 &&
        readyA.data?.eligibility?.canReview === true &&
        readyA.data?.eligibility?.reason === "eligible",
      "Review A unlocks after six-hour wait"
    );

    /*
     * INPUT VALIDATION
     */

    for (const rating of [0, 6, 2.5]) {
      const invalid = await api(
        base,
        reviewA,
        buyerAToken,
        {
          rating,
          comment: "Invalid rating",
        }
      );

      check(
        invalid.status === 400,
        `Reject invalid rating ${rating}`
      );
    }

    check(
      (
        await api(
          base,
          reviewA,
          buyerAToken,
          {
            rating: 4,
            comment: "  ",
          }
        )
      ).status === 400,
      "Reject blank review"
    );

    check(
      (
        await api(
          base,
          reviewA,
          buyerAToken,
          {
            rating: 4,
            comment: "X".repeat(1001),
          }
        )
      ).status === 400,
      "Reject review over 1000 characters"
    );

    check(
      (
        await api(
          base,
          "/api/products/invalid/reviews/eligibility",
          buyerAToken
        )
      ).status === 400,
      "Reject invalid product ID"
    );

    check(
      (
        await api(
          base,
          "/api/products/999999999/reviews",
          buyerAToken
        )
      ).status === 404,
      "Reject nonexistent product"
    );

    /*
     * FIRST VERIFIED REVIEW
     */

    const firstReview = await api(
      base,
      reviewA,
      buyerAToken,
      {
        rating: 5,
        comment: "  Great product  ",
      }
    );

    check(
      firstReview.status === 201 &&
        firstReview.data?.review?.rating === 5 &&
        firstReview.data?.review?.comment ===
          "Great product",
      "Eligible buyer submits review with trimmed comment"
    );

    check(
      firstReview.data?.averageRating === 5 &&
        firstReview.data?.reviewCount === 1,
      "First review returns correct rating summary"
    );

    const storedA =
      await prisma.product.findUnique({
        where: {
          id: productA.id,
        },

        select: {
          rating: true,
        },
      });

    check(
      storedA?.rating === 5,
      "Product's persisted average rating updates"
    );

    /*
     * DUPLICATE PREVENTION
     */

    const duplicate = await api(
      base,
      reviewA,
      buyerAToken,
      {
        rating: 1,
        comment: "Second attempt",
      }
    );

    check(
      [403, 409].includes(duplicate.status),
      "Duplicate buyer-product review is rejected"
    );

    const afterReview = await api(
      base,
      eligibilityA,
      buyerAToken
    );

    check(
      afterReview.data?.eligibility?.reason ===
        "already_reviewed",
      "Eligibility reports already reviewed"
    );

    /*
     * SECOND BUYER, SAME PRODUCT
     */

    const secondOrder = await prisma.order.create({
      data: {
        buyerId: buyerB.id,
        paymentStatus: PaymentStatus.paid,
        status: OrderStatus.completed,
        subtotal: 10000,
        total: 10000,
        fee: 0,

        items: {
          create: {
            productId: productA.id,
            vendorId: sellerA.id,
            productTitle: productA.title,
            unitPrice: 10000,
            lineTotal: 10000,
            quantity: 1,
            status: OrderStatus.completed,
          },
        },
      },
    });

    orderIds.push(secondOrder.id);

    const materialSecond =
      createFulfillmentCodeMaterial();

    await prisma.orderVendorFulfillment.create({
      data: {
        orderId: secondOrder.id,
        vendorId: sellerA.id,

        codeHash: materialSecond.codeHash,

        codeCiphertext:
          materialSecond.codeCiphertext,

        verifiedAt: sevenHoursAgo,
      },
    });

    const secondReady = await api(
      base,
      eligibilityA,
      buyerBToken
    );

    check(
      secondReady.data?.eligibility?.canReview === true,
      "Second verified buyer independently eligible"
    );

    const secondReview = await api(
      base,
      reviewA,
      buyerBToken,
      {
        rating: 3,
        comment: "Good enough",
      }
    );

    check(
      secondReview.status === 201 &&
        secondReview.data?.reviewCount === 2 &&
        secondReview.data?.averageRating === 4,
      "Second review averages 5 and 3 stars correctly"
    );

    /*
     * PUBLIC REVIEW SUMMARY
     */

    const publicReviews = await api(
      base,
      reviewA
    );

    check(
      publicReviews.status === 200 &&
        publicReviews.data?.reviewCount === 2 &&
        publicReviews.data?.averageRating === 4 &&
        publicReviews.data?.reviews?.length === 2,
      "Public review list shows both verified reviews"
    );

    check(
      publicReviews.data?.reviews?.every(
        (review: any) =>
          review.author?.name &&
          !JSON.stringify(review).includes("phone")
      ),
      "Public reviews expose no buyer phone"
    );

    check(
      (
        await api(
          base,
          eligibilityB,
          buyerBToken
        )
      ).data?.eligibility?.reason ===
        "purchase_required",
      "Buying product A does not permit reviewing B"
    );

    check(
      (
        await api(
          base,
          eligibilityA,
          sellerAToken
        )
      ).data?.eligibility?.reason ===
        "purchase_required",
      "Seller cannot rate own product without verified purchase"
    );

    /*
     * INDEPENDENT SELLER B HANDOFF
     */

    await prisma.orderItem.updateMany({
      where: {
        orderId: mixedOrder.id,
        vendorId: sellerB.id,
      },

      data: {
        status: OrderStatus.completed,
      },
    });

    const materialB =
      createFulfillmentCodeMaterial();

    await prisma.orderVendorFulfillment.create({
      data: {
        orderId: mixedOrder.id,
        vendorId: sellerB.id,

        codeHash: materialB.codeHash,

        codeCiphertext:
          materialB.codeCiphertext,

        verifiedAt: fiveHoursAgo,
      },
    });

    check(
      (
        await api(
          base,
          eligibilityB,
          buyerAToken
        )
      ).data?.eligibility?.reason ===
        "wait_period",
      "Seller B's separate five-hour clock blocks review"
    );

    await prisma.orderVendorFulfillment.update({
      where: {
        orderId_vendorId: {
          orderId: mixedOrder.id,
          vendorId: sellerB.id,
        },
      },

      data: {
        verifiedAt: sevenHoursAgo,
      },
    });

    check(
      (
        await api(
          base,
          eligibilityB,
          buyerAToken
        )
      ).data?.eligibility?.canReview === true,
      "Seller B's independent six-hour timer unlocks"
    );

    const reviewBResult = await api(
      base,
      reviewB,
      buyerAToken,
      {
        rating: 4,
        comment: "Another seller, another product",
      }
    );

    check(
      reviewBResult.status === 201 &&
        reviewBResult.data?.reviewCount === 1,
      "Buyer independently reviews seller B's delivered product"
    );

    const finalA = await api(base, reviewA);

    check(
      finalA.data?.reviewCount === 2 &&
        finalA.data?.averageRating === 4,
      "Seller B review does not alter product A rating"
    );

    console.log(
      `\nProduct review tests: ${passed} passed / ${failed} failed\n`
    );

    if (failed) {
      process.exitCode = 1;
    }
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) =>
          error ? reject(error) : resolve()
        );
      });
    }

    await cleanup();
  }
}

main()
  .catch((error) => {
    console.error(
      "Product review test crashed:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
