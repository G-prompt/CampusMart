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

import {
  moderateOutgoingMessage,
} from "../src/services/messageModeration.service";

/*
 * =======================================================
 * CAMPUSMART PHONE-CIRCUMVENTION SECURITY TEST
 * =======================================================
 *
 * Tests:
 *
 * - Nigerian local phone numbers
 * - +234 numbers
 * - 234 numbers without +
 * - punctuation splitting
 * - quote splitting
 * - partial phone numbers
 * - Nigerian prefixes such as 080 / 081 / 070 / 090 / 091
 * - context-aware 10-digit numbers without leading zero
 * - OPay-style number context
 * - WhatsApp + phone disclosure blocking
 * - cross-message splitting:
 *
 *     080
 *     391
 *     5537
 *
 * - harmless numeric content:
 *
 *     Room 204
 *     4:30
 *     ₦15,000
 *
 * - blocked fragments never become Message rows
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
 * DIRECT MODERATION HELPERS
 * =======================================================
 */

function expectPhoneRedacted(
  input: string,
  label: string
) {
  const result =
    moderateOutgoingMessage(
      input
    );

  check(
    result.action ===
      "redacted" &&
      result.categories.includes(
        "phone_number"
      ) &&
      result.sanitizedBody !==
        input,
    label
  );
}

function expectBlocked(
  input: string,
  label: string
) {
  const result =
    moderateOutgoingMessage(
      input
    );

  check(
    result.action ===
      "blocked" &&
      result.categories.includes(
        "circumvention"
      ) &&
      result.warningCode ===
        "OFF_PLATFORM_ATTEMPT_BLOCKED",
    label
  );
}

function expectAllowed(
  input: string,
  label: string,
  recentPhoneSharingAttempt =
    false
) {
  const result =
    moderateOutgoingMessage(
      input,
      {
        recentPhoneSharingAttempt,
      }
    );

  check(
    result.action ===
      "allow" &&
      result.categories.length ===
        0,
    label
  );
}

function expectSplitBlocked(
  input: string,
  label: string
) {
  const result =
    moderateOutgoingMessage(
      input,
      {
        recentPhoneSharingAttempt:
          true,
      }
    );

  check(
    result.action ===
      "blocked" &&
      result.categories.includes(
        "phone_number"
      ) &&
      result.categories.includes(
        "circumvention"
      ) &&
      result.warningCode ===
        "OFF_PLATFORM_ATTEMPT_BLOCKED",
    label
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
      sellerId,
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
    "\nCampusMart phone-circumvention security tests\n"
  );

  /*
   * =====================================================
   * PURE SCANNER TESTS
   * =====================================================
   */

  expectPhoneRedacted(
    "Call me on 08035535219",
    "Full Nigerian local phone number is redacted."
  );

  expectPhoneRedacted(
    "Call 08166166698",
    "081 Nigerian number is redacted."
  );

  expectPhoneRedacted(
    "Call 07035535219",
    "070 Nigerian number is redacted."
  );

  expectPhoneRedacted(
    "Call 09035535219",
    "090 Nigerian number is redacted."
  );

  expectPhoneRedacted(
    "Call 09135535219",
    "091 Nigerian number is redacted."
  );

  expectPhoneRedacted(
    "Call me +234 803 553 5219",
    "+234 Nigerian number is redacted."
  );

  expectPhoneRedacted(
    "Call me 2348035535219",
    "234 Nigerian number without plus is redacted."
  );

  expectPhoneRedacted(
    "080.355.352.19",
    "Phone number split with full stops is redacted."
  );

  expectPhoneRedacted(
    "080-355-352-19",
    "Phone number split with hyphens is redacted."
  );

  expectPhoneRedacted(
    "080_355_352_19",
    "Phone number split with underscores is redacted."
  );

  expectPhoneRedacted(
    `"080" "355" "352" "19"`,
    "Phone number split with quotes is redacted."
  );

  expectPhoneRedacted(
    "080355352",
    "Incomplete Nigerian phone sequence is redacted."
  );

  expectPhoneRedacted(
    "080",
    "Bare Nigerian mobile prefix seeds continuation protection."
  );

  expectPhoneRedacted(
    "my phone is 8035535219",
    "Contextual Nigerian number without leading zero is redacted."
  );

  /*
   * =====================================================
   * WHATSAPP + PHONE
   * =====================================================
   *
   * This is deliberately stricter than ordinary phone
   * disclosure.
   *
   * WhatsApp paired with an actual phone value is an
   * explicit off-platform contact route.
   *
   * It must therefore be BLOCKED rather than merely
   * sanitized.
   */

  expectBlocked(
    "WhatsApp 803-553-5219",
    "WhatsApp-context phone number is blocked as explicit off-platform circumvention."
  );

  expectPhoneRedacted(
    "My OPay is 8035535219",
    "OPay-context 10-digit number is redacted."
  );

  expectPhoneRedacted(
    `"080" "391" "5537" my digits`,
    "Multiple quoted number fragments in one message are redacted."
  );

  /*
   * =====================================================
   * PURE CONTINUATION-MODE TESTS
   * =====================================================
   */

  expectSplitBlocked(
    "391",
    "391 is blocked as a continuation after recent phone sharing."
  );

  expectSplitBlocked(
    "5537",
    "5537 is blocked as a continuation after recent phone sharing."
  );

  expectSplitBlocked(
    `"391"`,
    "Quoted continuation fragment is blocked."
  );

  expectSplitBlocked(
    "5-5-3-7",
    "Punctuation-separated continuation fragment is blocked."
  );

  /*
   * =====================================================
   * HARMLESS NUMBERS WITHOUT HISTORY
   * =====================================================
   */

  expectAllowed(
    "Meet me in Room 204",
    "Room 204 remains allowed."
  );

  expectAllowed(
    "Let's meet at 4:30",
    "Time 4:30 remains allowed."
  );

  expectAllowed(
    "The price is \u20A615,000",
    "Currency amount ₦15,000 remains allowed."
  );

  /*
   * =====================================================
   * HARMLESS NUMBERS EVEN DURING CONTINUATION WINDOW
   * =====================================================
   */

  expectAllowed(
    "Meet me in Room 204",
    "Room 204 remains allowed during phone-continuation mode.",
    true
  );

  expectAllowed(
    "Let's meet at 4:30",
    "Time 4:30 remains allowed during phone-continuation mode.",
    true
  );

  expectAllowed(
    "The price is \u20A615,000",
    "Currency amount remains allowed during phone-continuation mode.",
    true
  );

  expectAllowed(
    "Order 391 is ready",
    "Order reference 391 remains allowed during continuation mode.",
    true
  );

  /*
   * =====================================================
   * DATABASE FIXTURES
   * =====================================================
   */

  const university =
    await prisma.university.create({
      data: {
        name:
          `Phone Security University ${suffix}`,

        shortName:
          "PSU",

        slug:
          `phone-security-university-${suffix}`,

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

  const buyer =
    await prisma.user.create({
      data: {
        name:
          "Phone Security Buyer",

        email:
          `phone-security-buyer-${suffix}@campusmart.test`,

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

  const seller =
    await prisma.user.create({
      data: {
        name:
          "Phone Security Seller",

        email:
          `phone-security-seller-${suffix}@campusmart.test`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.vendor,

        universityId:
          university.id,

        matricNumber:
          `PSU-${suffix}`,

        studentVerificationStatus:
          StudentVerificationStatus.verified,

        studentVerifiedAt:
          new Date(),

        vendorProfile: {
          create: {
            businessName:
              "Phone Security Store",

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

  const product =
    await prisma.product.create({
      data: {
        slug:
          `phone-security-product-${suffix}`,

        title:
          "Phone Security Product",

        category:
          "Technology",

        price:
          15000,

        rating:
          0,

        description:
          "Temporary product for phone-circumvention tests.",

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

  const buyerToken =
    createToken(
      buyer.id,
      buyer.role
    );

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
     * FIRST FRAGMENT
     * ===================================================
     */

    const start =
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
              "080",
          },
        }
      );

    const conversationId =
      String(
        start.body
          ?.conversation
          ?.id ??
          ""
      );

    check(
      start.status ===
        201 &&
        Boolean(
          conversationId
        ) &&
        start.body
          ?.moderation
          ?.action ===
          "redacted" &&
        start.body
          ?.moderation
          ?.categories
          ?.includes(
            "phone_number"
          ),
      "HTTP first fragment 080 is redacted and recorded."
    );

    check(
      typeof start.body
        ?.sentMessage
        ?.body ===
        "string" &&
        !start.body
          .sentMessage
          .body
          .includes(
            "080"
          ),
      "Recipient never receives raw first fragment 080."
    );

    /*
     * ===================================================
     * EVENT WAS LINKED TO CONVERSATION
     * ===================================================
     */

    const seedEvent =
      await prisma.messagingModerationEvent.findFirst({
        where: {
          userId:
            buyer.id,

          conversationId,

          categories: {
            has:
              "phone_number",
          },
        },

        select: {
          id:
            true,

          conversationId:
            true,

          categories:
            true,

          action:
            true,
        },
      });

    check(
      Boolean(
        seedEvent
      ) &&
        seedEvent
          ?.conversationId ===
          conversationId,
      "Initial phone moderation event is linked to the canonical conversation."
    );

    /*
     * ===================================================
     * HARMLESS MESSAGE DURING ACTIVE WINDOW
     * ===================================================
     */

    const roomMessage =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${conversationId}/messages`,
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            body:
              "Meet me in Room 204",
          },
        }
      );

    check(
      roomMessage.status ===
        201 &&
        roomMessage.body
          ?.sentMessage
          ?.body ===
          "Meet me in Room 204",
      "Room 204 remains sendable after a recent phone attempt."
    );

    const timeMessage =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${conversationId}/messages`,
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            body:
              "Let's meet at 4:30",
          },
        }
      );

    check(
      timeMessage.status ===
        201 &&
        timeMessage.body
          ?.sentMessage
          ?.body ===
          "Let's meet at 4:30",
      "4:30 remains sendable after a recent phone attempt."
    );

    const priceText =
      "The price is \u20A615,000";

    const priceMessage =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${conversationId}/messages`,
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            body:
              priceText,
          },
        }
      );

    check(
      priceMessage.status ===
        201 &&
        priceMessage.body
          ?.sentMessage
          ?.body ===
          priceText,
      "₦15,000 remains sendable after a recent phone attempt."
    );

    /*
     * ===================================================
     * SECOND FRAGMENT
     * ===================================================
     */

    const countBefore391 =
      await prisma.message.count({
        where: {
          conversationId,
        },
      });

    const fragment391 =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${conversationId}/messages`,
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            body:
              "391",
          },
        }
      );

    const countAfter391 =
      await prisma.message.count({
        where: {
          conversationId,
        },
      });

    check(
      fragment391.status ===
        400 &&
        fragment391.body
          ?.code ===
          "OFF_PLATFORM_ATTEMPT_BLOCKED" &&
        fragment391.body
          ?.moderation
          ?.action ===
          "blocked" &&
        fragment391.body
          ?.moderation
          ?.categories
          ?.includes(
            "phone_number"
          ) &&
        fragment391.body
          ?.moderation
          ?.categories
          ?.includes(
            "circumvention"
          ),
      "Second fragment 391 is blocked as split-number circumvention."
    );

    check(
      countAfter391 ===
        countBefore391,
      "Blocked fragment 391 never becomes a Message row."
    );

    /*
     * ===================================================
     * THIRD FRAGMENT
     * ===================================================
     */

    const countBefore5537 =
      await prisma.message.count({
        where: {
          conversationId,
        },
      });

    const fragment5537 =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${conversationId}/messages`,
        {
          method:
            "POST",

          token:
            buyerToken,

          body: {
            body:
              "5537",
          },
        }
      );

    const countAfter5537 =
      await prisma.message.count({
        where: {
          conversationId,
        },
      });

    check(
      fragment5537.status ===
        400 &&
        fragment5537.body
          ?.code ===
          "OFF_PLATFORM_ATTEMPT_BLOCKED",
      "Third fragment 5537 is also blocked."
    );

    check(
      countAfter5537 ===
        countBefore5537,
      "Blocked fragment 5537 never becomes a Message row."
    );

    /*
     * ===================================================
     * THREAD PRIVACY
     * ===================================================
     */

    const thread =
      await apiRequest(
        baseUrl,
        `/api/messages/conversations/${conversationId}`,
        {
          token:
            buyerToken,
        }
      );

    const threadText =
      JSON.stringify(
        thread.body
          ?.messages ??
          []
      );

    check(
      thread.status ===
        200 &&
        !threadText.includes(
          `"body":"080"`
        ) &&
        !threadText.includes(
          `"body":"391"`
        ) &&
        !threadText.includes(
          `"body":"5537"`
        ),
      "Thread never exposes the attempted split phone fragments."
    );

    /*
     * ===================================================
     * MODERATION HISTORY
     * ===================================================
     */

    const phoneEvents =
      await prisma.messagingModerationEvent.findMany({
        where: {
          userId:
            buyer.id,

          conversationId,

          categories: {
            has:
              "phone_number",
          },
        },

        select: {
          id:
            true,

          categories:
            true,

          action:
            true,

          strikeWeight:
            true,

          warningCode:
            true,

          createdAt:
            true,
        },

        orderBy: {
          createdAt:
            "asc",
        },
      });

    check(
      phoneEvents.length >=
        3,
      "Phone seed and continuation attempts create moderation history."
    );

    const serializedEvents =
      JSON.stringify(
        phoneEvents
      );

    check(
      !serializedEvents.includes(
        "08035535219"
      ) &&
        !serializedEvents.includes(
          "8035535219"
        ),
      "Moderation metadata does not contain raw tested phone numbers."
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
      `Phone-circumvention tests: ${passed} passed / ${failed} failed`
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
        "\nPhone-circumvention test crashed:\n",
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
          "\nPhone-circumvention cleanup failed:\n",
        cleanupError
      );

      process.exitCode =
        1;
      }

      await prisma.$disconnect();
    }
  );