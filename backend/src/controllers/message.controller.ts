import type {
  Response,
} from "express";

import {
  ConversationContextType,
  Prisma,
  UserRole,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

import {
  getConversationAccess,
  markConversationDelivered,
  markConversationRead,
  MessagingError,
  sendConversationMessage,
  startConversationWithMessage,
} from "../services/messaging.service";

import {
  MessagingRestrictionError,
} from "../services/messagingEnforcement.service";

import {
  enforceConversationMessageLimit,
  startMessagingRetentionWorker,
} from "../services/messagingRetention.service";

/*
 * =======================================================
 * CAMPUSMART MESSAGING CONTROLLER
 * =======================================================
 *
 * Responsibilities:
 *
 * - Inbox
 * - Unread counts
 * - Thread history
 * - Start conversation
 * - Send message
 * - Reply to message
 * - Mark delivered
 * - Mark read
 *
 * Storage policy is handled by
 * messagingRetention.service.ts.
 */

/*
 * Start the lightweight hourly retention worker whenever
 * the messaging controller is loaded by the application.
 *
 * The timer is unref()'d, so it does not keep tests or
 * shutdown processes alive.
 */

startMessagingRetentionWorker();

/*
 * =======================================================
 * CONSTANTS
 * =======================================================
 */

const MESSAGE_PAGE_SIZE =
  100;

const INBOX_PAGE_SIZE =
  100;

/*
 * =======================================================
 * TYPES
 * =======================================================
 */

type ConversationReadState = {
  id: string;

  buyerId: string;

  buyerLastReadAt:
    Date | null;

  vendorLastReadAt:
    Date | null;
};

/*
 * =======================================================
 * AUTH HELPER
 * =======================================================
 */

function requireControllerUser(
  req: AuthenticatedRequest,
  res: Response
) {
  if (
    !req.user
  ) {
    res.status(401).json({
      success:
        false,

      message:
        "Authentication required.",

      code:
        "AUTH_REQUIRED",
    });

    return null;
  }

  return req.user;
}

/*
 * =======================================================
 * ERROR RESPONSE
 * =======================================================
 */

function sendMessagingError(
  res: Response,
  error: unknown
) {
  if (
    error instanceof
    MessagingRestrictionError
  ) {
    return res
      .status(
        error.statusCode
      )
      .json({
        success:
          false,

        message:
          error.message,

        code:
          error.code,

        restrictedUntil:
          error.restrictedUntil,
      });
  }

  if (
    error instanceof
    MessagingError
  ) {
    return res
      .status(
        error.statusCode
      )
      .json({
        success:
          false,

        message:
          error.message,

        code:
          error.code,

        moderation:
          error.moderationAction
            ? {
                action:
                  error.moderationAction,

                categories:
                  error.moderationCategories ??
                  [],

                restrictedUntil:
                  error.restrictedUntil ??
                  null,

                requiresReview:
                  error.requiresReview ??
                  false,
              }
            : undefined,
      });
  }

  console.error(
    "Messaging controller error:",
    error
  );

  return res
    .status(500)
    .json({
      success:
        false,

      message:
        "Something went wrong while processing the messaging request.",

      code:
        "MESSAGING_INTERNAL_ERROR",
    });
}

/*
 * =======================================================
 * SAFE PARTICIPANT RESPONSE
 * =======================================================
 */

function participantResponse(
  user: {
    id: string;

    name: string;

    role: UserRole;

    university:
      | {
          id: string;

          name: string;

          shortName: string;
        }
      | null;

    vendorProfile:
      | {
          businessName: string;
        }
      | null;
  }
) {
  return {
    id:
      user.id,

    name:
      user.name,

    role:
      user.role,

    university:
      user.university
        ? {
            id:
              user.university.id,

            name:
              user.university.name,

            shortName:
              user.university.shortName,
          }
        : null,

    businessName:
      user.vendorProfile
        ?.businessName ??
      null,
  };
}

/*
 * =======================================================
 * CONTEXT TYPE PARSING
 * =======================================================
 */

function parseContextType(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    throw new MessagingError(
      "Conversation type is required.",
      400,
      "CONVERSATION_TYPE_REQUIRED"
    );
  }

  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    normalized ===
    ConversationContextType.general
  ) {
    return ConversationContextType.general;
  }

  if (
    normalized ===
    ConversationContextType.listing
  ) {
    return ConversationContextType.listing;
  }

  if (
    normalized ===
    ConversationContextType.order
  ) {
    return ConversationContextType.order;
  }

  throw new MessagingError(
    "Conversation type must be general, listing, or order.",
    400,
    "INVALID_CONVERSATION_TYPE"
  );
}

/*
 * =======================================================
 * PRODUCT ID PARSING
 * =======================================================
 */

function parseOptionalProductId(
  value: unknown
) {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ""
  ) {
    return null;
  }

  const productId =
    Number(
      value
    );

  if (
    !Number.isInteger(
      productId
    ) ||
    productId <=
      0
  ) {
    throw new MessagingError(
      "A valid listing ID is required.",
      400,
      "INVALID_LISTING_ID"
    );
  }

  return productId;
}

/*
 * =======================================================
 * OPTIONAL RECEIPT MESSAGE ID
 * =======================================================
 */

function parseOptionalReceiptMessageId(
  value: unknown
) {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ""
  ) {
    return null;
  }

  if (
    typeof value !==
    "string"
  ) {
    throw new MessagingError(
      "Receipt message ID must be a string.",
      400,
      "INVALID_RECEIPT_MESSAGE_ID"
    );
  }

  const messageId =
    value.trim();

  if (
    !messageId
  ) {
    return null;
  }

  return messageId;
}

/*
 * =======================================================
 * BATCHED UNREAD COUNTS
 * =======================================================
 *
 * Old implementation:
 *
 *   one message.count() per conversation
 *
 * This implementation:
 *
 *   one grouped message query for the entire supplied
 *   conversation set.
 *
 * That removes the inbox/navbar N+1 query pattern.
 */

async function getUnreadCountMap(
  userId: string,
  conversations:
    ConversationReadState[]
) {
  const unreadMap =
    new Map<
      string,
      number
    >();

  if (
    conversations.length ===
    0
  ) {
    return unreadMap;
  }

  const unreadFilters:
    Prisma.MessageWhereInput[] =
    conversations.map(
      (
        conversation
      ) => {
        const lastReadAt =
          conversation.buyerId ===
          userId
            ? conversation
                .buyerLastReadAt
            : conversation
                .vendorLastReadAt;

        return {
          conversationId:
            conversation.id,

          senderId: {
            not:
              userId,
          },

          deletedAt:
            null,

          ...(lastReadAt
            ? {
                createdAt: {
                  gt:
                    lastReadAt,
                },
              }
            : {}),
        };
      }
    );

  const grouped =
    await prisma.message.groupBy({
      by: [
        "conversationId",
      ],

      where: {
        OR:
          unreadFilters,
      },

      _count: {
        _all:
          true,
      },
    });

  for (
    const row
    of grouped
  ) {
    unreadMap.set(
      row.conversationId,
      row._count._all
    );
  }

  return unreadMap;
}

/*
 * =======================================================
 * SAFE MESSAGE-CAP ENFORCEMENT
 * =======================================================
 *
 * Message creation has already succeeded at this point.
 *
 * A cleanup failure must therefore never turn a
 * successfully-sent message into a fake HTTP failure.
 *
 * The next send can self-heal the cap, and the failure is
 * logged for investigation.
 */

async function safelyEnforceConversationMessageLimit(
  conversationId: string,
  contextType?:
    ConversationContextType
) {
  try {
    await enforceConversationMessageLimit(
      conversationId,
      contextType
    );
  } catch (
    error
  ) {
    console.error(
      "Failed to enforce conversation message limit:",
      error
    );
  }
}

/*
 * =======================================================
 * GET INBOX
 * =======================================================
 */

export async function getMessagingInbox(
  req: AuthenticatedRequest,
  res: Response
) {
  const user =
    requireControllerUser(
      req,
      res
    );

  if (
    !user
  ) {
    return;
  }

  try {
    const participantWhere = {
      OR: [
        {
          buyerId:
            user.id,
        },

        {
          vendorId:
            user.id,
        },
      ],

      /*
       * Once retention cleanup removes every visible
       * message, don't leave an empty dead conversation
       * sitting in the inbox.
       */

      messages: {
        some: {
          deletedAt:
            null,
        },
      },
    };

    /*
     * Fetch the visible inbox and the complete read-state
     * set in parallel.
     *
     * The complete set allows totalUnread to remain
     * correct even if the user has more than 100
     * conversations.
     */

    const [
      conversations,
      allReadStates,
    ] =
      await Promise.all([
        prisma.conversation.findMany({
          where:
            participantWhere,

          orderBy: [
            {
              lastMessageAt:
                "desc",
            },

            {
              id:
                "desc",
            },
          ],

          take:
            INBOX_PAGE_SIZE,

          select: {
            id:
              true,

            buyerId:
              true,

            vendorId:
              true,

            contextType:
              true,

            contextKey:
              true,

            productId:
              true,

            orderId:
              true,

            buyerLastDeliveredAt:
              true,

            vendorLastDeliveredAt:
              true,

            buyerLastReadAt:
              true,

            vendorLastReadAt:
              true,

            lastMessageAt:
              true,

            createdAt:
              true,

            updatedAt:
              true,

            buyer: {
              select: {
                id:
                  true,

                name:
                  true,

                role:
                  true,

                university: {
                  select: {
                    id:
                      true,

                    name:
                      true,

                    shortName:
                      true,
                  },
                },

                vendorProfile: {
                  select: {
                    businessName:
                      true,
                  },
                },
              },
            },

            vendor: {
              select: {
                id:
                  true,

                name:
                  true,

                role:
                  true,

                university: {
                  select: {
                    id:
                      true,

                    name:
                      true,

                    shortName:
                      true,
                  },
                },

                vendorProfile: {
                  select: {
                    businessName:
                      true,
                  },
                },
              },
            },

            product: {
              select: {
                id:
                  true,

                slug:
                  true,

                title:
                  true,

                images:
                  true,

                price:
                  true,

                isArchived:
                  true,
              },
            },

            order: {
              select: {
                id:
                  true,

                status:
                  true,

                paymentStatus:
                  true,

                createdAt:
                  true,
              },
            },

            messages: {
              where: {
                deletedAt:
                  null,
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

              take:
                1,

              select: {
                id:
                  true,

                senderId:
                  true,

                body:
                  true,

                createdAt:
                  true,

                editedAt:
                  true,
              },
            },
          },
        }),

        prisma.conversation.findMany({
          where:
            participantWhere,

          select: {
            id:
              true,

            buyerId:
              true,

            buyerLastReadAt:
              true,

            vendorLastReadAt:
              true,
          },
        }),
      ]);

    const unreadMap =
      await getUnreadCountMap(
        user.id,
        allReadStates
      );

    const inbox =
      conversations.map(
        (
          conversation
        ) => {
          const side =
            conversation.buyerId ===
            user.id
              ? "buyer"
              : "vendor";

          const otherParty =
            side ===
            "buyer"
              ? conversation.vendor
              : conversation.buyer;

          const latestMessage =
            conversation.messages[
              0
            ] ??
            null;

          return {
            id:
              conversation.id,

            side,

            contextType:
              conversation.contextType,

            product:
              conversation.product
                ? {
                    id:
                      conversation
                        .product
                        .id,

                    slug:
                      conversation
                        .product
                        .slug,

                    title:
                      conversation
                        .product
                        .title,

                    image:
                      conversation
                        .product
                        .images[
                        0
                      ] ??
                      null,

                    price:
                      conversation
                        .product
                        .price,

                    isArchived:
                      conversation
                        .product
                        .isArchived,
                  }
                : null,

            order:
              conversation.order
                ? {
                    id:
                      conversation
                        .order
                        .id,

                    status:
                      conversation
                        .order
                        .status,

                    paymentStatus:
                      conversation
                        .order
                        .paymentStatus,

                    createdAt:
                      conversation
                        .order
                        .createdAt,
                  }
                : null,

            otherParty:
              participantResponse(
                otherParty
              ),

            latestMessage:
              latestMessage
                ? {
                    id:
                      latestMessage.id,

                    senderId:
                      latestMessage.senderId,

                    body:
                      latestMessage.body,

                    createdAt:
                      latestMessage.createdAt,

                    editedAt:
                      latestMessage.editedAt,
                  }
                : null,

            unreadCount:
              unreadMap.get(
                conversation.id
              ) ??
              0,

            buyerLastDeliveredAt:
              conversation
                .buyerLastDeliveredAt,

            vendorLastDeliveredAt:
              conversation
                .vendorLastDeliveredAt,

            buyerLastReadAt:
              conversation
                .buyerLastReadAt,

            vendorLastReadAt:
              conversation
                .vendorLastReadAt,

            lastMessageAt:
              conversation.lastMessageAt,

            createdAt:
              conversation.createdAt,

            updatedAt:
              conversation.updatedAt,
          };
        }
      );

    const totalUnread =
      Array.from(
        unreadMap.values()
      ).reduce(
        (
          total,
          count
        ) =>
          total +
          count,
        0
      );

    return res.json({
      success:
        true,

      totalUnread,

      conversations:
        inbox,
    });
  } catch (
    error
  ) {
    return sendMessagingError(
      res,
      error
    );
  }
}

/*
 * =======================================================
 * GET TOTAL UNREAD COUNT
 * =======================================================
 */

export async function getMessagingUnreadCount(
  req: AuthenticatedRequest,
  res: Response
) {
  const user =
    requireControllerUser(
      req,
      res
    );

  if (
    !user
  ) {
    return;
  }

  try {
    const conversations =
      await prisma.conversation.findMany({
        where: {
          OR: [
            {
              buyerId:
                user.id,
            },

            {
              vendorId:
                user.id,
            },
          ],

          messages: {
            some: {
              deletedAt:
                null,
            },
          },
        },

        select: {
          id:
            true,

          buyerId:
            true,

          buyerLastReadAt:
            true,

          vendorLastReadAt:
            true,
        },
      });

    const unreadMap =
      await getUnreadCountMap(
        user.id,
        conversations
      );

    const unreadCount =
      Array.from(
        unreadMap.values()
      ).reduce(
        (
          total,
          count
        ) =>
          total +
          count,
        0
      );

    return res.json({
      success:
        true,

      unreadCount,
    });
  } catch (
    error
  ) {
    return sendMessagingError(
      res,
      error
    );
  }
}

/*
 * =======================================================
 * GET ONE CONVERSATION
 * =======================================================
 */

export async function getMessagingConversation(
  req: AuthenticatedRequest,
  res: Response
) {
  const user =
    requireControllerUser(
      req,
      res
    );

  if (
    !user
  ) {
    return;
  }

  try {
    const conversationId =
      String(
        req.params
          .conversationId ??
          ""
      ).trim();

    const {
      conversation:
        accessConversation,
      side,
    } =
      await getConversationAccess(
        conversationId,
        user.id
      );

    /*
     * This also cleans up any legacy thread which existed
     * before the 50/100 cap was introduced.
     */

    await safelyEnforceConversationMessageLimit(
      accessConversation.id,
      accessConversation.contextType
    );

    const conversation =
      await prisma.conversation.findUnique({
        where: {
          id:
            conversationId,
        },

        select: {
          id:
            true,

          buyerId:
            true,

          vendorId:
            true,

          contextType:
            true,

          productId:
            true,

          orderId:
            true,

          buyerLastDeliveredAt:
            true,

          vendorLastDeliveredAt:
            true,

          buyerLastReadAt:
            true,

          vendorLastReadAt:
            true,

          lastMessageAt:
            true,

          createdAt:
            true,

          updatedAt:
            true,

          buyer: {
            select: {
              id:
                true,

              name:
                true,

              role:
                true,

              university: {
                select: {
                  id:
                    true,

                  name:
                    true,

                  shortName:
                    true,
                },
              },

              vendorProfile: {
                select: {
                  businessName:
                    true,
                },
              },
            },
          },

          vendor: {
            select: {
              id:
                true,

              name:
                true,

              role:
                true,

              university: {
                select: {
                  id:
                    true,

                  name:
                    true,

                  shortName:
                    true,
                },
              },

              vendorProfile: {
                select: {
                  businessName:
                    true,
                },
              },
            },
          },

          product: {
            select: {
              id:
                true,

              slug:
                true,

              title:
                true,

              description:
                true,

              images:
                true,

              price:
                true,

              isArchived:
                true,
            },
          },

          order: {
            select: {
              id:
                true,

              status:
                true,

              paymentStatus:
                true,

              total:
                true,

              createdAt:
                true,

              updatedAt:
                true,
            },
          },

          messages: {
            where: {
              deletedAt:
                null,
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

            take:
              MESSAGE_PAGE_SIZE,

            select: {
              id:
                true,

              senderId:
                true,

              body:
                true,

              replyToMessageId:
                true,

              replyToMessage: {
                select: {
                  id:
                    true,

                  senderId:
                    true,

                  body:
                    true,

                  deletedAt:
                    true,

                  createdAt:
                    true,
                },
              },

              editedAt:
                true,

              deletedAt:
                true,

              createdAt:
                true,

              sender: {
                select: {
                  id:
                    true,

                  name:
                    true,

                  role:
                    true,

                  vendorProfile: {
                    select: {
                      businessName:
                        true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (
      !conversation
    ) {
      throw new MessagingError(
        "Conversation not found.",
        404,
        "CONVERSATION_NOT_FOUND"
      );
    }

    const messages =
      [
        ...conversation.messages,
      ]
        .reverse()
        .map(
          (
            message
          ) => ({
            id:
              message.id,

            senderId:
              message.senderId,

            body:
              message.body,

            replyToMessageId:
              message
                .replyToMessageId,

            replyToMessage:
              message.replyToMessage
                ? {
                    id:
                      message
                        .replyToMessage
                        .id,

                    senderId:
                      message
                        .replyToMessage
                        .senderId,

                    body:
                      message
                        .replyToMessage
                        .deletedAt
                        ? null
                        : message
                            .replyToMessage
                            .body,

                    deletedAt:
                      message
                        .replyToMessage
                        .deletedAt,

                    createdAt:
                      message
                        .replyToMessage
                        .createdAt,
                  }
                : null,

            editedAt:
              message.editedAt,

            deletedAt:
              message.deletedAt,

            createdAt:
              message.createdAt,

            isMine:
              message.senderId ===
              user.id,

            sender: {
              id:
                message.sender.id,

              name:
                message.sender.name,

              role:
                message.sender.role,

              businessName:
                message.sender
                  .vendorProfile
                  ?.businessName ??
                null,
            },
          })
        );

    const otherParty =
      side ===
      "buyer"
        ? conversation.vendor
        : conversation.buyer;

    const lastReadAt =
      side ===
      "buyer"
        ? conversation
            .buyerLastReadAt
        : conversation
            .vendorLastReadAt;

    const unreadCount =
      await prisma.message.count({
        where: {
          conversationId:
            conversation.id,

          senderId: {
            not:
              user.id,
          },

          deletedAt:
            null,

          ...(lastReadAt
            ? {
                createdAt: {
                  gt:
                    lastReadAt,
                },
              }
            : {}),
        },
      });

    return res.json({
      success:
        true,

      conversation: {
        id:
          conversation.id,

        side,

        contextType:
          conversation.contextType,

        otherParty:
          participantResponse(
            otherParty
          ),

        product:
          conversation.product
            ? {
                id:
                  conversation
                    .product
                    .id,

                slug:
                  conversation
                    .product
                    .slug,

                title:
                  conversation
                    .product
                    .title,

                image:
                  conversation
                    .product
                    .images[
                    0
                  ] ??
                  null,

                images:
                  conversation
                    .product
                    .images,

                description:
                  conversation
                    .product
                    .description,

                price:
                  conversation
                    .product
                    .price,

                isArchived:
                  conversation
                    .product
                    .isArchived,
              }
            : null,

        order:
          conversation.order
            ? {
                id:
                  conversation
                    .order
                    .id,

                status:
                  conversation
                    .order
                    .status,

                paymentStatus:
                  conversation
                    .order
                    .paymentStatus,

                total:
                  conversation
                    .order
                    .total,

                createdAt:
                  conversation
                    .order
                    .createdAt,

                updatedAt:
                  conversation
                    .order
                    .updatedAt,
              }
            : null,

        unreadCount,

        buyerLastDeliveredAt:
          conversation
            .buyerLastDeliveredAt,

        vendorLastDeliveredAt:
          conversation
            .vendorLastDeliveredAt,

        buyerLastReadAt:
          conversation
            .buyerLastReadAt,

        vendorLastReadAt:
          conversation
            .vendorLastReadAt,

        lastMessageAt:
          conversation.lastMessageAt,

        createdAt:
          conversation.createdAt,

        updatedAt:
          conversation.updatedAt,
      },

      messages,
    });
  } catch (
    error
  ) {
    return sendMessagingError(
      res,
      error
    );
  }
}

/*
 * =======================================================
 * START CONVERSATION
 * =======================================================
 */

export async function startMessagingConversation(
  req: AuthenticatedRequest,
  res: Response
) {
  const user =
    requireControllerUser(
      req,
      res
    );

  if (
    !user
  ) {
    return;
  }

  try {
    const contextType =
      parseContextType(
        req.body
          ?.contextType
      );

    const productId =
      parseOptionalProductId(
        req.body
          ?.productId
      );

    const vendorId =
      typeof req.body
        ?.vendorId ===
      "string"
        ? req.body.vendorId.trim()
        : null;

    const orderId =
      typeof req.body
        ?.orderId ===
      "string"
        ? req.body.orderId.trim()
        : null;

    const result =
      await startConversationWithMessage({
        actorId:
          user.id,

        actorRole:
          user.role as UserRole,

        contextType,

        vendorId,

        productId,

        orderId,

        body:
          req.body?.body,
      });

    /*
     * Immediately enforce 50/100 storage limits.
     */

    await safelyEnforceConversationMessageLimit(
      result.conversation.id,
      result.conversation.contextType
    );

    return res
      .status(201)
      .json({
        success:
          true,

        message:
          result.moderation
            .action ===
            "redacted"
              ? "Message sent. Contact details were hidden to keep communication on CampusMart."
              : "Message sent.",

        conversation:
          result.conversation,

        sentMessage:
          result.message,

        moderation:
          result.moderation,
      });
  } catch (
    error
  ) {
    return sendMessagingError(
      res,
      error
    );
  }
}

/*
 * =======================================================
 * SEND MESSAGE / REPLY
 * =======================================================
 */

export async function sendMessagingMessage(
  req: AuthenticatedRequest,
  res: Response
) {
  const user =
    requireControllerUser(
      req,
      res
    );

  if (
    !user
  ) {
    return;
  }

  try {
    const conversationId =
      String(
        req.params
          .conversationId ??
          ""
      ).trim();

    if (
      !conversationId
    ) {
      throw new MessagingError(
        "Conversation ID is required.",
        400,
        "CONVERSATION_ID_REQUIRED"
      );
    }

    const result =
      await sendConversationMessage({
        conversationId,

        senderId:
          user.id,

        body:
          req.body?.body,

        replyToMessageId:
          req.body
            ?.replyToMessageId,
      });

    /*
     * Context type is resolved internally here because
     * sendConversationMessage intentionally keeps its
     * existing response contract unchanged.
     */

    await safelyEnforceConversationMessageLimit(
      result.conversationId
    );

    return res
      .status(201)
      .json({
        success:
          true,

        message:
          result.moderation
            .action ===
            "redacted"
              ? "Message sent. Contact details were hidden to keep communication on CampusMart."
              : "Message sent.",

        conversationId:
          result.conversationId,

        sentMessage:
          result.message,

        moderation:
          result.moderation,
      });
  } catch (
    error
  ) {
    return sendMessagingError(
      res,
      error
    );
  }
}

/*
 * =======================================================
 * MARK DELIVERED
 * =======================================================
 */

export async function markMessagingConversationDelivered(
  req: AuthenticatedRequest,
  res: Response
) {
  const user =
    requireControllerUser(
      req,
      res
    );

  if (
    !user
  ) {
    return;
  }

  try {
    const conversationId =
      String(
        req.params
          .conversationId ??
          ""
      ).trim();

    if (
      !conversationId
    ) {
      throw new MessagingError(
        "Conversation ID is required.",
        400,
        "CONVERSATION_ID_REQUIRED"
      );
    }

    const messageId =
      parseOptionalReceiptMessageId(
        req.body
          ?.messageId
      );

    const result =
      await markConversationDelivered(
        conversationId,
        user.id,
        messageId
      );

    return res.json({
      success:
        true,

      conversationId:
        result.conversationId,

      deliveredAt:
        result.deliveredAt,

      deliveredThroughMessageId:
        result.deliveredThroughMessageId,
    });
  } catch (
    error
  ) {
    return sendMessagingError(
      res,
      error
    );
  }
}

/*
 * =======================================================
 * MARK READ
 * =======================================================
 */

export async function markMessagingConversationRead(
  req: AuthenticatedRequest,
  res: Response
) {
  const user =
    requireControllerUser(
      req,
      res
    );

  if (
    !user
  ) {
    return;
  }

  try {
    const conversationId =
      String(
        req.params
          .conversationId ??
          ""
      ).trim();

    if (
      !conversationId
    ) {
      throw new MessagingError(
        "Conversation ID is required.",
        400,
        "CONVERSATION_ID_REQUIRED"
      );
    }

    const messageId =
      parseOptionalReceiptMessageId(
        req.body
          ?.messageId
      );

    const result =
      await markConversationRead(
        conversationId,
        user.id,
        messageId
      );

    return res.json({
      success:
        true,

      conversationId:
        result.conversationId,

      deliveredAt:
        result.deliveredAt,

      readAt:
        result.readAt,

      readThroughMessageId:
        result.readThroughMessageId,
    });
  } catch (
    error
  ) {
    return sendMessagingError(
      res,
      error
    );
  }
}