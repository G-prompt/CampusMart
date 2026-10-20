import "dotenv/config";

import type {
  Response,
} from "express";

import jwt from "jsonwebtoken";

import app from "../src/app";

import {
  MessagingModerationAction,
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

import {
  createOrder,
} from "../src/controllers/order.controller";

import type {
  AuthenticatedRequest,
} from "../src/middleware/auth.middleware";

/*
 * =======================================================
 * CAMPUSMART MESSAGING HTTP INTEGRATION TEST
 * =======================================================
 *
 * Tests the mounted Express messaging API end-to-end:
 *
 * GET  /api/messages/conversations
 * GET  /api/messages/unread-count
 * POST /api/messages/conversations
 * GET  /api/messages/conversations/:id
 * POST /api/messages/conversations/:id/messages
 * POST /api/messages/conversations/:id/delivered
 * POST /api/messages/conversations/:id/read
 *
 * Covers:
 *
 * - Authentication
 * - Listing conversations
 * - General storefront conversations
 * - Order conversations
 * - Canonical conversation reuse
 * - Multi-vendor order isolation
 * - Seller-initiated order conversations
 * - Vendor acting as buyer
 * - Full seller eligibility for NEW sales conversations
 * - Pending-review seller protection
 * - Restricted seller protection
 * - Suspended seller protection
 * - Existing chat preservation after seller ineligibility
 * - Existing listing chat preservation after archival
 * - Order-chat preservation after seller ineligibility
 * - Unread counts
 * - Delivery receipts
 * - Read receipts
 * - Receipt monotonicity
 * - Receipt ownership validation
 * - Cross-conversation receipt protection
 * - Privacy
 * - Redaction
 * - Circumvention blocking
 * - Blocked first-message behavior
 * - Messaging-specific temporary restrictions
 * - Reading while messaging-restricted
 * - Delivery acknowledgement while restricted
 * - Moderation audit history
 * - No raw contact-detail persistence
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
  condition:
    unknown,
  label:
    string
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
 * DATE COMPARISON
 * =======================================================
 */

function sameInstant(
  first:
    unknown,
  second:
    unknown
) {
  if (
    !first ||
    !second
  ) {
    return false;
  }

  const firstTime =
    new Date(
      first as string
    ).getTime();

  const secondTime =
    new Date(
      second as string
    ).getTime();

  return (
    Number.isFinite(
      firstTime
    ) &&
    Number.isFinite(
      secondTime
    ) &&
    firstTime ===
      secondTime
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
 * TEST DATA REFERENCES
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

const rawPhone =
  "08166166698";

const externalUsername =
  "campusmartleakhttp";

const sellerAMatricNumber =
  `MHTUA-${suffix}`;

let universityId:
  string | null =
    null;

let buyerId:
  string | null =
    null;

let sellerAId:
  string | null =
    null;

let sellerBId:
  string | null =
    null;

let outsiderId:
  string | null =
    null;

let eligibilityBuyerId:
  string | null =
    null;

let productAId:
  number | null =
    null;

let productBId:
  number | null =
    null;

/*
 * =======================================================
 * JWT
 * =======================================================
 */

function createToken(
  userId:
    string,
  role:
    UserRole
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
 * HTTP HELPERS
 * =======================================================
 */

type ApiResult = {
  status:
    number;

  body:
    any;
};

async function apiRequest(
  baseUrl:
    string,
  path:
    string,
  options?: {
    method?:
      | "GET"
      | "POST"
      | "PATCH"
      | "PUT"
      | "DELETE";

    token?:
      string;

    body?:
      unknown;
  }
): Promise<ApiResult> {
  const headers:
    Record<
      string,
      string
    > =
    {};

  if (
    options?.token
  ) {
    headers.Authorization =
      `Bearer ${options.token}`;
  }

  if (
    options?.body !==
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
          options?.method ??
          "GET",

        headers,

        body:
          options?.body !==
          undefined
            ? JSON.stringify(
                options.body
              )
            : undefined,
      }
    );

  let body:
    any =
    null;

  const text =
    await response.text();

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
 * MOCK CONTROLLER RESPONSE
 * =======================================================
 */

type CapturedResponse = {
  statusCode:
    number;

  body:
    any;
};

function createMockResponse() {
  const captured:
    CapturedResponse =
    {
      statusCode:
        200,

      body:
        null,
    };

  const response = {
    status(
      code:
        number
    ) {
      captured.statusCode =
        code;

      return this;
    },

    json(
      body:
        unknown
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
    id:
      string;

    role:
      UserRole;
  },
  body:
    unknown =
    {},
  params:
    Record<
      string,
      string
    > =
    {}
): AuthenticatedRequest {
  return {
    user,
    body,
    params,
  } as unknown as
    AuthenticatedRequest;
}

/*
 * =======================================================
 * SAFE JSON SEARCH
 * =======================================================
 */

function serializedContains(
  value:
    unknown,
  search:
    string
) {
  if (
    !search
  ) {
    return false;
  }

  return JSON.stringify(
    value
  )
    .toLowerCase()
    .includes(
      search.toLowerCase()
    );
}

/*
 * =======================================================
 * CREATE REAL ORDER
 * =======================================================
 */

async function createTestOrder(
  buyer: {
    id:
      string;

    role:
      UserRole;
  },
  items: Array<{
    productId:
      number;

    quantity:
      number;
  }>,
  label:
    string
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
        items,

        pickupLocation:
          `Messaging Test Pickup ${label}`,

        preferredSlot:
          "Afternoon",
      }
    ),

    response
  );

  if (
    captured.statusCode !==
      201 ||
    !captured.body
      ?.success ||
    !captured.body
      ?.order
      ?.id
  ) {
    throw new Error(
      `Unable to create ${label} order: ${
        captured.body
          ?.message ??
        "unknown error"
      }`
    );
  }

  return String(
    captured.body
      .order
      .id
  );
}

/*
 * =======================================================
 * CLEANUP
 * =======================================================
 */

async function cleanup() {
  const userIds =
    [
      buyerId,
      sellerAId,
      sellerBId,
      outsiderId,
      eligibilityBuyerId,
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
    await prisma.conversation.deleteMany({
      where: {
        OR: [
          {
            buyerId: {
              in:
                userIds,
            },
          },

          {
            vendorId: {
              in:
                userIds,
            },
          },
        ],
      },
    });
  }

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
 * MAIN TEST
 * =======================================================
 */

async function main() {
  console.log(
    "\nCampusMart messaging HTTP integration test\n"
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
          `Messaging HTTP University ${suffix}`,

        shortName:
          "MHTU",

        slug:
          `messaging-http-university-${suffix}`,

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
   * BUYER
   * =====================================================
   */

  const buyer =
    await prisma.user.create({
      data: {
        name:
          "Messaging HTTP Buyer",

        email:
          `messaging-http-buyer-${suffix}@campusmart.test`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.client,

        phone:
          "08000000001",

        universityId:
          university.id,
      },
    });

  buyerId =
    buyer.id;

  /*
   * =====================================================
   * SELLER A
   * =====================================================
   */

  const sellerA =
    await prisma.user.create({
      data: {
        name:
          "Messaging HTTP Seller A",

        email:
          `messaging-http-seller-a-${suffix}@campusmart.test`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.vendor,

        phone:
          "08000000002",

        universityId:
          university.id,

        matricNumber:
          sellerAMatricNumber,

        studentVerificationStatus:
          StudentVerificationStatus.verified,

        studentVerifiedAt:
          new Date(),

        vendorProfile: {
          create: {
            businessName:
              "Messaging HTTP Store A",

            businessDescription:
              "Temporary seller A for CampusMart messaging tests.",

            pickupLocation:
              "Private Messaging Pickup A",

            accessStatus:
              VendorAccessStatus.active,
          },
        },
      },
    });

  sellerAId =
    sellerA.id;

  /*
   * =====================================================
   * SELLER B
   * =====================================================
   */

  const sellerB =
    await prisma.user.create({
      data: {
        name:
          "Messaging HTTP Seller B",

        email:
          `messaging-http-seller-b-${suffix}@campusmart.test`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.vendor,

        phone:
          "08000000003",

        universityId:
          university.id,

        matricNumber:
          `MHTUB-${suffix}`,

        studentVerificationStatus:
          StudentVerificationStatus.verified,

        studentVerifiedAt:
          new Date(),

        vendorProfile: {
          create: {
            businessName:
              "Messaging HTTP Store B",

            businessDescription:
              "Temporary seller B for CampusMart messaging tests.",

            pickupLocation:
              "Private Messaging Pickup B",

            accessStatus:
              VendorAccessStatus.active,
          },
        },
      },
    });

  sellerBId =
    sellerB.id;

  /*
   * =====================================================
   * OUTSIDER / MODERATION USER
   * =====================================================
   */

  const outsider =
    await prisma.user.create({
      data: {
        name:
          "Messaging HTTP Outsider",

        email:
          `messaging-http-outsider-${suffix}@campusmart.test`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.client,

        phone:
          "08000000004",

        universityId:
          university.id,
      },
    });

  outsiderId =
    outsider.id;

  /*
   * =====================================================
   * ELIGIBILITY TEST BUYER
   * =====================================================
   *
   * This account deliberately has no existing general or
   * listing conversation with Seller A.
   *
   * That lets us distinguish:
   *
   * NEW conversation eligibility
   *
   * from:
   *
   * EXISTING conversation preservation.
   */

  const eligibilityBuyer =
    await prisma.user.create({
      data: {
        name:
          "Messaging Eligibility Buyer",

        email:
          `messaging-http-eligibility-buyer-${suffix}@campusmart.test`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.client,

        universityId:
          university.id,
      },
    });

  eligibilityBuyerId =
    eligibilityBuyer.id;

  /*
   * =====================================================
   * PRODUCTS
   * =====================================================
   */

  const productA =
    await prisma.product.create({
      data: {
        slug:
          `messaging-http-product-a-${suffix}`,

        title:
          "Messaging HTTP Product A",

        category:
          "Technology",

        price:
          15000,

        rating:
          0,

        description:
          "Temporary listing from seller A.",

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

  const productB =
    await prisma.product.create({
      data: {
        slug:
          `messaging-http-product-b-${suffix}`,

        title:
          "Messaging HTTP Product B",

        category:
          "Books",

        price:
          8000,

        rating:
          0,

        description:
          "Temporary listing from seller B.",

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
   * =====================================================
   * TOKENS
   * =====================================================
   */

  const buyerToken =
    createToken(
      buyer.id,
      buyer.role
    );

  const sellerAToken =
    createToken(
      sellerA.id,
      sellerA.role
    );

  const sellerBToken =
    createToken(
      sellerB.id,
      sellerB.role
    );

  const outsiderToken =
    createToken(
      outsider.id,
      outsider.role
    );

  const eligibilityBuyerToken =
    createToken(
      eligibilityBuyer.id,
      eligibilityBuyer.role
    );

  /*
   * =====================================================
   * TEMPORARY HTTP SERVER
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
        "Unable to determine temporary HTTP server port."
      );
    }

    const baseUrl =
      `http://127.0.0.1:${address.port}`;

    /*
     * ===================================================
     * 1. AUTHENTICATION REQUIRED
     * ===================================================
     */

    const unauthenticated =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations"
      );

    check(
      unauthenticated.status ===
        401 &&
        unauthenticated.body
          ?.success ===
          false,
      "Messaging inbox requires authentication."
    );

    /*
     * ===================================================
     * LISTING CONVERSATION
     * ===================================================
     */

    const listingStarted =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "listing",

            productId:
              productA.id,

            body:
              `Hi, is this available? My number is ${rawPhone}`,
          },
        }
      );

    check(
      listingStarted.status ===
        201 &&
        listingStarted.body
          ?.success ===
          true &&
        listingStarted.body
          ?.conversation
          ?.productId ===
          productA.id,
      "Buyer can start listing conversation before placing an order."
    );

    const listingConversationId =
      String(
        listingStarted.body
          ?.conversation
          ?.id ??
          ""
      );

    if (
      !listingConversationId
    ) {
      throw new Error(
        "Listing conversation ID was not returned."
      );
    }

    check(
      listingStarted.body
        ?.moderation
        ?.action ===
        "redacted" &&
        listingStarted.body
          ?.sentMessage
          ?.body
          ?.includes(
            "*"
          ) &&
        !listingStarted.body
          ?.sentMessage
          ?.body
          ?.includes(
            rawPhone
          ),
      "Phone number is redacted in listing start response."
    );

    const storedListingFirstMessage =
      await prisma.message.findUnique({
        where: {
          id:
            listingStarted.body
              .sentMessage
              .id,
        },

        select: {
          body:
            true,
        },
      });

    check(
      Boolean(
        storedListingFirstMessage
      ) &&
        !storedListingFirstMessage!
          .body
          .includes(
            rawPhone
          ),
      "Raw phone number is absent from persisted listing message."
    );

    const listingReuse =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "listing",

            productId:
              productA.id,

            body:
              "I also wanted to ask about the condition.",
          },
        }
      );

    check(
      listingReuse.status ===
        201 &&
        listingReuse.body
          ?.conversation
          ?.id ===
          listingConversationId,
      "Starting the same listing context reuses the canonical conversation."
    );

    const listingConversationCount =
      await prisma.conversation.count({
        where: {
          buyerId:
            buyer.id,

          vendorId:
            sellerA.id,

          contextKey:
            `listing:${productA.id}`,
        },
      });

    check(
      listingConversationCount ===
        1,
      "Database contains exactly one canonical conversation for the listing context."
    );

    const sellerAInbox =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          token:
            sellerAToken,
        }
      );

    const sellerAListingInboxRow =
      sellerAInbox.body
        ?.conversations
        ?.find(
          (
            conversation:
              any
          ) =>
            conversation.id ===
            listingConversationId
        );

    check(
      sellerAInbox.status ===
        200 &&
        sellerAListingInboxRow
          ?.contextType ===
          "listing" &&
        sellerAListingInboxRow
          ?.product
          ?.id ===
          productA.id,
      "Seller receives buyer listing conversation in inbox."
    );

    check(
      !serializedContains(
        sellerAInbox.body,
        buyer.email
      ) &&
        !serializedContains(
          sellerAInbox.body,
          buyer.phone ??
            ""
        ) &&
        !serializedContains(
          sellerAInbox.body,
          sellerA.email
        ) &&
        !serializedContains(
          sellerAInbox.body,
          sellerA.phone ??
            ""
        ) &&
        !serializedContains(
          sellerAInbox.body,
          "Private Messaging Pickup A"
        ),
      "Messaging inbox exposes no phone, email or private seller pickup data."
    );

    const sellerAListingThread =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}`,
        {
          token:
            sellerAToken,
        }
      );

    check(
      sellerAListingThread.status ===
        200 &&
        sellerAListingThread.body
          ?.conversation
          ?.side ===
          "vendor" &&
        sellerAListingThread.body
          ?.messages
          ?.length ===
          2,
      "Seller can open authorized listing conversation history."
    );

    check(
      !serializedContains(
        sellerAListingThread.body,
        buyer.email
      ) &&
        !serializedContains(
          sellerAListingThread.body,
          buyer.phone ??
            ""
        ) &&
        !serializedContains(
          sellerAListingThread.body,
          "Private Messaging Pickup A"
        ),
      "Thread history keeps private phone, email and pickup data hidden."
    );

    /*
     * ===================================================
     * SELLER REPLY + RECEIPT FOUNDATION
     * ===================================================
     */

    const sellerAReply =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/messages`,
        {
          method:
            "POST",

          token:
            sellerAToken,

          body: {
            body:
              "Yes, it is available.",
          },
        }
      );

    check(
      sellerAReply.status ===
        201 &&
        sellerAReply.body
          ?.sentMessage
          ?.body ===
          "Yes, it is available." &&
        sellerAReply.body
          ?.moderation
          ?.action ===
          "allow",
      "Seller can send a normal listing reply."
    );

    const sellerAReplyMessageId =
      String(
        sellerAReply.body
          ?.sentMessage
          ?.id ??
          ""
      );

    if (
      !sellerAReplyMessageId
    ) {
      throw new Error(
        "Seller A listing reply message ID was not returned."
      );
    }

    const listingAfterSellerSend =
      await prisma.conversation.findUnique({
        where: {
          id:
            listingConversationId,
        },

        select: {
          buyerLastDeliveredAt:
            true,
        },
      });

    check(
      listingAfterSellerSend
        ?.buyerLastDeliveredAt ===
        null,
      "New seller message starts as Sent and is not falsely marked Delivered."
    );

    const buyerUnreadAfterSellerReply =
      await apiRequest(
        baseUrl,
        "/api/messages/unread-count",
        {
          token:
            buyerToken,
        }
      );

    check(
      buyerUnreadAfterSellerReply.status ===
        200 &&
        buyerUnreadAfterSellerReply.body
          ?.unreadCount ===
          1,
      "Seller reply increases buyer unread count."
    );

    const buyerInbox =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          token:
            buyerToken,
        }
      );

    const buyerListingInboxRow =
      buyerInbox.body
        ?.conversations
        ?.find(
          (
            conversation:
              any
          ) =>
            conversation.id ===
            listingConversationId
        );

    check(
      buyerInbox.status ===
        200 &&
        buyerListingInboxRow
          ?.unreadCount ===
          1 &&
        buyerListingInboxRow
          ?.latestMessage
          ?.body ===
          "Yes, it is available.",
      "Buyer inbox reports seller reply as unread."
    );

    const buyerListingThread =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}`,
        {
          token:
            buyerToken,
        }
      );

    check(
      buyerListingThread.status ===
        200 &&
        buyerListingThread.body
          ?.conversation
          ?.side ===
          "buyer" &&
        buyerListingThread.body
          ?.messages
          ?.length ===
          3,
      "Buyer can open listing conversation history."
    );

    check(
      buyerListingThread.body
        ?.conversation
        ?.buyerLastDeliveredAt ===
        null,
      "Opening the thread does not automatically fake a delivery acknowledgement."
    );

    const buyerDeliveredSellerReply =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/delivered`,
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            messageId:
              sellerAReplyMessageId,
          },
        }
      );

    check(
      buyerDeliveredSellerReply.status ===
        200 &&
        buyerDeliveredSellerReply.body
          ?.success ===
          true &&
        buyerDeliveredSellerReply.body
          ?.deliveredThroughMessageId ===
          sellerAReplyMessageId &&
        Boolean(
          buyerDeliveredSellerReply.body
            ?.deliveredAt
        ),
      "Buyer can explicitly acknowledge the seller message as Delivered."
    );

    const sellerThreadAfterDelivery =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}`,
        {
          token:
            sellerAToken,
        }
      );

    check(
      sellerThreadAfterDelivery.status ===
        200 &&
        sameInstant(
          sellerThreadAfterDelivery.body
            ?.conversation
            ?.buyerLastDeliveredAt,
          buyerDeliveredSellerReply.body
            ?.deliveredAt
        ),
      "Sender can observe the recipient's delivery cursor after acknowledgement."
    );

    const unreadAfterDeliveryOnly =
      await apiRequest(
        baseUrl,
        "/api/messages/unread-count",
        {
          token:
            buyerToken,
        }
      );

    check(
      unreadAfterDeliveryOnly.status ===
        200 &&
        unreadAfterDeliveryOnly.body
          ?.unreadCount ===
          1,
      "Delivery acknowledgement does not incorrectly clear unread messages."
    );

    const sellerAcknowledgesOwnMessage =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/delivered`,
        {
          method:
            "POST",

          token:
            sellerAToken,

          body: {
            messageId:
              sellerAReplyMessageId,
          },
        }
      );

    check(
      sellerAcknowledgesOwnMessage.status ===
        400 &&
        sellerAcknowledgesOwnMessage.body
          ?.code ===
          "INVALID_RECEIPT_MESSAGE",
      "A participant cannot acknowledge their own outgoing message as delivered."
    );

    const unreadBeforeExplicitRead =
      await apiRequest(
        baseUrl,
        "/api/messages/unread-count",
        {
          token:
            buyerToken,
        }
      );

    check(
      unreadBeforeExplicitRead.body
        ?.unreadCount ===
        1,
      "Opening a thread does not silently mark it read."
    );

    const listingMarkRead =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/read`,
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            messageId:
              sellerAReplyMessageId,
          },
        }
      );

    check(
      listingMarkRead.status ===
        200 &&
        listingMarkRead.body
          ?.success ===
          true &&
        Boolean(
          listingMarkRead.body
            ?.readAt
        ) &&
        Boolean(
          listingMarkRead.body
            ?.deliveredAt
        ) &&
        listingMarkRead.body
          ?.readThroughMessageId ===
          sellerAReplyMessageId,
      "Buyer can explicitly mark listing conversation read and Viewed implies Delivered."
    );

    const unreadAfterListingRead =
      await apiRequest(
        baseUrl,
        "/api/messages/unread-count",
        {
          token:
            buyerToken,
        }
      );

    check(
      unreadAfterListingRead.body
        ?.unreadCount ===
        0,
      "Buyer unread count returns to zero after mark-read."
    );

    /*
     * ===================================================
     * NORMAL / MODERATED MESSAGES
     * ===================================================
     */

    const meetupMessage =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/messages`,
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            body:
              "Can we meet by the library at 4:30?",
          },
        }
      );

    check(
      meetupMessage.status ===
        201 &&
        meetupMessage.body
          ?.moderation
          ?.action ===
          "allow" &&
        meetupMessage.body
          ?.sentMessage
          ?.body ===
          "Can we meet by the library at 4:30?",
      "Normal physical meetup coordination is allowed."
    );

    const socialAttempt =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/messages`,
        {
          method:
            "POST",

          token:
            sellerAToken,

          body: {
            body:
              `IG: @${externalUsername}`,
          },
        }
      );

    check(
      socialAttempt.status ===
        201 &&
        socialAttempt.body
          ?.moderation
          ?.action ===
          "redacted" &&
        socialAttempt.body
          ?.moderation
          ?.categories
          ?.includes(
            "external_username"
          ) &&
        !socialAttempt.body
          ?.sentMessage
          ?.body
          ?.toLowerCase()
          ?.includes(
            externalUsername.toLowerCase()
          ),
      "External social username is redacted through HTTP API."
    );

    const socialAttemptMessageId =
      String(
        socialAttempt.body
          ?.sentMessage
          ?.id ??
          ""
      );

    if (
      !socialAttemptMessageId
    ) {
      throw new Error(
        "Social redaction message ID was not returned."
      );
    }

    const newerDeliveryAck =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/delivered`,
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            messageId:
              socialAttemptMessageId,
          },
        }
      );

    const newerDeliveredAt =
      newerDeliveryAck.body
        ?.deliveredAt;

    const olderDeliveryAck =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/delivered`,
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            messageId:
              sellerAReplyMessageId,
          },
        }
      );

    check(
      newerDeliveryAck.status ===
        200 &&
        olderDeliveryAck.status ===
          200 &&
        sameInstant(
          newerDeliveredAt,
          olderDeliveryAck.body
            ?.deliveredAt
        ),
      "Older delivery acknowledgements cannot move the delivery cursor backwards."
    );

    const messageCountBeforeBlocked =
      await prisma.message.count({
        where: {
          conversationId:
            listingConversationId,
        },
      });

    const blockedExistingMessage =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/messages`,
        {
          method:
            "POST",

          token:
            sellerAToken,

          body: {
            body:
              "Let's move this conversation to WhatsApp.",
          },
        }
      );

    check(
      blockedExistingMessage.status ===
        400 &&
        blockedExistingMessage.body
          ?.success ===
          false &&
        blockedExistingMessage.body
          ?.code ===
          "OFF_PLATFORM_ATTEMPT_BLOCKED" &&
        blockedExistingMessage.body
          ?.moderation
          ?.action ===
          "blocked",
      "Explicit WhatsApp circumvention is blocked."
    );

    const messageCountAfterBlocked =
      await prisma.message.count({
        where: {
          conversationId:
            listingConversationId,
        },
      });

    check(
      messageCountAfterBlocked ===
        messageCountBeforeBlocked,
      "Blocked existing-thread message creates no Message row."
    );

    await apiRequest(
      baseUrl,
      `/api/messages/conversations/${listingConversationId}/read`,
      {
        method:
          "POST",

        token:
          buyerToken,

        body: {
          messageId:
            socialAttemptMessageId,
        },
      }
    );

    const outsiderListingThread =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}`,
        {
          token:
            outsiderToken,
        }
      );

    check(
      outsiderListingThread.status ===
        403 &&
        outsiderListingThread.body
          ?.code ===
          "CONVERSATION_FORBIDDEN",
      "Unrelated authenticated user cannot open another user's listing conversation."
    );

    /*
     * ===================================================
     * GENERAL STOREFRONT CONVERSATION
     * ===================================================
     */

    const generalStarted =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "general",

            vendorId:
              sellerA.id,

            body:
              "Hi, I wanted to ask about your shop.",
          },
        }
      );

    const generalConversationId =
      String(
        generalStarted.body
          ?.conversation
          ?.id ??
          ""
      );

    check(
      generalStarted.status ===
        201 &&
        generalStarted.body
          ?.success ===
          true &&
        Boolean(
          generalConversationId
        ),
      "Buyer can start a general seller conversation."
    );

    check(
      generalConversationId !==
        listingConversationId,
      "General seller conversation is separate from listing conversation."
    );

    const generalFirstMessageId =
      String(
        generalStarted.body
          ?.sentMessage
          ?.id ??
          ""
      );

    const crossConversationReceipt =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/delivered`,
        {
          method:
            "POST",

          token:
            sellerAToken,

          body: {
            messageId:
              generalFirstMessageId,
          },
        }
      );

    check(
      crossConversationReceipt.status ===
        404 &&
        crossConversationReceipt.body
          ?.code ===
          "RECEIPT_MESSAGE_NOT_FOUND",
      "A message from another conversation cannot be used to forge a receipt."
    );

    const generalReuse =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "general",

            vendorId:
              sellerA.id,

            body:
              "Do you normally add new listings every week?",
          },
        }
      );

    check(
      generalReuse.status ===
        201 &&
        generalReuse.body
          ?.conversation
          ?.id ===
          generalConversationId,
      "Starting the same general context reuses its canonical conversation."
    );

    const generalConversationCount =
      await prisma.conversation.count({
        where: {
          buyerId:
            buyer.id,

          vendorId:
            sellerA.id,

          contextKey:
            "general",
        },
      });

    check(
      generalConversationCount ===
        1,
      "Database contains exactly one general conversation for buyer and seller."
    );

    /*
     * ===================================================
     * BLOCKED FIRST MESSAGE / EMPTY-THREAD PROTECTION
     * ===================================================
     */

    const outsiderGeneralBefore =
      await prisma.conversation.count({
        where: {
          buyerId:
            outsider.id,

          vendorId:
            sellerA.id,

          contextKey:
            "general",
        },
      });

    const outsiderMessageCountBefore =
      await prisma.message.count({
        where: {
          senderId:
            outsider.id,
        },
      });

    const blockedFirstMessage =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            outsiderToken,

          body: {
            contextType:
              "general",

            vendorId:
              sellerA.id,

            body:
              "Let's move this conversation to WhatsApp.",
          },
        }
      );

    const outsiderGeneralAfterBlocked =
      await prisma.conversation.count({
        where: {
          buyerId:
            outsider.id,

          vendorId:
            sellerA.id,

          contextKey:
            "general",
        },
      });

    const outsiderMessageCountAfterBlocked =
      await prisma.message.count({
        where: {
          senderId:
            outsider.id,
        },
      });

    check(
      blockedFirstMessage.status ===
        400 &&
        blockedFirstMessage.body
          ?.code ===
          "OFF_PLATFORM_ATTEMPT_BLOCKED" &&
        outsiderGeneralBefore ===
          0 &&
        outsiderGeneralAfterBlocked ===
          0 &&
        outsiderMessageCountAfterBlocked ===
          outsiderMessageCountBefore,
      "Blocked first message creates neither an empty Conversation nor a Message row."
    );

    const outsiderRedactedStart =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            outsiderToken,

          body: {
            contextType:
              "general",

            vendorId:
              sellerA.id,

            body:
              `Hi, my number is ${rawPhone}`,
          },
        }
      );

    const outsiderConversationId =
      String(
        outsiderRedactedStart.body
          ?.conversation
          ?.id ??
          ""
      );

    check(
      outsiderRedactedStart.status ===
        201 &&
        outsiderRedactedStart.body
          ?.moderation
          ?.action ===
          "redacted" &&
        Boolean(
          outsiderConversationId
        ) &&
        !outsiderRedactedStart.body
          ?.sentMessage
          ?.body
          ?.includes(
            rawPhone
          ),
      "Redacted first message creates a real conversation with sanitized content."
    );

    const storedOutsiderFirstMessage =
      await prisma.message.findUnique({
        where: {
          id:
            outsiderRedactedStart.body
              ?.sentMessage
              ?.id,
        },

        select: {
          body:
            true,
        },
      });

    check(
      Boolean(
        storedOutsiderFirstMessage
      ) &&
        !storedOutsiderFirstMessage!
          .body
          .includes(
            rawPhone
          ),
      "Redacted first-message raw phone number is not persisted."
    );

    /*
     * ===================================================
     * MULTI-VENDOR ORDER
     * ===================================================
     */

    const multiVendorOrderId =
      await createTestOrder(
        {
          id:
            buyer.id,

          role:
            buyer.role,
        },
        [
          {
            productId:
              productA.id,

            quantity:
              1,
          },

          {
            productId:
              productB.id,

            quantity:
              1,
          },
        ],
        "Multi Vendor"
      );

    const orderAStarted =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "order",

            orderId:
              multiVendorOrderId,

            vendorId:
              sellerA.id,

            body:
              "Hi, I wanted to ask about your part of my order.",
          },
        }
      );

    const orderAConversationId =
      String(
        orderAStarted.body
          ?.conversation
          ?.id ??
          ""
      );

    check(
      orderAStarted.status ===
        201 &&
        Boolean(
          orderAConversationId
        ),
      "Buyer can start order conversation with Seller A."
    );

    const orderBStarted =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "order",

            orderId:
              multiVendorOrderId,

            vendorId:
              sellerB.id,

            body:
              "Hi, I wanted to ask about your items in my order.",
          },
        }
      );

    const orderBConversationId =
      String(
        orderBStarted.body
          ?.conversation
          ?.id ??
          ""
      );

    check(
      orderBStarted.status ===
        201 &&
        Boolean(
          orderBConversationId
        ),
      "Buyer can start separate order conversation with Seller B."
    );

    check(
      orderAConversationId !==
        orderBConversationId,
      "Seller A and Seller B receive separate order conversations for the same order."
    );

    const orderAReuse =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "order",

            orderId:
              multiVendorOrderId,

            vendorId:
              sellerA.id,

            body:
              "Just following up on Seller A's part.",
          },
        }
      );

    check(
      orderAReuse.status ===
        201 &&
        orderAReuse.body
          ?.conversation
          ?.id ===
          orderAConversationId,
      "Repeated Seller A order context reuses the same canonical order thread."
    );

    const multiOrderConversations =
      await prisma.conversation.findMany({
        where: {
          orderId:
            multiVendorOrderId,
        },

        select: {
          id:
            true,

          buyerId:
            true,

          vendorId:
            true,

          contextKey:
            true,
        },
      });

    check(
      multiOrderConversations.length ===
        2 &&
        multiOrderConversations.some(
          (
            conversation
          ) =>
            conversation.id ===
              orderAConversationId &&
            conversation.vendorId ===
              sellerA.id
        ) &&
        multiOrderConversations.some(
          (
            conversation
          ) =>
            conversation.id ===
              orderBConversationId &&
            conversation.vendorId ===
              sellerB.id
        ),
      "Database stores one order conversation per seller in a multi-vendor order."
    );

    const sellerAOrderInbox =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          token:
            sellerAToken,
        }
      );

    const sellerAInboxConversationIds =
      (
        sellerAOrderInbox.body
          ?.conversations ??
        []
      ).map(
        (
          conversation:
            any
        ) =>
          conversation.id
      );

    check(
      sellerAInboxConversationIds.includes(
        orderAConversationId
      ) &&
        !sellerAInboxConversationIds.includes(
          orderBConversationId
        ),
      "Seller A inbox contains only Seller A's order conversation."
    );

    const sellerBOrderInbox =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          token:
            sellerBToken,
        }
      );

    const sellerBInboxConversationIds =
      (
        sellerBOrderInbox.body
          ?.conversations ??
        []
      ).map(
        (
          conversation:
            any
        ) =>
          conversation.id
      );

    check(
      sellerBInboxConversationIds.includes(
        orderBConversationId
      ) &&
        !sellerBInboxConversationIds.includes(
          orderAConversationId
        ),
      "Seller B inbox contains only Seller B's order conversation."
    );

    const sellerAReadsB =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${orderBConversationId}`,
        {
          token:
            sellerAToken,
        }
      );

    check(
      sellerAReadsB.status ===
        403 &&
        sellerAReadsB.body
          ?.code ===
          "CONVERSATION_FORBIDDEN",
      "Seller A cannot open Seller B's order conversation."
    );

    const sellerBReadsA =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${orderAConversationId}`,
        {
          token:
            sellerBToken,
        }
      );

    check(
      sellerBReadsA.status ===
        403 &&
        sellerBReadsA.body
          ?.code ===
          "CONVERSATION_FORBIDDEN",
      "Seller B cannot open Seller A's order conversation."
    );

    const sellerAOwnOrderThread =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${orderAConversationId}`,
        {
          token:
            sellerAToken,
        }
      );

    check(
      sellerAOwnOrderThread.status ===
        200 &&
        sellerAOwnOrderThread.body
          ?.conversation
          ?.contextType ===
          "order" &&
        sellerAOwnOrderThread.body
          ?.conversation
          ?.order
          ?.id ===
          multiVendorOrderId &&
        sellerAOwnOrderThread.body
          ?.conversation
          ?.otherParty
          ?.id ===
          buyer.id,
      "Seller A can open their own order conversation with the buyer."
    );

    const sellerBOwnOrderThread =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${orderBConversationId}`,
        {
          token:
            sellerBToken,
        }
      );

    check(
      sellerBOwnOrderThread.status ===
        200 &&
        sellerBOwnOrderThread.body
          ?.conversation
          ?.order
          ?.id ===
          multiVendorOrderId &&
        sellerBOwnOrderThread.body
          ?.conversation
          ?.otherParty
          ?.id ===
          buyer.id,
      "Seller B can independently open their own order conversation."
    );

    check(
      !serializedContains(
        sellerAOwnOrderThread.body,
        buyer.email
      ) &&
        !serializedContains(
          sellerAOwnOrderThread.body,
          buyer.phone ??
            ""
        ) &&
        !serializedContains(
          sellerAOwnOrderThread.body,
          "Messaging Test Pickup Multi Vendor"
        ),
      "Generic order messaging API does not expose buyer phone, email or order pickup data."
    );

    const sellerAOrderReply =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${orderAConversationId}/messages`,
        {
          method:
            "POST",

          token:
            sellerAToken,

          body: {
            body:
              "Your Seller A items are ready.",
          },
        }
      );

    check(
      sellerAOrderReply.status ===
        201 &&
        sellerAOrderReply.body
          ?.moderation
          ?.action ===
          "allow",
      "Seller A can reply inside their order conversation."
    );

    const buyerOrderUnread =
      await apiRequest(
        baseUrl,
        "/api/messages/unread-count",
        {
          token:
            buyerToken,
        }
      );

    check(
      buyerOrderUnread.status ===
        200 &&
        buyerOrderUnread.body
          ?.unreadCount ===
          1,
      "Seller A order reply increases buyer unread count by one."
    );

    const readOrderA =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${orderAConversationId}/read`,
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            messageId:
              sellerAOrderReply.body
                ?.sentMessage
                ?.id,
          },
        }
      );

    const buyerUnreadAfterOrderARead =
      await apiRequest(
        baseUrl,
        "/api/messages/unread-count",
        {
          token:
            buyerToken,
        }
      );

    check(
      readOrderA.status ===
        200 &&
        buyerUnreadAfterOrderARead.body
          ?.unreadCount ===
          0,
      "Marking Seller A order conversation read clears its unread count."
    );

    /*
     * ===================================================
     * SELLER-INITIATED ORDER CONVERSATION
     * ===================================================
     */

    const sellerInitiatedOrderId =
      await createTestOrder(
        {
          id:
            buyer.id,

          role:
            buyer.role,
        },
        [
          {
            productId:
              productA.id,

            quantity:
              1,
          },
        ],
        "Seller Initiated"
      );

    const sellerInitiated =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            sellerAToken,

          body: {
            contextType:
              "order",

            orderId:
              sellerInitiatedOrderId,

            vendorId:
              sellerA.id,

            body:
              "Hi, I have an update about your order.",
          },
        }
      );

    const sellerInitiatedConversationId =
      String(
        sellerInitiated.body
          ?.conversation
          ?.id ??
          ""
      );

    check(
      sellerInitiated.status ===
        201 &&
        Boolean(
          sellerInitiatedConversationId
        ),
      "Seller can initiate an order conversation for an order containing their items."
    );

    const buyerReusesSellerInitiated =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "order",

            orderId:
              sellerInitiatedOrderId,

            vendorId:
              sellerA.id,

            body:
              "Thanks, I saw your update.",
          },
        }
      );

    check(
      buyerReusesSellerInitiated.status ===
        201 &&
        buyerReusesSellerInitiated.body
          ?.conversation
          ?.id ===
          sellerInitiatedConversationId,
      "Buyer and seller resolve to the same canonical thread even when seller started it first."
    );

    await apiRequest(
      baseUrl,
      `/api/messages/conversations/${sellerInitiatedConversationId}/read`,
      {
        method:
          "POST",

        token:
          buyerToken,

        body: {
          messageId:
            sellerInitiated.body
              ?.sentMessage
              ?.id,
        },
      }
    );

    /*
     * ===================================================
     * VENDOR ACTING AS BUYER
     * ===================================================
     *
     * A vendor account is still allowed to act as the
     * buyer side of a conversation with another eligible
     * seller.
     */

    const vendorAsBuyer =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            sellerBToken,

          body: {
            contextType:
              "general",

            vendorId:
              sellerA.id,

            body:
              "Hi, I'm interested in buying something from your store.",
          },
        }
      );

    check(
      vendorAsBuyer.status ===
        201 &&
        vendorAsBuyer.body
          ?.conversation
          ?.buyerId ===
          sellerB.id &&
        vendorAsBuyer.body
          ?.conversation
          ?.vendorId ===
          sellerA.id &&
        vendorAsBuyer.body
          ?.conversation
          ?.contextType ===
          "general",
      "A vendor account can act as a buyer and message another eligible seller."
    );

    /*
     * ===================================================
     * PREPARE ORDER FOR LATER ELIGIBILITY TEST
     * ===================================================
     *
     * Create the order NOW while Seller A is eligible.
     *
     * We intentionally do not create its conversation
     * yet.
     *
     * Later, after Seller A becomes suspended, the buyer
     * must still be able to start the order conversation
     * because order communication follows transaction
     * participation rather than current selling
     * eligibility.
     */

    const postEligibilityOrderId =
      await createTestOrder(
        {
          id:
            buyer.id,

          role:
            buyer.role,
        },
        [
          {
            productId:
              productA.id,

            quantity:
              1,
          },
        ],
        "Post Eligibility"
      );

    /*
     * ===================================================
     * TEMPORARY MESSAGING RESTRICTION
     * ===================================================
     */

    const restrictionTrigger =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${outsiderConversationId}/messages`,
        {
          method:
            "POST",

          token:
            outsiderToken,

          body: {
            body:
              `Instagram: @${externalUsername}`,
          },
        }
      );

    check(
      restrictionTrigger.status ===
        201 &&
        restrictionTrigger.body
          ?.moderation
          ?.action ===
          "redacted",
      "Threshold-crossing moderation attempt is sanitized and sent."
    );

    const restrictedUser =
      await prisma.user.findUnique({
        where: {
          id:
            outsider.id,
        },

        select: {
          messagingRestrictedUntil:
            true,

          messagingRestrictionReason:
            true,
        },
      });

    check(
      Boolean(
        restrictedUser
          ?.messagingRestrictedUntil &&
        restrictedUser
          .messagingRestrictedUntil >
          new Date()
      ),
      "Repeated moderation attempts create a temporary messaging restriction."
    );

    const restrictedSend =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${outsiderConversationId}/messages`,
        {
          method:
            "POST",

          token:
            outsiderToken,

          body: {
            body:
              "This is a normal message after restriction.",
          },
        }
      );

    check(
      restrictedSend.status ===
        403 &&
        restrictedSend.body
          ?.success ===
          false &&
        restrictedSend.body
          ?.code ===
          "MESSAGING_TEMPORARILY_RESTRICTED" &&
        Boolean(
          restrictedSend.body
            ?.restrictedUntil
        ),
      "Temporary restriction blocks the user's next send."
    );

    const sellerMessageToRestrictedUser =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${outsiderConversationId}/messages`,
        {
          method:
            "POST",

          token:
            sellerAToken,

          body: {
            body:
              "You can still receive updates while messaging is restricted.",
          },
        }
      );

    if (
      sellerMessageToRestrictedUser.status !==
        201
    ) {
      throw new Error(
        "Seller could not create receipt test message for restricted user."
      );
    }

    const restrictedIncomingMessageId =
      String(
        sellerMessageToRestrictedUser.body
          ?.sentMessage
          ?.id ??
          ""
      );

    const restrictedRead =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${outsiderConversationId}`,
        {
          token:
            outsiderToken,
        }
      );

    check(
      restrictedRead.status ===
        200 &&
        restrictedRead.body
          ?.success ===
          true,
      "Messaging-restricted user can still read existing conversations."
    );

    const restrictedDeliveryAck =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${outsiderConversationId}/delivered`,
        {
          method:
            "POST",

          token:
            outsiderToken,

          body: {
            messageId:
              restrictedIncomingMessageId,
          },
        }
      );

    check(
      restrictedDeliveryAck.status ===
        200 &&
        restrictedDeliveryAck.body
          ?.success ===
          true &&
        restrictedDeliveryAck.body
          ?.deliveredThroughMessageId ===
          restrictedIncomingMessageId,
      "Messaging restriction does not block delivery acknowledgement."
    );

    const restrictedMarkRead =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${outsiderConversationId}/read`,
        {
          method:
            "POST",

          token:
            outsiderToken,

          body: {
            messageId:
              restrictedIncomingMessageId,
          },
        }
      );

    check(
      restrictedMarkRead.status ===
        200 &&
        restrictedMarkRead.body
          ?.success ===
          true &&
        Boolean(
          restrictedMarkRead.body
            ?.deliveredAt
        ) &&
        Boolean(
          restrictedMarkRead.body
            ?.readAt
        ),
      "Messaging restriction does not block mark-read behavior."
    );

    /*
     * ===================================================
     * MODERATION AUDIT HISTORY
     * ===================================================
     */

    const testUserIds =
      [
        buyer.id,
        sellerA.id,
        sellerB.id,
        outsider.id,
        eligibilityBuyer.id,
      ];

    const moderationEvents =
      await prisma.messagingModerationEvent.findMany({
        where: {
          userId: {
            in:
              testUserIds,
          },
        },

        orderBy: {
          createdAt:
            "asc",
        },
      });

    const buyerEvents =
      moderationEvents.filter(
        (
          event
        ) =>
          event.userId ===
          buyer.id
      );

    const sellerAEvents =
      moderationEvents.filter(
        (
          event
        ) =>
          event.userId ===
          sellerA.id
      );

    const outsiderEvents =
      moderationEvents.filter(
        (
          event
        ) =>
          event.userId ===
          outsider.id
      );

    check(
      buyerEvents.some(
        (
          event
        ) =>
          event.action ===
            MessagingModerationAction.redacted &&
          event.messageId !==
            null
      ) &&
        sellerAEvents.some(
          (
            event
        ) =>
          event.action ===
            MessagingModerationAction.redacted &&
          event.messageId !==
            null
        ) &&
        sellerAEvents.some(
          (
            event
        ) =>
          event.action ===
            MessagingModerationAction.blocked &&
          event.messageId ===
            null
        ) &&
        outsiderEvents.some(
          (
            event
        ) =>
          event.action ===
            MessagingModerationAction.blocked &&
          event.messageId ===
            null
        ),
      "Suspicious attempts create correct linked and unlinked moderation audit events."
    );

    const outsiderBlockedEvents =
      outsiderEvents.filter(
        (
          event
        ) =>
          event.action ===
          MessagingModerationAction.blocked
      );

    check(
      outsiderBlockedEvents.length ===
        1,
      "Blocked first circumvention attempt creates one moderation event."
    );

    /*
     * ===================================================
     * RAW SECRET PERSISTENCE
     * ===================================================
     */

    const allTestMessages =
      await prisma.message.findMany({
        where: {
          senderId: {
            in:
              testUserIds,
          },
        },

        select: {
          body:
            true,
        },
      });

    const messageJson =
      JSON.stringify(
        allTestMessages
      ).toLowerCase();

    const moderationJson =
      JSON.stringify(
        moderationEvents
      ).toLowerCase();

    check(
      !messageJson.includes(
        rawPhone.toLowerCase()
      ) &&
        !messageJson.includes(
          externalUsername.toLowerCase()
        ) &&
        !moderationJson.includes(
          rawPhone.toLowerCase()
        ) &&
        !moderationJson.includes(
          externalUsername.toLowerCase()
        ),
      "Raw phone and social username are absent from messages and moderation metadata."
    );

    /*
     * ===================================================
     * SELLER ELIGIBILITY — FULL CANSELL
     * ===================================================
     *
     * accessStatus remains ACTIVE here.
     *
     * Removing the required matric number should still
     * make Seller A ineligible because the university is
     * a listed university.
     *
     * This proves messaging uses the canonical
     * getSellerEligibility().canSell result rather than
     * merely checking vendorProfile.accessStatus.
     */

    await prisma.user.update({
      where: {
        id:
          sellerA.id,
      },

      data: {
        matricNumber:
          null,
      },
    });

    const missingMatricGeneral =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            eligibilityBuyerToken,

          body: {
            contextType:
              "general",

            vendorId:
              sellerA.id,

            body:
              "Can I ask about your store?",
          },
        }
      );

    check(
      missingMatricGeneral.status ===
        400 &&
        missingMatricGeneral.body
          ?.code ===
          "SELLER_UNAVAILABLE",
      "New general conversation requires full seller eligibility, not only active access status."
    );

    const missingMatricListing =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            eligibilityBuyerToken,

          body: {
            contextType:
              "listing",

            productId:
              productA.id,

            body:
              "Is this listing still available?",
          },
        }
      );

    check(
      missingMatricListing.status ===
        400 &&
        missingMatricListing.body
          ?.code ===
          "SELLER_UNAVAILABLE",
      "New listing conversation also requires full seller eligibility."
    );

    /*
     * The main buyer ALREADY has both canonical threads.
     *
     * Missing current eligibility must not destroy those
     * established conversations.
     */

    const existingGeneralWhileIneligible =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "general",

            vendorId:
              sellerA.id,

            body:
              "Following up in our existing shop conversation.",
          },
        }
      );

    check(
      existingGeneralWhileIneligible.status ===
        201 &&
        existingGeneralWhileIneligible.body
          ?.conversation
          ?.id ===
          generalConversationId,
      "Existing general conversation survives later loss of seller eligibility."
    );

    const existingListingWhileIneligible =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "listing",

            productId:
              productA.id,

            body:
              "Following up in our existing listing conversation.",
          },
        }
      );

    check(
      existingListingWhileIneligible.status ===
        201 &&
        existingListingWhileIneligible.body
          ?.conversation
          ?.id ===
          listingConversationId,
      "Existing listing conversation survives later loss of seller eligibility."
    );

    /*
     * Restore matric before testing explicit access-state
     * controls.
     */

    await prisma.user.update({
      where: {
        id:
          sellerA.id,
      },

      data: {
        matricNumber:
          sellerAMatricNumber,
      },
    });

    /*
     * ===================================================
     * PENDING REVIEW
     * ===================================================
     */

    await prisma.vendorProfile.update({
      where: {
        userId:
          sellerA.id,
      },

      data: {
        accessStatus:
          VendorAccessStatus.pending_review,
      },
    });

    const pendingReviewGeneral =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            eligibilityBuyerToken,

          body: {
            contextType:
              "general",

            vendorId:
              sellerA.id,

            body:
              "Can I start a new conversation?",
          },
        }
      );

    check(
      pendingReviewGeneral.status ===
        400 &&
        pendingReviewGeneral.body
          ?.code ===
          "SELLER_UNAVAILABLE",
      "Pending-review seller cannot receive a new general sales conversation."
    );

    const pendingReviewListing =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            eligibilityBuyerToken,

          body: {
            contextType:
              "listing",

            productId:
              productA.id,

            body:
              "Can I start a new listing conversation?",
          },
        }
      );

    check(
      pendingReviewListing.status ===
        400 &&
        pendingReviewListing.body
          ?.code ===
          "SELLER_UNAVAILABLE",
      "Pending-review seller cannot receive a new listing conversation."
    );

    /*
     * ===================================================
     * RESTRICTED
     * ===================================================
     */

    await prisma.vendorProfile.update({
      where: {
        userId:
          sellerA.id,
      },

      data: {
        accessStatus:
          VendorAccessStatus.restricted,
      },
    });

    const restrictedSellerGeneral =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            eligibilityBuyerToken,

          body: {
            contextType:
              "general",

            vendorId:
              sellerA.id,

            body:
              "Can I start a new conversation now?",
          },
        }
      );

    check(
      restrictedSellerGeneral.status ===
        400 &&
        restrictedSellerGeneral.body
          ?.code ===
          "SELLER_UNAVAILABLE",
      "Restricted seller cannot receive a new general sales conversation."
    );

    const restrictedSellerListing =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            eligibilityBuyerToken,

          body: {
            contextType:
              "listing",

            productId:
              productA.id,

            body:
              "Can I start a new listing chat now?",
          },
        }
      );

    check(
      restrictedSellerListing.status ===
        400 &&
        restrictedSellerListing.body
          ?.code ===
          "SELLER_UNAVAILABLE",
      "Restricted seller cannot receive a new listing conversation."
    );

    /*
     * ===================================================
     * SUSPENDED
     * ===================================================
     */

    await prisma.vendorProfile.update({
      where: {
        userId:
          sellerA.id,
      },

      data: {
        accessStatus:
          VendorAccessStatus.suspended,
      },
    });

    const suspendedSellerGeneral =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            eligibilityBuyerToken,

          body: {
            contextType:
              "general",

            vendorId:
              sellerA.id,

            body:
              "Can I start a conversation with this seller?",
          },
        }
      );

    check(
      suspendedSellerGeneral.status ===
        400 &&
        suspendedSellerGeneral.body
          ?.code ===
          "SELLER_UNAVAILABLE",
      "Suspended seller cannot receive a new general sales conversation."
    );

    const suspendedSellerListing =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            eligibilityBuyerToken,

          body: {
            contextType:
              "listing",

            productId:
              productA.id,

            body:
              "Can I start a conversation about this listing?",
          },
        }
      );

    check(
      suspendedSellerListing.status ===
        400 &&
        suspendedSellerListing.body
          ?.code ===
          "SELLER_UNAVAILABLE",
      "Suspended seller cannot receive a new listing conversation."
    );

    /*
     * ===================================================
     * ARCHIVE LISTING
     * ===================================================
     */

    await prisma.product.update({
      where: {
        id:
          productA.id,
      },

      data: {
        isArchived:
          true,

        archivedAt:
          new Date(),
      },
    });

    /*
     * Main buyer already owns the canonical listing
     * conversation.
     *
     * Both listing archival and seller suspension must
     * leave that established conversation intact.
     */

    const existingArchivedListingReuse =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "listing",

            productId:
              productA.id,

            body:
              "I can still follow up in our existing archived-listing thread.",
          },
        }
      );

    check(
      existingArchivedListingReuse.status ===
        201 &&
        existingArchivedListingReuse.body
          ?.conversation
          ?.id ===
          listingConversationId,
      "Existing listing conversation survives listing archival and seller suspension."
    );

    const existingGeneralWhileSuspended =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "general",

            vendorId:
              sellerA.id,

            body:
              "I can still follow up in our existing storefront thread.",
          },
        }
      );

    check(
      existingGeneralWhileSuspended.status ===
        201 &&
        existingGeneralWhileSuspended.body
          ?.conversation
          ?.id ===
          generalConversationId,
      "Existing general conversation survives seller suspension."
    );

    /*
     * Seller-side sending also survives seller access
     * suspension because this is an established
     * conversation, not a new sales lead.
     */

    const suspendedSellerExistingReply =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/messages`,
        {
          method:
            "POST",

          token:
            sellerAToken,

          body: {
            body:
              "I can still reply in this existing conversation.",
          },
        }
      );

    check(
      suspendedSellerExistingReply.status ===
        201 &&
        suspendedSellerExistingReply.body
          ?.moderation
          ?.action ===
          "allow",
      "Suspended seller can still reply inside an existing conversation."
    );

    /*
     * A buyer who has never established this listing
     * conversation cannot create it after archival.
     *
     * LISTING_UNAVAILABLE owns the response because
     * archival is checked before seller eligibility.
     */

    const newArchivedListingAttempt =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            eligibilityBuyerToken,

          body: {
            contextType:
              "listing",

            productId:
              productA.id,

            body:
              "Can I message about this archived listing?",
          },
        }
      );

    check(
      newArchivedListingAttempt.status ===
        400 &&
        newArchivedListingAttempt.body
          ?.code ===
          "LISTING_UNAVAILABLE",
      "Archived listing cannot receive a new listing conversation."
    );

    /*
     * ===================================================
     * ORDER CHAT AFTER SELLER SUSPENSION
     * ===================================================
     *
     * This order existed before Seller A lost eligibility,
     * but it had no conversation yet.
     *
     * Creating the transaction conversation now must
     * still work.
     */

    const orderAfterSellerSuspension =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            contextType:
              "order",

            orderId:
              postEligibilityOrderId,

            vendorId:
              sellerA.id,

            body:
              "I need an update about this existing order.",
          },
        }
      );

    const postEligibilityOrderConversationId =
      String(
        orderAfterSellerSuspension.body
          ?.conversation
          ?.id ??
          ""
      );

    check(
      orderAfterSellerSuspension.status ===
        201 &&
        Boolean(
          postEligibilityOrderConversationId
        ) &&
        orderAfterSellerSuspension.body
          ?.conversation
          ?.contextType ===
          "order",
      "Buyer can start an order conversation after the participating seller becomes suspended."
    );

    const suspendedSellerOrderReply =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${postEligibilityOrderConversationId}/messages`,
        {
          method:
            "POST",

          token:
            sellerAToken,

          body: {
            body:
              "I can still communicate about this existing order.",
          },
        }
      );

    check(
      suspendedSellerOrderReply.status ===
        201 &&
        suspendedSellerOrderReply.body
          ?.moderation
          ?.action ===
          "allow",
      "Suspended seller can still reply in an existing-order conversation."
    );

    /*
     * ===================================================
     * NO CONVERSATIONS CREATED BY BLOCKED ELIGIBILITY
     * ===================================================
     */

    const eligibilityBuyerSalesConversations =
      await prisma.conversation.count({
        where: {
          buyerId:
            eligibilityBuyer.id,

          vendorId:
            sellerA.id,

          contextType: {
            in: [
              "general",
              "listing",
            ],
          },
        },
      });

    check(
      eligibilityBuyerSalesConversations ===
        0,
      "Blocked seller-eligibility attempts create no general or listing conversation rows."
    );

    /*
     * ===================================================
     * FINAL PRIVACY / HEALTH CHECKS
     * ===================================================
     */

    const finalBuyerListingThread =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}`,
        {
          token:
            buyerToken,
        }
      );

    check(
      finalBuyerListingThread.status ===
        200 &&
        !serializedContains(
          finalBuyerListingThread.body,
          rawPhone
        ) &&
        !serializedContains(
          finalBuyerListingThread.body,
          externalUsername
        ),
      "Final listing conversation remains usable without leaked raw contact details."
    );

    const finalSellerInbox =
      await apiRequest(
        baseUrl,
        "/api/messages/conversations",
        {
          token:
            sellerAToken,
        }
      );

    check(
      finalSellerInbox.status ===
        200 &&
        !serializedContains(
          finalSellerInbox.body,
          buyer.email
        ) &&
        !serializedContains(
          finalSellerInbox.body,
          buyer.phone ??
            ""
        ) &&
        !serializedContains(
          finalSellerInbox.body,
          sellerA.email
        ) &&
        !serializedContains(
          finalSellerInbox.body,
          sellerA.phone ??
            ""
        ) &&
        !serializedContains(
          finalSellerInbox.body,
          "Private Messaging Pickup A"
        ) &&
        !serializedContains(
          finalSellerInbox.body,
          "Messaging Test Pickup Multi Vendor"
        ),
      "Final generic messaging inbox remains free of private account and pickup data."
    );

    const buyerSellerAConversations =
      await prisma.conversation.findMany({
        where: {
          buyerId:
            buyer.id,

          vendorId:
            sellerA.id,
        },

        select: {
          contextType:
            true,

          contextKey:
            true,

          productId:
            true,

          orderId:
            true,
        },
      });

    const hasGeneral =
      buyerSellerAConversations.some(
        (
          conversation
        ) =>
          conversation.contextKey ===
          "general"
      );

    const hasListing =
      buyerSellerAConversations.some(
        (
          conversation
        ) =>
          conversation.contextKey ===
          `listing:${productA.id}`
      );

    const sellerAOrderThreads =
      buyerSellerAConversations.filter(
        (
          conversation
        ) =>
          conversation.contextType ===
          "order"
      );

    check(
      hasGeneral &&
        hasListing &&
        sellerAOrderThreads.length ===
          3,
      "General, listing and separate order contexts coexist without collapsing into one thread."
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
      `Messaging HTTP tests: ${passed} passed / ${failed} failed`
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
        "\nMessaging HTTP test crashed:\n",
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
          "\nMessaging HTTP test cleanup failed:\n",
        cleanupError
      );

      process.exitCode =
        1;
      }

      await prisma.$disconnect();
    }
  );