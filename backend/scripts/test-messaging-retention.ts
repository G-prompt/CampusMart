import {
  ConversationContextType,
  MessagingModerationAction,
  MessagingModerationCategory,
  OrderStatus,
  UserRole,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

import {
  enforceConversationMessageLimit,
  runMessagingRetentionCleanup,
} from "../src/services/messagingRetention.service";

let passed =
  0;

let failed =
  0;

function assert(
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

const testId =
  `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;

const buyerEmail =
  `retention-buyer-${testId}@example.com`;

const vendorEmail =
  `retention-vendor-${testId}@example.com`;

const createdConversationIds:
  string[] =
  [];

const createdOrderIds:
  string[] =
  [];

async function createConversation(
  buyerId: string,
  vendorId: string,
  contextType:
    ConversationContextType,
  contextKey: string,
  orderId?:
    string | null
) {
  const conversation =
    await prisma.conversation.create({
      data: {
        buyerId,

        vendorId,

        contextType,

        contextKey,

        orderId:
          orderId ??
          null,
      },
    });

  createdConversationIds.push(
    conversation.id
  );

  return conversation;
}

async function createOrder(
  buyerId: string,
  status:
    OrderStatus,
  updatedAt:
    Date
) {
  const order =
    await prisma.order.create({
      data: {
        buyerId,

        status,

        subtotal:
          1000,

        fee:
          0,

        total:
          1000,

        createdAt:
          updatedAt,

        updatedAt,
      },
    });

  createdOrderIds.push(
    order.id
  );

  return order;
}

async function main() {
  console.log(
    "\n=== MESSAGING RETENTION TEST ===\n"
  );

  const buyer =
    await prisma.user.create({
      data: {
        name:
          "Retention Buyer",

        email:
          buyerEmail,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.client,
      },
    });

  const vendor =
    await prisma.user.create({
      data: {
        name:
          "Retention Vendor",

        email:
          vendorEmail,

        passwordHash:
          "test-password-hash",

        role:
          UserRole.vendor,
      },
    });

  /*
   * =====================================================
   * GENERAL CHAT CAP = 50
   * =====================================================
   */

  const generalConversation =
    await createConversation(
      buyer.id,
      vendor.id,
      ConversationContextType.general,
      `retention-general-${testId}`
    );

  const generalStart =
    Date.now() -
    60 * 60 * 1000;

  for (
    let index =
      0;
    index <
      55;
    index +=
      1
  ) {
    await prisma.message.create({
      data: {
        conversationId:
          generalConversation.id,

        senderId:
          index % 2 ===
          0
            ? buyer.id
            : vendor.id,

        body:
          `general-${index}`,

        createdAt:
          new Date(
            generalStart +
              index * 1000
          ),
      },
    });
  }

  const generalCapResult =
    await enforceConversationMessageLimit(
      generalConversation.id,
      ConversationContextType.general
    );

  const generalMessages =
    await prisma.message.findMany({
      where: {
        conversationId:
          generalConversation.id,
      },

      orderBy: [
        {
          createdAt:
            "asc",
        },

        {
          id:
            "asc",
        },
      ],
    });

  assert(
    generalCapResult.limit ===
      50,
    "general conversation limit is 50"
  );

  assert(
    generalMessages.length ===
      50,
    "general conversation stores only 50 messages"
  );

  assert(
    generalMessages[0]
      ?.body ===
      "general-5",
    "general conversation removes oldest overflow messages"
  );

  /*
   * =====================================================
   * ORDER CHAT CAP = 100
   * =====================================================
   */

  const activeOrder =
    await createOrder(
      buyer.id,
      OrderStatus.confirmed,
      new Date()
    );

  const orderConversation =
    await createConversation(
      buyer.id,
      vendor.id,
      ConversationContextType.order,
      `retention-order-cap-${testId}`,
      activeOrder.id
    );

  const orderStart =
    Date.now() -
    2 * 60 * 60 * 1000;

  for (
    let index =
      0;
    index <
      105;
    index +=
      1
  ) {
    await prisma.message.create({
      data: {
        conversationId:
          orderConversation.id,

        senderId:
          index % 2 ===
          0
            ? buyer.id
            : vendor.id,

        body:
          `order-${index}`,

        createdAt:
          new Date(
            orderStart +
              index * 1000
          ),
      },
    });
  }

  const orderCapResult =
    await enforceConversationMessageLimit(
      orderConversation.id,
      ConversationContextType.order
    );

  const orderMessages =
    await prisma.message.findMany({
      where: {
        conversationId:
          orderConversation.id,
      },

      orderBy: [
        {
          createdAt:
            "asc",
        },

        {
          id:
            "asc",
        },
      ],
    });

  assert(
    orderCapResult.limit ===
      100,
    "order conversation limit is 100"
  );

  assert(
    orderMessages.length ===
      100,
    "order conversation stores only 100 messages"
  );

  assert(
    orderMessages[0]
      ?.body ===
      "order-5",
    "order conversation removes oldest overflow messages"
  );

  /*
   * =====================================================
   * GENERAL/LISTING 30-DAY RETENTION
   * =====================================================
   */

  const retentionConversation =
    await createConversation(
      buyer.id,
      vendor.id,
      ConversationContextType.general,
      `retention-age-${testId}`
    );

  const oldDate =
    new Date(
      Date.now() -
        35 *
          24 *
          60 *
          60 *
          1000
    );

  const recentDate =
    new Date();

  const oldOriginal =
    await prisma.message.create({
      data: {
        conversationId:
          retentionConversation.id,

        senderId:
          buyer.id,

        body:
          "old original",

        createdAt:
          oldDate,
      },
    });

  const moderationEvent =
    await prisma.messagingModerationEvent.create({
      data: {
        userId:
          buyer.id,

        conversationId:
          retentionConversation.id,

        messageId:
          oldOriginal.id,

        contextType:
          ConversationContextType.general,

        categories: [
          MessagingModerationCategory.phone_number,
        ],

        action:
          MessagingModerationAction.redacted,

        warningCode:
          "TEST_RETENTION_EVENT",
      },
    });

  const recentReply =
    await prisma.message.create({
      data: {
        conversationId:
          retentionConversation.id,

        senderId:
          vendor.id,

        body:
          "recent reply",

        replyToMessageId:
          oldOriginal.id,

        createdAt:
          recentDate,
      },
    });

  /*
   * =====================================================
   * ACTIVE ORDER MUST RETAIN OLD MESSAGES
   * =====================================================
   */

  const activeOldOrder =
    await createOrder(
      buyer.id,
      OrderStatus.confirmed,
      oldDate
    );

  const activeOldOrderConversation =
    await createConversation(
      buyer.id,
      vendor.id,
      ConversationContextType.order,
      `active-old-order-${testId}`,
      activeOldOrder.id
    );

  const activeOldOrderMessage =
    await prisma.message.create({
      data: {
        conversationId:
          activeOldOrderConversation.id,

        senderId:
          buyer.id,

        body:
          "active old order message",

        createdAt:
          oldDate,
      },
    });

  /*
   * =====================================================
   * OLD COMPLETED ORDER CAN PURGE OLD MESSAGES
   * =====================================================
   */

  const expiredOrder =
    await createOrder(
      buyer.id,
      OrderStatus.completed,
      oldDate
    );

  const expiredOrderConversation =
    await createConversation(
      buyer.id,
      vendor.id,
      ConversationContextType.order,
      `expired-order-${testId}`,
      expiredOrder.id
    );

  const expiredOrderOldMessage =
    await prisma.message.create({
      data: {
        conversationId:
          expiredOrderConversation.id,

        senderId:
          buyer.id,

        body:
          "expired order old message",

        createdAt:
          oldDate,
      },
    });

  const expiredOrderRecentMessage =
    await prisma.message.create({
      data: {
        conversationId:
          expiredOrderConversation.id,

        senderId:
          vendor.id,

        body:
          "expired order recent message",

        createdAt:
          recentDate,
      },
    });

  /*
   * =====================================================
   * RECENTLY COMPLETED ORDER MUST NOT PURGE YET
   * =====================================================
   */

  const recentCompletedDate =
    new Date(
      Date.now() -
        10 *
          24 *
          60 *
          60 *
          1000
    );

  const recentCompletedOrder =
    await createOrder(
      buyer.id,
      OrderStatus.completed,
      recentCompletedDate
    );

  const recentCompletedConversation =
    await createConversation(
      buyer.id,
      vendor.id,
      ConversationContextType.order,
      `recent-completed-order-${testId}`,
      recentCompletedOrder.id
    );

  const recentCompletedOldMessage =
    await prisma.message.create({
      data: {
        conversationId:
          recentCompletedConversation.id,

        senderId:
          buyer.id,

        body:
          "recently completed order old message",

        createdAt:
          oldDate,
      },
    });

  /*
   * =====================================================
   * RUN RETENTION
   * =====================================================
   */

  const cleanup =
    await runMessagingRetentionCleanup();

  assert(
    cleanup.totalDeleted >=
      2,
    "retention cleanup deletes eligible old messages"
  );

  const oldOriginalAfter =
    await prisma.message.findUnique({
      where: {
        id:
          oldOriginal.id,
      },
    });

  assert(
    oldOriginalAfter ===
      null,
    "general message older than 30 days is purged"
  );

  const recentReplyAfter =
    await prisma.message.findUnique({
      where: {
        id:
          recentReply.id,
      },

      select: {
        id:
          true,

        replyToMessageId:
          true,
      },
    });

  assert(
    Boolean(
      recentReplyAfter
    ),
    "recent reply survives when old parent message is purged"
  );

  assert(
    recentReplyAfter
      ?.replyToMessageId ===
      null,
    "reply link safely becomes null when original is purged"
  );

  const moderationAfter =
    await prisma.messagingModerationEvent.findUnique({
      where: {
        id:
          moderationEvent.id,
      },

      select: {
        id:
          true,

        messageId:
          true,
      },
    });

  assert(
    Boolean(
      moderationAfter
    ),
    "moderation event survives message retention cleanup"
  );

  assert(
    moderationAfter
      ?.messageId ===
      null,
    "moderation event safely detaches from purged message"
  );

  const activeOrderMessageAfter =
    await prisma.message.findUnique({
      where: {
        id:
          activeOldOrderMessage.id,
      },
    });

  assert(
    Boolean(
      activeOrderMessageAfter
    ),
    "active order retains old messages"
  );

  const expiredOldAfter =
    await prisma.message.findUnique({
      where: {
        id:
          expiredOrderOldMessage.id,
      },
    });

  assert(
    expiredOldAfter ===
      null,
    "completed order older than retention window purges old messages"
  );

  const expiredRecentAfter =
    await prisma.message.findUnique({
      where: {
        id:
          expiredOrderRecentMessage.id,
      },
    });

  assert(
    Boolean(
      expiredRecentAfter
    ),
    "recent message survives even in an old completed order conversation"
  );

  const recentCompletedOldAfter =
    await prisma.message.findUnique({
      where: {
        id:
          recentCompletedOldMessage.id,
      },
    });

  assert(
    Boolean(
      recentCompletedOldAfter
    ),
    "recently completed order is protected until 30-day post-order window passes"
  );

  console.log(
    `\n${passed} passed / ${failed} failed\n`
  );

  if (
    failed >
    0
  ) {
    process.exitCode =
      1;
  }
}

async function cleanup() {
  try {
    if (
      createdConversationIds.length >
      0
    ) {
      await prisma.messagingModerationEvent.deleteMany({
        where: {
          conversationId: {
            in:
              createdConversationIds,
          },
        },
      });

      await prisma.conversation.deleteMany({
        where: {
          id: {
            in:
              createdConversationIds,
          },
        },
      });
    }

    if (
      createdOrderIds.length >
      0
    ) {
      await prisma.order.deleteMany({
        where: {
          id: {
            in:
              createdOrderIds,
          },
        },
      });
    }

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            buyerEmail,
            vendorEmail,
          ],
        },
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Retention test cleanup failed:",
      error
    );
  }
}

main()
  .catch(
    (
      error
    ) => {
      console.error(
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await cleanup();

      await prisma.$disconnect();
    }
  );