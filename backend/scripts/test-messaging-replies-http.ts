import "dotenv/config";

import jwt from "jsonwebtoken";

import app from "../src/app";

import {
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

/*
 * =======================================================
 * CAMPUSMART MESSAGE REPLY HTTP INTEGRATION TEST
 * =======================================================
 *
 * Proves:
 *
 * - existing normal sends still work
 * - seller can reply to buyer
 * - buyer can reply to seller
 * - reply relation persists
 * - thread returns safe quoted-message preview
 * - sanitized originals stay sanitized inside quotes
 * - cross-conversation reply IDs are rejected
 * - random reply IDs are rejected
 * - invalid reply ID types are rejected
 * - failed reply attempts create no Message rows
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
 * TEST REFERENCES
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

let universityId:
  string | null =
    null;

let buyerId:
  string | null =
    null;

let sellerId:
  string | null =
    null;

let productId:
  number | null =
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
  options?: {
    method?:
      | "GET"
      | "POST"
      | "PATCH"
      | "PUT"
      | "DELETE";

    token?: string;

    body?: unknown;
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
 * CLEANUP
 * =======================================================
 */

async function cleanup() {
  const userIds =
    [
      buyerId,
      sellerId,
    ].filter(
      (
        value
      ): value is string =>
        Boolean(
          value
        )
    );

  /*
   * Conversations first because participant relations
   * intentionally restrict deletion.
   *
   * Messages cascade from Conversation.
   */

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
    productId !==
    null
  ) {
    await prisma.product.deleteMany({
      where: {
        id:
          productId,
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
 * MAIN
 * =======================================================
 */

async function main() {
  console.log(
    "\nCampusMart messaging reply HTTP integration test\n"
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
          `Messaging Reply University ${suffix}`,

        shortName:
          "MRU",

        slug:
          `messaging-reply-university-${suffix}`,

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
          "Messaging Reply Buyer",

        email:
          `messaging-reply-buyer-${suffix}@campusmart.test`,

        passwordHash:
          "test-password-hash",

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
   * SELLER
   * =====================================================
   */

  const seller =
    await prisma.user.create({
      data: {
        name:
          "Messaging Reply Seller",

        email:
          `messaging-reply-seller-${suffix}@campusmart.test`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.vendor,

        universityId:
          university.id,

        matricNumber:
          `MRUS-${suffix}`,

        studentVerificationStatus:
          StudentVerificationStatus.verified,

        studentVerifiedAt:
          new Date(),

        vendorProfile: {
          create: {
            businessName:
              "Messaging Reply Store",

            businessDescription:
              "Temporary store for reply integration tests.",

            pickupLocation:
              "Private Reply Test Pickup",

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
   * PRODUCT
   * =====================================================
   */

  const product =
    await prisma.product.create({
      data: {
        slug:
          `messaging-reply-product-${suffix}`,

        title:
          "Messaging Reply Product",

        category:
          "Technology",

        price:
          25000,

        rating:
          0,

        description:
          "Temporary listing for reply tests.",

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
   * =====================================================
   * TOKENS
   * =====================================================
   */

  const buyerToken =
    createToken(
      buyer.id,
      buyer.role
    );

  const sellerToken =
    createToken(
      seller.id,
      seller.role
    );

  /*
   * =====================================================
   * SERVER
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
     * 1. START LISTING CONVERSATION
     * ===================================================
     *
     * Deliberately include a phone number.
     *
     * This lets us prove that reply previews quote the
     * sanitized stored body rather than the original raw
     * request content.
     */

    const startListing =
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
              product.id,

            body:
              `Hi, my number is ${rawPhone}. Is this available?`,
          },
        }
      );

    const listingConversationId =
      String(
        startListing.body
          ?.conversation
          ?.id ??
          ""
      );

    const buyerFirstMessageId =
      String(
        startListing.body
          ?.sentMessage
          ?.id ??
          ""
      );

    check(
      startListing.status ===
        201 &&
        Boolean(
          listingConversationId
        ) &&
        Boolean(
          buyerFirstMessageId
        ) &&
        startListing.body
          ?.moderation
          ?.action ===
          "redacted",
      "Buyer starts listing conversation with sanitized first message."
    );

    /*
     * ===================================================
     * 2. SELLER REPLIES TO BUYER
     * ===================================================
     */

    const sellerReply =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/messages`,
        {
          method:
            "POST",

          token:
            sellerToken,

          body: {
            body:
              "Yes, it is still available.",

            replyToMessageId:
              buyerFirstMessageId,
          },
        }
      );

    const sellerReplyId =
      String(
        sellerReply.body
          ?.sentMessage
          ?.id ??
          ""
      );

    check(
      sellerReply.status ===
        201 &&
        sellerReply.body
          ?.success ===
          true &&
        sellerReply.body
          ?.sentMessage
          ?.replyToMessageId ===
          buyerFirstMessageId &&
        Boolean(
          sellerReplyId
        ),
      "Seller can reply directly to buyer message."
    );

    /*
     * ===================================================
     * 3. REPLY RELATION PERSISTS
     * ===================================================
     */

    const storedSellerReply =
      await prisma.message.findUnique({
        where: {
          id:
            sellerReplyId,
        },

        select: {
          id:
            true,

          replyToMessageId:
            true,

          replyToMessage: {
            select: {
              id:
                true,

              body:
                true,
            },
          },
        },
      });

    check(
      storedSellerReply
        ?.replyToMessageId ===
        buyerFirstMessageId &&
        storedSellerReply
          ?.replyToMessage
          ?.id ===
          buyerFirstMessageId,
      "Reply relationship is persisted in the database."
    );

    /*
     * ===================================================
     * 4. QUOTED ORIGINAL REMAINS SANITIZED
     * ===================================================
     */

    check(
      Boolean(
        storedSellerReply
          ?.replyToMessage
          ?.body
          ?.includes(
            "*"
          )
      ) &&
        !storedSellerReply
          ?.replyToMessage
          ?.body
          ?.includes(
            rawPhone
          ),
      "Reply relation references sanitized stored content, never the raw phone number."
    );

    /*
     * ===================================================
     * 5. BUYER REPLIES TO SELLER
     * ===================================================
     */

    const buyerReply =
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
              "Great, that's the one I meant.",

            replyToMessageId:
              sellerReplyId,
          },
        }
      );

    const buyerReplyId =
      String(
        buyerReply.body
          ?.sentMessage
          ?.id ??
          ""
      );

    check(
      buyerReply.status ===
        201 &&
        buyerReply.body
          ?.sentMessage
          ?.replyToMessageId ===
          sellerReplyId &&
        buyerReply.body
          ?.sentMessage
          ?.replyToMessage
          ?.id ===
          sellerReplyId,
      "Buyer can reply directly to seller message."
    );

    /*
     * ===================================================
     * 6. THREAD RETURNS REPLY PREVIEWS
     * ===================================================
     */

    const thread =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}`,
        {
          token:
            buyerToken,
        }
      );

    const sellerReplyInThread =
      (
        thread.body
          ?.messages ??
        []
      ).find(
        (
          message:
            any
        ) =>
          message.id ===
          sellerReplyId
      );

    const buyerReplyInThread =
      (
        thread.body
          ?.messages ??
        []
      ).find(
        (
          message:
            any
        ) =>
          message.id ===
          buyerReplyId
      );

    check(
      thread.status ===
        200 &&
        sellerReplyInThread
          ?.replyToMessage
          ?.id ===
          buyerFirstMessageId &&
        buyerReplyInThread
          ?.replyToMessage
          ?.id ===
          sellerReplyId,
      "Thread history returns reply-to-message previews for both participants."
    );

    /*
     * ===================================================
     * 7. THREAD QUOTE DOES NOT LEAK RAW CONTACT
     * ===================================================
     */

    check(
      !JSON.stringify(
        sellerReplyInThread
          ?.replyToMessage ??
          {}
      ).includes(
        rawPhone
      ) &&
        sellerReplyInThread
          ?.replyToMessage
          ?.body
          ?.includes(
            "*"
          ),
      "Thread reply preview contains sanitized content and does not leak the original phone number."
    );

    /*
     * ===================================================
     * 8. NORMAL NON-REPLY SEND STILL WORKS
     * ===================================================
     */

    const normalSend =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/messages`,
        {
          method:
            "POST",

          token:
            sellerToken,

          body: {
            body:
              "This is a normal message.",
          },
        }
      );

    check(
      normalSend.status ===
        201 &&
        normalSend.body
          ?.sentMessage
          ?.body ===
          "This is a normal message." &&
        (
          normalSend.body
            ?.sentMessage
            ?.replyToMessageId ===
            null ||
          normalSend.body
            ?.sentMessage
            ?.replyToMessageId ===
            undefined
        ),
      "Normal messages still work without a reply target."
    );

    /*
     * ===================================================
     * CREATE SECOND CONVERSATION
     * ===================================================
     */

    const generalStart =
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
              seller.id,

            body:
              "This is a separate general conversation.",
          },
        }
      );

    const generalMessageId =
      String(
        generalStart.body
          ?.sentMessage
          ?.id ??
          ""
      );

    if (
      generalStart.status !==
        201 ||
      !generalMessageId
    ) {
      throw new Error(
        "Unable to create separate conversation for cross-conversation reply test."
      );
    }

    /*
     * ===================================================
     * 9. CROSS-CONVERSATION REPLY BLOCKED
     * ===================================================
     */

    const countBeforeCrossConversation =
      await prisma.message.count({
        where: {
          conversationId:
            listingConversationId,
        },
      });

    const crossConversationReply =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${listingConversationId}/messages`,
        {
          method:
            "POST",

          token:
            sellerToken,

          body: {
            body:
              "I should not be able to attach this reply.",

            replyToMessageId:
              generalMessageId,
          },
        }
      );

    const countAfterCrossConversation =
      await prisma.message.count({
        where: {
          conversationId:
            listingConversationId,
        },
      });

    check(
      crossConversationReply.status ===
        404 &&
        crossConversationReply.body
          ?.code ===
          "REPLY_MESSAGE_NOT_FOUND" &&
        countAfterCrossConversation ===
          countBeforeCrossConversation,
      "Message from another conversation cannot be used as a reply target."
    );

    /*
     * ===================================================
     * 10. RANDOM MESSAGE ID BLOCKED
     * ===================================================
     */

    const countBeforeRandom =
      await prisma.message.count({
        where: {
          conversationId:
            listingConversationId,
        },
      });

    const randomReply =
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
              "This random reply target should fail.",

            replyToMessageId:
              "00000000-0000-0000-0000-000000000000",
          },
        }
      );

    const countAfterRandom =
      await prisma.message.count({
        where: {
          conversationId:
            listingConversationId,
        },
      });

    check(
      randomReply.status ===
        404 &&
        randomReply.body
          ?.code ===
          "REPLY_MESSAGE_NOT_FOUND" &&
        countAfterRandom ===
          countBeforeRandom,
      "Unknown message ID is rejected and creates no Message row."
    );

    /*
     * ===================================================
     * 11. INVALID REPLY TYPE BLOCKED
     * ===================================================
     */

    const countBeforeInvalidType =
      await prisma.message.count({
        where: {
          conversationId:
            listingConversationId,
        },
      });

    const invalidReplyType =
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
              "This should fail because the reply target is not a string.",

            replyToMessageId:
              12345,
          },
        }
      );

    const countAfterInvalidType =
      await prisma.message.count({
        where: {
          conversationId:
            listingConversationId,
        },
      });

    check(
      invalidReplyType.status ===
        400 &&
        invalidReplyType.body
          ?.code ===
          "INVALID_REPLY_MESSAGE_ID" &&
        countAfterInvalidType ===
          countBeforeInvalidType,
      "Non-string reply target is rejected without storing a message."
    );

    /*
     * ===================================================
     * 12. DELETED MESSAGE CANNOT BECOME NEW REPLY TARGET
     * ===================================================
     */

    const normalMessageId =
      String(
        normalSend.body
          ?.sentMessage
          ?.id ??
          ""
      );

    if (
      !normalMessageId
    ) {
      throw new Error(
        "Normal message ID was unavailable for deleted-target test."
      );
    }

    await prisma.message.update({
      where: {
        id:
          normalMessageId,
      },

      data: {
        deletedAt:
          new Date(),
      },
    });

    const countBeforeDeletedTarget =
      await prisma.message.count({
        where: {
          conversationId:
            listingConversationId,
        },
      });

    const deletedTargetReply =
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
              "I should not be able to reply to a deleted message.",

            replyToMessageId:
              normalMessageId,
          },
        }
      );

    const countAfterDeletedTarget =
      await prisma.message.count({
        where: {
          conversationId:
            listingConversationId,
        },
      });

    check(
      deletedTargetReply.status ===
        404 &&
        deletedTargetReply.body
          ?.code ===
          "REPLY_MESSAGE_NOT_FOUND" &&
        countAfterDeletedTarget ===
          countBeforeDeletedTarget,
      "Soft-deleted messages cannot be selected as new reply targets."
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
      `Messaging reply HTTP tests: ${passed} passed / ${failed} failed`
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
        "\nMessaging reply HTTP test crashed:\n",
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
          "\nMessaging reply HTTP test cleanup failed:\n",
          cleanupError
        );

        process.exitCode =
          1;
      }

      await prisma.$disconnect();
    }
  );