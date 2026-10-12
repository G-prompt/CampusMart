import type { Response } from "express";

import {
  ConversationContextType,
  UserRole,
} from "../generated/prisma/client";

import { prisma } from "../lib/prisma";

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
 * Privacy:
 *
 * Messaging responses deliberately do NOT expose:
 *
 * - email
 * - phone
 * - matric number
 * - private verification evidence
 * - private pickup data
 *
 * Buyer phone access after paid + seller-confirmed order
 * remains part of the protected ORDER flow.
 */

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
        },

        orderBy: {
          lastMessageAt:
            "desc",
        },

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

            orderBy: {
              createdAt:
                "desc",
            },

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
      });

    const inbox =
      await Promise.all(
        conversations.map(
          async (
            conversation
          ) => {
            const side =
              conversation.buyerId ===
              user.id
                ? "buyer"
                : "vendor";

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
            };
          }
        )
      );

    const totalUnread =
      inbox.reduce(
        (
          total,
          conversation
        ) =>
          total +
          conversation.unreadCount,
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

    const unreadCounts =
      await Promise.all(
        conversations.map(
          (
            conversation
          ) => {
            const lastReadAt =
              conversation.buyerId ===
              user.id
                ? conversation
                    .buyerLastReadAt
                : conversation
                    .vendorLastReadAt;

            return prisma.message.count({
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
          }
        )
      );

    const unreadCount =
      unreadCounts.reduce(
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
      side,
    } =
      await getConversationAccess(
        conversationId,
        user.id
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

            orderBy: {
              createdAt:
                "desc",
            },

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

    /*
     * Query newest first for the database limit, then
     * reverse into normal chronological chat order.
     */

    const messages =
      [...conversation.messages]
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

            /*
             * Only sanitized stored message bodies are
             * ever returned here.
             *
             * If the original message was later
             * soft-deleted, don't expose its old body in
             * the reply preview.
             */

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
 *
 * POST
 * /api/messages/conversations/:conversationId/messages
 *
 * Normal message:
 *
 * {
 *   "body": "Is this still available?"
 * }
 *
 * Reply:
 *
 * {
 *   "body": "Yes, that's the one I mean.",
 *   "replyToMessageId": "<message uuid>"
 * }
 *
 * Reply-target validation happens in messaging.service:
 *
 * - target must exist
 * - target must be in this conversation
 * - target must not be deleted
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