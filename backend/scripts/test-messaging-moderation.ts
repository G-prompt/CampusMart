import "dotenv/config";

import {
  ConversationContextType,
  MessagingModerationAction,
  MessagingModerationCategory,
  UserRole,
  VendorAccessStatus,
} from "../src/generated/prisma/client";

import { prisma } from "../src/lib/prisma";

import {
  getConversationAccess,
  MessagingError,
  sendConversationMessage,
  startConversationWithMessage,
} from "../src/services/messaging.service";

import {
  MessagingRestrictionError,
} from "../src/services/messagingEnforcement.service";

/*
 * =======================================================
 * CAMPUSMART MESSAGING MODERATION INTEGRATION TEST
 * =======================================================
 *
 * Proves:
 *
 * 1. First-message phone numbers are redacted.
 * 2. Raw phone number never reaches Message.body.
 * 3. Redaction moderation event is linked correctly.
 * 4. Harmless numeric/time content is allowed.
 * 5. Allowed messages do not create moderation events.
 * 6. External social usernames are redacted.
 * 7. Raw external username is not stored.
 * 8. Explicit WhatsApp circumvention is blocked.
 * 9. Blocked text never creates a Message.
 * 10. Repeated attempts accumulate strike weight.
 * 11. Strike threshold activates messaging restriction.
 * 12. Restricted user cannot send another message.
 * 13. Restriction does not prevent reading.
 * 14. Outsider cannot access another user's conversation.
 * 15. Blocked first-ever message creates no empty thread.
 * 16. Blocked first-ever attempt is still audited.
 * 17. Moderation metadata does not contain raw secrets.
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
  if (
    condition
  ) {
    passed +=
      1;

    console.log(
      `PASS ${passed + failed}: ${label}`
    );

    return;
  }

  failed +=
    1;

  console.error(
    `FAIL ${passed + failed}: ${label}`
  );
}

async function expectError(
  operation: () => Promise<unknown>,
  predicate: (error: unknown) => boolean,
  label: string
) {
  try {
    await operation();

    check(
      false,
      label
    );

    return null;
  } catch (
    error
  ) {
    check(
      predicate(
        error
      ),
      label
    );

    return error;
  }
}

/*
 * =======================================================
 * TEST DATA
 * =======================================================
 */

const suffix =
  Date.now().toString(
    36
  );

const rawPhone =
  "08166166698";

const externalUsername =
  "campusmartleaktest";

let buyerId:
  string | null =
    null;

let blockedStarterId:
  string | null =
    null;

let outsiderId:
  string | null =
    null;

let vendorId:
  string | null =
    null;

let productId:
  number | null =
    null;

/*
 * =======================================================
 * CLEANUP
 * =======================================================
 */

async function cleanup() {
  const userIds =
    [
      buyerId,
      blockedStarterId,
      outsiderId,
      vendorId,
    ].filter(
      (
        value
      ): value is string =>
        Boolean(
          value
        )
    );

  if (
    userIds.length ===
    0
  ) {
    return;
  }

  /*
   * Conversation relations use Restrict for participants,
   * so remove test conversations first.
   *
   * Messages cascade with the conversation.
   *
   * Moderation events either become detached from the
   * deleted conversation or disappear when the test user
   * is deleted.
   */

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

  /*
   * Products and VendorProfile cascade from the test
   * vendor.
   *
   * Messaging moderation history cascades from its actor.
   */

  await prisma.user.deleteMany({
    where: {
      id: {
        in:
          userIds,
      },
    },
  });
}

/*
 * =======================================================
 * TEST
 * =======================================================
 */

async function main() {
  console.log(
    "\nCampusMart messaging moderation integration test\n"
  );

  /*
   * ---------------------------------------------------
   * CREATE TEST USERS
   * ---------------------------------------------------
   */

  const buyer =
    await prisma.user.create({
      data: {
        name:
          "Messaging Test Buyer",

        email:
          `messaging-buyer-${suffix}@example.com`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.client,
      },
    });

  buyerId =
    buyer.id;

  const blockedStarter =
    await prisma.user.create({
      data: {
        name:
          "Blocked Starter Buyer",

        email:
          `messaging-blocked-${suffix}@example.com`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.client,
      },
    });

  blockedStarterId =
    blockedStarter.id;

  const outsider =
    await prisma.user.create({
      data: {
        name:
          "Messaging Test Outsider",

        email:
          `messaging-outsider-${suffix}@example.com`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.client,
      },
    });

  outsiderId =
    outsider.id;

  const vendor =
    await prisma.user.create({
      data: {
        name:
          "Messaging Test Vendor",

        email:
          `messaging-vendor-${suffix}@example.com`,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.vendor,
      },
    });

  vendorId =
    vendor.id;

  await prisma.vendorProfile.create({
    data: {
      userId:
        vendor.id,

      businessName:
        "Messaging Test Store",

      businessDescription:
        "Temporary seller profile used by the messaging integration test.",

      pickupLocation:
        "Campus Test Location",

      accessStatus:
        VendorAccessStatus.active,
    },
  });

  const product =
    await prisma.product.create({
      data: {
        slug:
          `messaging-test-product-${suffix}`,

        title:
          "Messaging Test Product",

        category:
          "Test",

        price:
          15000,

        description:
          "Temporary listing used to test CampusMart messaging.",

        images:
          [],

        vendorId:
          vendor.id,
      },
    });

  productId =
    product.id;

  /*
   * ---------------------------------------------------
   * 1. FIRST MESSAGE WITH PHONE NUMBER
   * ---------------------------------------------------
   *
   * This exercises the special first-message path:
   *
   * moderation event
   * -> conversation
   * -> sanitized message
   * -> moderation event linkage
   */

  const first =
    await startConversationWithMessage({
      actorId:
        buyer.id,

      actorRole:
        buyer.role,

      contextType:
        ConversationContextType.listing,

      productId:
        product.id,

      body:
        `Hi, is this available? My number is ${rawPhone}`,
    });

  check(
    first.moderation.action ===
      "redacted",
    "Phone number in first message is classified as redacted."
  );

  check(
    !first.message.body.includes(
      rawPhone
    ) &&
      first.message.body.includes(
        "*"
      ),
    "Raw phone number is removed before Message.body is stored."
  );

  /*
   * ---------------------------------------------------
   * 2. DATABASE MUST NOT CONTAIN RAW PHONE
   * ---------------------------------------------------
   */

  const firstStoredMessage =
    await prisma.message.findUnique({
      where: {
        id:
          first.message.id,
      },
    });

  check(
    Boolean(
      firstStoredMessage
    ) &&
      !firstStoredMessage!.body.includes(
        rawPhone
      ),
    "Persisted first message contains only sanitized phone content."
  );

  /*
   * ---------------------------------------------------
   * 3. MODERATION EVENT LINKAGE
   * ---------------------------------------------------
   */

  const firstEvent =
    await prisma.messagingModerationEvent.findFirst({
      where: {
        userId:
          buyer.id,

        messageId:
          first.message.id,
      },
    });

  check(
    Boolean(
      firstEvent
    ) &&
      firstEvent!.action ===
        MessagingModerationAction.redacted &&
      firstEvent!.conversationId ===
        first.conversation.id &&
      firstEvent!.categories.includes(
        MessagingModerationCategory.phone_number
      ),
    "Phone redaction creates one linked moderation event."
  );

  /*
   * ---------------------------------------------------
   * 4. HARMLESS NUMBER/TIME CONTENT
   * ---------------------------------------------------
   *
   * This is important because CampusMart users need to
   * coordinate physical meetups.
   */

  const harmless =
    await sendConversationMessage({
      conversationId:
        first.conversation.id,

      senderId:
        buyer.id,

      body:
        "Can we meet by the library at 4:30?",
    });

  check(
    harmless.moderation.action ===
      "allow" &&
      harmless.message.body ===
        "Can we meet by the library at 4:30?",
    "Normal meetup time such as 4:30 is allowed unchanged."
  );

  const eventsAfterHarmless =
    await prisma.messagingModerationEvent.count({
      where: {
        userId:
          buyer.id,
      },
    });

  check(
    eventsAfterHarmless ===
      1,
    "Allowed message does not create a moderation strike."
  );

  /*
   * ---------------------------------------------------
   * 5. EXTERNAL USERNAME REDACTION
   * ---------------------------------------------------
   */

  const usernameAttempt =
    await sendConversationMessage({
      conversationId:
        first.conversation.id,

      senderId:
        buyer.id,

      body:
        `IG: @${externalUsername}`,
    });

  check(
    usernameAttempt.moderation.action ===
      "redacted" &&
      usernameAttempt.moderation.categories.includes(
        "external_username"
      ),
    "External social username is detected and redacted."
  );

  check(
    !usernameAttempt.message.body
      .toLowerCase()
      .includes(
        externalUsername.toLowerCase()
      ) &&
      usernameAttempt.message.body.includes(
        "*"
      ),
    "Raw social username never reaches stored message content."
  );

  /*
   * ---------------------------------------------------
   * 6. EXPLICIT CIRCUMVENTION
   * ---------------------------------------------------
   *
   * Current score before this attempt:
   *
   * phone redaction    = 1
   * username redaction = 1
   *
   * This blocked circumvention attempt adds 2.
   *
   * Total = 4
   *
   * That should activate the current 1-hour policy.
   */

  const messageCountBeforeBlocked =
    await prisma.message.count({
      where: {
        conversationId:
          first.conversation.id,
      },
    });

  const blockedError =
    await expectError(
      () =>
        sendConversationMessage({
          conversationId:
            first.conversation.id,

          senderId:
            buyer.id,

          body:
            "Let's move this conversation to WhatsApp.",
        }),

      (
        error
      ) =>
        error instanceof
          MessagingError &&
        error.code ===
          "OFF_PLATFORM_ATTEMPT_BLOCKED" &&
        error.moderationAction ===
          "blocked",

      "Explicit WhatsApp circumvention is blocked."
    );

  const messageCountAfterBlocked =
    await prisma.message.count({
      where: {
        conversationId:
          first.conversation.id,
      },
    });

  check(
    messageCountAfterBlocked ===
      messageCountBeforeBlocked,
    "Blocked circumvention creates no Message row."
  );

  /*
   * ---------------------------------------------------
   * 7. BLOCKED TEXT MUST NOT BE STORED
   * ---------------------------------------------------
   */

  const storedConversationMessages =
    await prisma.message.findMany({
      where: {
        conversationId:
          first.conversation.id,
      },

      select: {
        body:
          true,
      },
    });

  const storedBodies =
    storedConversationMessages.map(
      (
        message
      ) =>
        message.body.toLowerCase()
    );

  check(
    !storedBodies.some(
      (
        body
      ) =>
        body.includes(
          "move this conversation to whatsapp"
        )
    ),
    "Blocked WhatsApp text is absent from persistent message history."
  );

  /*
   * ---------------------------------------------------
   * 8. STRIKE ACCUMULATION
   * ---------------------------------------------------
   */

  const buyerEvents =
    await prisma.messagingModerationEvent.findMany({
      where: {
        userId:
          buyer.id,
      },

      orderBy: {
        createdAt:
          "asc",
      },
    });

  const totalStrikeWeight =
    buyerEvents.reduce(
      (
        total,
        event
      ) =>
        total +
        event.strikeWeight,
      0
    );

  check(
    buyerEvents.length ===
      3 &&
      totalStrikeWeight ===
        4,
    "Moderation history records three attempts with four total strike points."
  );

  const blockedEvent =
    buyerEvents.find(
      (
        event
      ) =>
        event.action ===
          MessagingModerationAction.blocked
    );

  check(
    Boolean(
      blockedEvent
    ) &&
      blockedEvent!.messageId ===
        null &&
      blockedEvent!.categories.includes(
        MessagingModerationCategory.circumvention
      ),
    "Blocked attempt is audited without linking to a Message row."
  );

  /*
   * ---------------------------------------------------
   * 9. RESTRICTION ACTIVATED
   * ---------------------------------------------------
   */

  const restrictedBuyer =
    await prisma.user.findUnique({
      where: {
        id:
          buyer.id,
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
      restrictedBuyer
        ?.messagingRestrictedUntil
    ) &&
      restrictedBuyer!
        .messagingRestrictedUntil!
        .getTime() >
        Date.now(),
    "Four strike points activate a future messaging restriction."
  );

  check(
    blockedError instanceof
      MessagingError &&
      Boolean(
        blockedError.restrictedUntil
      ),
    "Threshold-crossing blocked response reports the restriction expiry."
  );

  /*
   * ---------------------------------------------------
   * 10. NEXT SEND IS REJECTED BY RESTRICTION
   * ---------------------------------------------------
   */

  const eventCountBeforeRestrictedSend =
    await prisma.messagingModerationEvent.count({
      where: {
        userId:
          buyer.id,
      },
    });

  await expectError(
    () =>
      sendConversationMessage({
        conversationId:
          first.conversation.id,

        senderId:
          buyer.id,

        body:
          "This is a completely normal message.",
      }),

    (
      error
    ) =>
      error instanceof
        MessagingRestrictionError &&
      error.code ===
        "MESSAGING_TEMPORARILY_RESTRICTED" &&
      Boolean(
        error.restrictedUntil
      ),

    "Temporarily restricted user cannot send another message."
  );

  const eventCountAfterRestrictedSend =
    await prisma.messagingModerationEvent.count({
      where: {
        userId:
          buyer.id,
      },
    });

  check(
    eventCountAfterRestrictedSend ===
      eventCountBeforeRestrictedSend,
    "Rejected send during an active restriction does not create another strike."
  );

  /*
   * ---------------------------------------------------
   * 11. RESTRICTED USER CAN STILL READ
   * ---------------------------------------------------
   */

  const buyerAccess =
    await getConversationAccess(
      first.conversation.id,
      buyer.id
    );

  check(
    buyerAccess.side ===
      "buyer" &&
      buyerAccess.conversation.id ===
        first.conversation.id,
    "Messaging restriction does not prevent reading the existing conversation."
  );

  /*
   * ---------------------------------------------------
   * 12. OUTSIDER ACCESS
   * ---------------------------------------------------
   */

  await expectError(
    () =>
      getConversationAccess(
        first.conversation.id,
        outsider.id
      ),

    (
      error
    ) =>
      error instanceof
        MessagingError &&
      error.code ===
        "CONVERSATION_FORBIDDEN",

    "Unrelated user cannot access another user's conversation."
  );

  /*
   * ---------------------------------------------------
   * 13. BLOCKED FIRST-EVER MESSAGE
   * ---------------------------------------------------
   *
   * A completely separate buyer attempts to start a new
   * listing thread using circumvention language.
   *
   * The attempt should be audited, but CampusMart should
   * not create an empty conversation.
   */

  await expectError(
    () =>
      startConversationWithMessage({
        actorId:
          blockedStarter.id,

        actorRole:
          blockedStarter.role,

        contextType:
          ConversationContextType.listing,

        productId:
          product.id,

        body:
          "Let's move this chat to WhatsApp.",
      }),

    (
      error
    ) =>
      error instanceof
        MessagingError &&
      error.code ===
        "OFF_PLATFORM_ATTEMPT_BLOCKED",

    "Blocked first-ever message is rejected before a chat thread is created."
  );

  const blockedStarterConversation =
    await prisma.conversation.findFirst({
      where: {
        buyerId:
          blockedStarter.id,

        vendorId:
          vendor.id,

        productId:
          product.id,
      },
    });

  check(
    blockedStarterConversation ===
      null,
    "Blocked first-ever attempt leaves no empty Conversation row."
  );

  const blockedStarterEvent =
    await prisma.messagingModerationEvent.findFirst({
      where: {
        userId:
          blockedStarter.id,
      },
    });

  check(
    Boolean(
      blockedStarterEvent
    ) &&
      blockedStarterEvent!.action ===
        MessagingModerationAction.blocked &&
      blockedStarterEvent!.conversationId ===
        null &&
      blockedStarterEvent!.messageId ===
        null,
    "Blocked first-ever attempt is still recorded for moderation history."
  );

  /*
   * ---------------------------------------------------
   * 14. RAW SECRET PERSISTENCE CHECK
   * ---------------------------------------------------
   *
   * Search everything generated by the test that could
   * reasonably contain the sensitive values.
   */

  const allBuyerMessages =
    await prisma.message.findMany({
      where: {
        senderId:
          buyer.id,
      },

      select: {
        body:
          true,
      },
    });

  const rawValuePersisted =
    allBuyerMessages.some(
      (
        message
      ) =>
        message.body.includes(
          rawPhone
        ) ||
        message.body
          .toLowerCase()
          .includes(
            externalUsername.toLowerCase()
          )
    );

  const moderationMetadata =
    JSON.stringify(
      buyerEvents
    ).toLowerCase();

  check(
    !rawValuePersisted &&
      !moderationMetadata.includes(
        rawPhone
      ) &&
      !moderationMetadata.includes(
        externalUsername.toLowerCase()
      ),
    "Raw phone number and external username are absent from messages and moderation metadata."
  );

  /*
   * ---------------------------------------------------
   * SUMMARY
   * ---------------------------------------------------
   */

  console.log(
    "\n----------------------------------------"
  );

  console.log(
    `Messaging moderation tests: ${passed} passed / ${failed} failed`
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
        "\nMessaging moderation test crashed:\n",
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
          "\nTest cleanup failed:\n",
          cleanupError
        );

        process.exitCode =
          1;
      }

      await prisma.$disconnect();
    }
  );