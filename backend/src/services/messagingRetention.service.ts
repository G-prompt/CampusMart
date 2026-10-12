import {
  ConversationContextType,
  OrderStatus,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

/*
 * =======================================================
 * CAMPUSMART MESSAGING STORAGE POLICY
 * =======================================================
 *
 * CampusMart messaging exists to support marketplace
 * transactions. It is not intended to become permanent
 * social-media-style message storage.
 *
 * Policy:
 *
 * - general/listing conversations:
 *     maximum 50 stored messages
 *
 * - order conversations:
 *     maximum 100 stored messages
 *
 * - general/listing messages:
 *     physically purged after 30 days
 *
 * - order messages:
 *     preserved while the order is active
 *
 *     once the order has been completed/cancelled for
 *     at least 30 days, messages older than 30 days may
 *     be physically purged
 *
 * Physical message deletion is safe because:
 *
 * - Message.replyToMessage uses onDelete: SetNull
 * - MessagingModerationEvent.message uses onDelete: SetNull
 *
 * Therefore:
 *
 * - newer replies survive
 * - moderation history survives
 * - forbidden raw values are not reintroduced
 */

export const PRE_PURCHASE_MESSAGE_LIMIT =
  50;

export const ORDER_MESSAGE_LIMIT =
  100;

export const MESSAGE_RETENTION_DAYS =
  30;

const RETENTION_WORKER_INTERVAL_MS =
  60 * 60 * 1000;

let retentionWorker:
  NodeJS.Timeout | null =
  null;

let cleanupRunning =
  false;

/*
 * =======================================================
 * RETENTION CUTOFF
 * =======================================================
 */

export function getMessagingRetentionCutoff(
  now =
    new Date()
) {
  return new Date(
    now.getTime() -
      MESSAGE_RETENTION_DAYS *
        24 *
        60 *
        60 *
        1000
  );
}

/*
 * =======================================================
 * MESSAGE LIMIT
 * =======================================================
 */

export function getConversationMessageLimit(
  contextType:
    ConversationContextType
) {
  return contextType ===
    ConversationContextType.order
    ? ORDER_MESSAGE_LIMIT
    : PRE_PURCHASE_MESSAGE_LIMIT;
}

/*
 * =======================================================
 * ENFORCE ONE CONVERSATION LIMIT
 * =======================================================
 */

export async function enforceConversationMessageLimit(
  conversationId: string,
  knownContextType?:
    ConversationContextType
) {
  const cleanConversationId =
    String(
      conversationId ??
        ""
    ).trim();

  if (
    !cleanConversationId
  ) {
    throw new Error(
      "Conversation ID is required to enforce the message limit."
    );
  }

  let contextType =
    knownContextType;

  if (
    !contextType
  ) {
    const conversation =
      await prisma.conversation.findUnique({
        where: {
          id:
            cleanConversationId,
        },

        select: {
          contextType:
            true,
        },
      });

    if (
      !conversation
    ) {
      return {
        conversationId:
          cleanConversationId,

        limit:
          null,

        deletedCount:
          0,
      };
    }

    contextType =
      conversation.contextType;
  }

  const limit =
    getConversationMessageLimit(
      contextType
    );

  /*
   * Keep the newest N messages.
   *
   * Anything after the limit is overflow and can be
   * physically removed.
   *
   * createdAt + id gives us deterministic ordering.
   */

  const overflowMessages =
    await prisma.message.findMany({
      where: {
        conversationId:
          cleanConversationId,
      },

      orderBy: [
        {
          createdAt:
            "desc",
        },

        {
          id:
            "desc",
        },
      ],

      skip:
        limit,

      select: {
        id:
          true,
      },
    });

  if (
    overflowMessages.length ===
    0
  ) {
    return {
      conversationId:
        cleanConversationId,

      limit,

      deletedCount:
        0,
    };
  }

  const deleted =
    await prisma.message.deleteMany({
      where: {
        id: {
          in:
            overflowMessages.map(
              (
                message
              ) =>
                message.id
            ),
        },
      },
    });

  return {
    conversationId:
      cleanConversationId,

    limit,

    deletedCount:
      deleted.count,
  };
}

/*
 * =======================================================
 * ENFORCE LIMITS ACROSS EXISTING CONVERSATIONS
 * =======================================================
 *
 * This is primarily for:
 *
 * - deployment/backfill
 * - development maintenance
 * - repairing legacy conversations created before the
 *   storage caps existed
 *
 * Normal new messages are capped immediately by the
 * messaging controller.
 */

export async function enforceAllConversationMessageLimits() {
  const conversations =
    await prisma.conversation.findMany({
      select: {
        id:
          true,

        contextType:
          true,
      },

      orderBy: {
        createdAt:
          "asc",
      },
    });

  let deletedCount =
    0;

  for (
    const conversation
    of conversations
  ) {
    const result =
      await enforceConversationMessageLimit(
        conversation.id,
        conversation.contextType
      );

    deletedCount +=
      result.deletedCount;
  }

  return {
    conversationsChecked:
      conversations.length,

    deletedCount,
  };
}

/*
 * =======================================================
 * 30-DAY RETENTION CLEANUP
 * =======================================================
 */

export async function runMessagingRetentionCleanup(
  now =
    new Date()
) {
  /*
   * Prevent two intervals in the same Node process from
   * overlapping if a cleanup takes longer than expected.
   */

  if (
    cleanupRunning
  ) {
    return {
      skipped:
        true,

      generalAndListingDeleted:
        0,

      orderDeleted:
        0,

      totalDeleted:
        0,
    };
  }

  cleanupRunning =
    true;

  try {
    const cutoff =
      getMessagingRetentionCutoff(
        now
      );

    /*
     * ---------------------------------------------------
     * GENERAL + LISTING
     * ---------------------------------------------------
     */

    const prePurchaseConversations =
      await prisma.conversation.findMany({
        where: {
          contextType: {
            in: [
              ConversationContextType.general,
              ConversationContextType.listing,
            ],
          },
        },

        select: {
          id:
            true,
        },
      });

    const prePurchaseIds =
      prePurchaseConversations.map(
        (
          conversation
        ) =>
          conversation.id
      );

    let generalAndListingDeleted =
      0;

    if (
      prePurchaseIds.length >
      0
    ) {
      const deleted =
        await prisma.message.deleteMany({
          where: {
            conversationId: {
              in:
                prePurchaseIds,
            },

            createdAt: {
              lt:
                cutoff,
            },
          },
        });

      generalAndListingDeleted =
        deleted.count;
    }

    /*
     * ---------------------------------------------------
     * ORDER CONVERSATIONS
     * ---------------------------------------------------
     *
     * Do NOT age-purge active transactions.
     *
     * Only conversations whose associated order has been
     * completed/cancelled for at least 30 days become
     * eligible for retention cleanup.
     */

    const expiredOrderConversations =
      await prisma.conversation.findMany({
        where: {
          contextType:
            ConversationContextType.order,

          order: {
            is: {
              status: {
                in: [
                  OrderStatus.completed,
                  OrderStatus.cancelled,
                ],
              },

              updatedAt: {
                lt:
                  cutoff,
              },
            },
          },
        },

        select: {
          id:
            true,
        },
      });

    const expiredOrderConversationIds =
      expiredOrderConversations.map(
        (
          conversation
        ) =>
          conversation.id
      );

    let orderDeleted =
      0;

    if (
      expiredOrderConversationIds.length >
      0
    ) {
      const deleted =
        await prisma.message.deleteMany({
          where: {
            conversationId: {
              in:
                expiredOrderConversationIds,
            },

            /*
             * Even after an order becomes retention-
             * eligible, a newly-created message should
             * not disappear instantly.
             *
             * Each stored message still receives the
             * normal 30-day age window.
             */

            createdAt: {
              lt:
                cutoff,
            },
          },
        });

      orderDeleted =
        deleted.count;
    }

    return {
      skipped:
        false,

      generalAndListingDeleted,

      orderDeleted,

      totalDeleted:
        generalAndListingDeleted +
        orderDeleted,
    };
  } finally {
    cleanupRunning =
      false;
  }
}

/*
 * =======================================================
 * BACKGROUND WORKER
 * =======================================================
 */

export function startMessagingRetentionWorker() {
  if (
    retentionWorker
  ) {
    return;
  }

  retentionWorker =
    setInterval(
      () => {
        void runMessagingRetentionCleanup()
          .catch(
            (
              error
            ) => {
              console.error(
                "Messaging retention cleanup failed:",
                error
              );
            }
          );
      },
      RETENTION_WORKER_INTERVAL_MS
    );

  /*
   * The cleanup timer must never be the reason a Node
   * process/test refuses to exit.
   */

  retentionWorker.unref();
}

/*
 * Primarily useful for tests or controlled shutdown.
 */

export function stopMessagingRetentionWorker() {
  if (
    !retentionWorker
  ) {
    return;
  }

  clearInterval(
    retentionWorker
  );

  retentionWorker =
    null;
}