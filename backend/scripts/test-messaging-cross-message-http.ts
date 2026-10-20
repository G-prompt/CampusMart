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
 * CAMPUSMART CROSS-MESSAGE MODERATION HTTP TEST
 * =======================================================
 *
 * Purpose:
 *
 * Verify that users cannot bypass moderation by splitting
 * contact-sharing intent across multiple messages.
 *
 * Examples:
 *
 *   whats
 *   app?
 *
 *   green
 *   app?
 *
 *   drop
 *   ur digits
 *
 *   my
 *   number is
 *   8035535266
 *
 *   08
 *   03
 *
 * Important security guarantees:
 *
 * - Only the SAME sender's recent messages count.
 * - Only messages from the SAME conversation count.
 * - Blocked fragments are never stored as Message rows.
 * - Legitimate numbers remain usable.
 * - Legitimate product/platform discussion should remain
 *   usable even when phrased across multiple messages.
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
 * FIXTURE REFERENCES
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

let universityId:
  string | null =
    null;

let sellerId:
  string | null =
    null;

let productId:
  number | null =
    null;

const buyerIds:
  string[] =
  [];

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
 * BUYER FIXTURE
 * =======================================================
 */

async function createBuyer(
  label: string
) {
  if (
    !universityId
  ) {
    throw new Error(
      "University fixture has not been created."
    );
  }

  const buyer =
    await prisma.user.create({
      data: {
        name:
          `Cross Message ${label}`,

        email:
          `cross-message-${label.toLowerCase().replace(
            /[^a-z0-9]+/g,
            "-"
          )}-${suffix}@campusmart.test`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.client,

        universityId,
      },
    });

  buyerIds.push(
    buyer.id
  );

  return {
    buyer,

    token:
      createToken(
        buyer.id,
        buyer.role
      ),
  };
}

/*
 * =======================================================
 * CONVERSATION HELPERS
 * =======================================================
 */

async function startListingConversation(
  baseUrl: string,
  token: string,
  body: string
) {
  if (
    productId ===
    null
  ) {
    throw new Error(
      "Product fixture has not been created."
    );
  }

  return apiRequest(
    baseUrl,
    "/api/messages/conversations",
    {
      method:
        "POST",

      token,

      body: {
        contextType:
          "listing",

        productId,

        body,
      },
    }
  );
}

async function startGeneralConversation(
  baseUrl: string,
  token: string,
  body: string
) {
  if (
    !sellerId
  ) {
    throw new Error(
      "Seller fixture has not been created."
    );
  }

  return apiRequest(
    baseUrl,
    "/api/messages/conversations",
    {
      method:
        "POST",

      token,

      body: {
        contextType:
          "general",

        vendorId:
          sellerId,

        body,
      },
    }
  );
}

async function sendMessage(
  baseUrl: string,
  token: string,
  conversationId: string,
  body: string
) {
  return apiRequest(
    baseUrl,
    `/api/messages/conversations/${conversationId}/messages`,
    {
      method:
        "POST",

      token,

      body: {
        body,
      },
    }
  );
}

function getConversationId(
  result: ApiResult
) {
  return String(
    result.body
      ?.conversation
      ?.id ??
      ""
  );
}

function isBlocked(
  result: ApiResult
) {
  return (
    result.status ===
      400 &&
    result.body?.code ===
      "OFF_PLATFORM_ATTEMPT_BLOCKED" &&
    result.body?.moderation
      ?.action ===
      "blocked" &&
    result.body?.moderation
      ?.categories
      ?.includes(
        "circumvention"
      )
  );
}

/*
 * =======================================================
 * BLOCKED-MESSAGE STORAGE ASSERTION
 * =======================================================
 */

async function messageCount(
  conversationId: string
) {
  return prisma.message.count({
    where: {
      conversationId,
    },
  });
}

/*
 * =======================================================
 * CLEANUP
 * =======================================================
 */

async function cleanup() {
  const allUserIds =
    [
      ...buyerIds,

      ...(sellerId
        ? [
            sellerId,
          ]
        : []),
    ];

  if (
    allUserIds.length >
    0
  ) {
    await prisma.messagingModerationEvent.deleteMany({
      where: {
        userId: {
          in:
            allUserIds,
        },
      },
    });

    await prisma.conversation.deleteMany({
      where: {
        OR: [
          {
            buyerId: {
              in:
                allUserIds,
            },
          },

          {
            vendorId: {
              in:
                allUserIds,
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
    allUserIds.length >
    0
  ) {
    await prisma.user.deleteMany({
      where: {
        id: {
          in:
            allUserIds,
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
    "\nCampusMart cross-message moderation HTTP tests\n"
  );

  /*
   * =====================================================
   * BASE FIXTURES
   * =====================================================
   */

  const university =
    await prisma.university.create({
      data: {
        name:
          `Cross Message University ${suffix}`,

        shortName:
          "CMX",

        slug:
          `cross-message-university-${suffix}`,

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

  const seller =
    await prisma.user.create({
      data: {
        name:
          "Cross Message Seller",

        email:
          `cross-message-seller-${suffix}@campusmart.test`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.vendor,

        universityId:
          university.id,

        matricNumber:
          `CMX-${suffix}`,

        studentVerificationStatus:
          StudentVerificationStatus.verified,

        studentVerifiedAt:
          new Date(),

        vendorProfile: {
          create: {
            businessName:
              "Cross Message Store",

            businessDescription:
              "Temporary seller used for messaging security tests.",

            pickupLocation:
              "Private Test Pickup",

            accessStatus:
              VendorAccessStatus.active,
          },
        },
      },
    });

  sellerId =
    seller.id;

  const sellerToken =
    createToken(
      seller.id,
      seller.role
    );

  const product =
    await prisma.product.create({
      data: {
        slug:
          `cross-message-product-${suffix}`,

        title:
          "Cross Message Product",

        category:
          "Technology",

        price:
          15000,

        rating:
          0,

        description:
          "Temporary product for cross-message moderation tests.",

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
        "Unable to determine temporary HTTP server port."
      );
    }

    const baseUrl =
      `http://127.0.0.1:${address.port}`;

    /*
     * ===================================================
     * 1. WHATS + APP
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Whats App"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "whats"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201 &&
        Boolean(
          conversationId
        ),
        `"whats" is initially allowed as an innocent fragment.`
      );

      const before =
        await messageCount(
          conversationId
        );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "app?"
        );

      const after =
        await messageCount(
          conversationId
        );

      check(
        isBlocked(
          second
        ),
        `"whats" -> "app?" is blocked as split WhatsApp circumvention.`
      );

      check(
        after ===
          before,
        `Blocked "app?" fragment is not stored.`
      );
    }

    /*
     * ===================================================
     * 2. GREEN + APP
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Green App"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "green"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `"green" is initially allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "app?"
        );

      check(
        isBlocked(
          second
        ),
        `"green" -> "app?" is blocked.`
      );
    }

    /*
     * ===================================================
     * 3. DROP + UR DIGITS
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Drop Digits"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "drop"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `"drop" alone is initially allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "ur digits"
        );

      check(
        isBlocked(
          second
        ),
        `"drop" -> "ur digits" is blocked as contact solicitation.`
      );
    }

    /*
     * ===================================================
     * 4. MY + NUMBER IS + 10-DIGIT NUMBER
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Split Number Context"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "my"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `"my" is initially allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "number is"
        );

      check(
        second.status ===
          201,
        `"number is" remains allowed before the numeric fragment arrives.`
      );

      const before =
        await messageCount(
          conversationId
        );

      const third =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "8035535266"
        );

      const after =
        await messageCount(
          conversationId
        );

      check(
        isBlocked(
          third
        ) &&
        third.body?.moderation
          ?.categories
          ?.includes(
            "phone_number"
          ),
        `"my" -> "number is" -> "8035535266" is blocked.`
      );

      check(
        after ===
          before,
        `The final reconstructed phone fragment is never stored.`
      );
    }

    /*
     * ===================================================
     * 5. NUMERIC CHUNKS
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Numeric Chunks"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "08"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `"08" alone is initially allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "03"
        );

      check(
        isBlocked(
          second
        ) &&
        second.body?.moderation
          ?.categories
          ?.includes(
            "phone_number"
          ),
        `"08" -> "03" triggers reconstructed Nigerian phone-prefix protection.`
      );
    }

    /*
     * ===================================================
     * 6. DIGIT-BY-DIGIT PREFIX
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Digit By Digit"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "0"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `First single digit is allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "8"
        );

      check(
        second.status ===
          201,
        `Second single digit is still allowed.`
      );

      const third =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "0"
        );

      check(
        isBlocked(
          third
        ),
        `"0" -> "8" -> "0" is detected once it forms a phone prefix.`
      );
    }

    /*
     * ===================================================
     * 7. NUMBER WORDS ACROSS MESSAGES
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Number Words"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "zero"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `"zero" alone is allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "eight"
        );

      check(
        second.status ===
          201,
        `"eight" remains allowed as the second isolated word.`
      );

      const third =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "zero"
        );

      check(
        isBlocked(
          third
        ),
        `"zero" -> "eight" -> "zero" is detected as an assembled phone prefix.`
      );
    }

    /*
     * ===================================================
     * 8. TELE + GRAM
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Telegram Split"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "tele"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `"tele" alone is allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "gram?"
        );

      check(
        isBlocked(
          second
        ),
        `"tele" -> "gram?" is blocked as Telegram circumvention.`
      );
    }

    /*
     * ===================================================
     * 9. INSTA + GRAM
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Instagram Split"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "insta"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `"insta" alone is initially allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "gram?"
        );

      check(
        isBlocked(
          second
        ),
        `"insta" -> "gram?" is blocked as Instagram circumvention.`
      );
    }

    /*
     * ===================================================
     * 10. SAME-SENDER ISOLATION
     * ===================================================
     *
     * Buyer:
     *   whats
     *
     * Seller:
     *   app?
     *
     * Seller must NOT inherit buyer's context.
     */

    {
      const {
        token:
          buyerToken,
      } =
        await createBuyer(
          "Sender Isolation"
        );

      const first =
        await startListingConversation(
          baseUrl,
          buyerToken,
          "whats"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `Buyer sends "whats" for sender-isolation test.`
      );

      const sellerReply =
        await sendMessage(
          baseUrl,
          sellerToken,
          conversationId,
          "app?"
        );

      check(
        sellerReply.status ===
          201,
        `Seller's "app?" is not contaminated by buyer's "whats".`
      );

      const buyerContinuation =
        await sendMessage(
          baseUrl,
          buyerToken,
          conversationId,
          "app?"
        );

      check(
        isBlocked(
          buyerContinuation
        ),
        `Buyer still cannot finish their own "whats" -> "app?" sequence after seller replies.`
      );
    }

    /*
     * ===================================================
     * 11. CONVERSATION ISOLATION
     * ===================================================
     *
     * Same buyer:
     *
     * listing conversation:
     *   whats
     *
     * general conversation:
     *   app?
     *
     * Different conversations must never combine.
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Conversation Isolation"
        );

      const listing =
        await startListingConversation(
          baseUrl,
          token,
          "whats"
        );

      const listingConversationId =
        getConversationId(
          listing
        );

      check(
        listing.status ===
          201,
        `Listing conversation stores "whats".`
      );

      const general =
        await startGeneralConversation(
          baseUrl,
          token,
          "app?"
        );

      check(
        general.status ===
          201,
        `"app?" in a different conversation is not combined with listing history.`
      );

      const listingContinuation =
        await sendMessage(
          baseUrl,
          token,
          listingConversationId,
          "app?"
        );

      check(
        isBlocked(
          listingContinuation
        ),
        `Returning to the original conversation still detects "whats" -> "app?".`
      );
    }

    /*
     * ===================================================
     * 12. LEGITIMATE PRODUCT DISCUSSION ACROSS MESSAGES
     * ===================================================
     *
     * IMPORTANT FALSE-POSITIVE TEST.
     *
     * Desired:
     *
     *   Does this phone support
     *   WhatsApp?
     *
     * should remain legitimate marketplace conversation.
     *
     * If this fails, DO NOT weaken the test.
     * We fix the moderation design instead.
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Product WhatsApp"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "Does this phone support"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `Product-support question first half is allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "WhatsApp?"
        );

      check(
        second.status ===
          201,
        `"Does this phone support" -> "WhatsApp?" remains allowed.`
      );
    }

    /*
     * ===================================================
     * 13. LEGITIMATE TELEGRAM PRODUCT DISCUSSION
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Product Telegram"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "Does this smartwatch show"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `Smartwatch question first half is allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "Telegram notifications?"
        );

      check(
        second.status ===
          201,
        `Split Telegram-notification product question remains allowed.`
      );
    }

    /*
     * ===================================================
     * 14. LEGITIMATE TIME
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Meeting Time"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "Meet me at"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `Meeting sentence is allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "4:30"
        );

      check(
        second.status ===
          201,
        `Split meeting time 4:30 remains allowed.`
      );
    }

    /*
     * ===================================================
     * 15. LEGITIMATE ROOM NUMBER
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Room Number"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "Room"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `"Room" is allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "204"
        );

      check(
        second.status ===
          201,
        `"Room" -> "204" remains allowed.`
      );
    }

    /*
     * ===================================================
     * 16. LEGITIMATE ORDER REFERENCE
     * ===================================================
     */

    {
      const {
        token,
      } =
        await createBuyer(
          "Order Number"
        );

      const first =
        await startListingConversation(
          baseUrl,
          token,
          "Order"
        );

      const conversationId =
        getConversationId(
          first
        );

      check(
        first.status ===
          201,
        `"Order" is allowed.`
      );

      const second =
        await sendMessage(
          baseUrl,
          token,
          conversationId,
          "391"
        );

      check(
        second.status ===
          201,
        `"Order" -> "391" remains allowed.`
      );
    }

    /*
     * ===================================================
     * MODERATION HISTORY PRIVACY
     * ===================================================
     */

    const moderationEvents =
      await prisma.messagingModerationEvent.findMany({
        where: {
          userId: {
            in:
              buyerIds,
          },
        },

        select: {
          id:
            true,

          userId:
            true,

          conversationId:
            true,

          categories:
            true,

          action:
            true,

          warningCode:
            true,

          strikeWeight:
            true,

          createdAt:
            true,
        },
      });

    const serializedEvents =
      JSON.stringify(
        moderationEvents
      );

    check(
      !serializedEvents.includes(
        "8035535266"
      ) &&
      !serializedEvents.includes(
        "whatsapp"
      ) &&
      !serializedEvents.includes(
        "ur digits"
      ),
      `Moderation metadata does not persist reconstructed contact secrets or phrases.`
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
      `Cross-message HTTP tests: ${passed} passed / ${failed} failed`
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
        "\nCross-message HTTP test crashed:\n",
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
          "\nCross-message cleanup failed:\n",
        cleanupError
      );

        process.exitCode =
          1;
      }

      await prisma.$disconnect();
    }
  );