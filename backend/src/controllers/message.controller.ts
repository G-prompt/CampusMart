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
 * Public responsibilities:
 *
 * - Inbox
 * - Unread counts
 * - Thread history
 * - Start conversation
 * - Send message
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
 * remains part of the protected ORDER flow, not the
 * generic messaging API.
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
  /*
   * -----------------------------------------------
   * TEMPORARY MESSAGING RESTRICTION
   * -----------------------------------------------
   */

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

  /*
   * -----------------------------------------------
   * MESSAGING BUSINESS RULE
   * -----------------------------------------------
   */

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
 *
 * Do not add phone/email here.
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
 * GET INBOX
 * =======================================================
 *
 * GET /api/messages/conversations
 *
 * Returns conversations where the current user is either
 * the buyer side or seller side.
 *
 * Each row includes:
 *
 * - safe other-party identity
 * - context
 * - latest message
 * - unread count
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
 *
 * GET /api/messages/unread-count
 *
 * Useful for:
 *
 * - navigation badge
 * - account menu badge
 * - future notification indicator
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
 *
 * GET /api/messages/conversations/:conversationId
 *
 * Access is checked before any content is returned.
 *
 * Reading the thread does NOT automatically mark it read.
 * The frontend should call the dedicated mark-read route
 * after successfully displaying the conversation.
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

              editedAt:
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
     * Query newest first for an efficient limit, then
     * reverse for normal chat display.
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

            editedAt:
              message.editedAt,

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

                description:
                  conversation
                    .product
                    .description,

                images:
                  conversation
                    .product
                    .images,

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
 *
 * POST /api/messages/conversations
 *
 * Body examples:
 *
 * LISTING:
 *
 * {
 *   "contextType": "listing",
 *   "productId": 42,
 *   "body": "Is this still available?"
 * }
 *
 * GENERAL:
 *
 * {
 *   "contextType": "general",
 *   "vendorId": "<seller uuid>",
 *   "body": "Hi, I wanted to ask about your shop."
 * }
 *
 * ORDER:
 *
 * {
 *   "contextType": "order",
 *   "orderId": "<order uuid>",
 *   "vendorId": "<seller uuid>",
 *   "body": "What time should we meet?"
 * }
 *
 * For a single-seller order, vendorId can be omitted.
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
 * SEND MESSAGE
 * =======================================================
 *
 * POST
 * /api/messages/conversations/:conversationId/messages
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
 * MARK READ
 * =======================================================
 *
 * POST
 * /api/messages/conversations/:conversationId/read
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

    const result =
      await markConversationRead(
        conversationId,
        user.id
      );

    return res.json({
      success:
        true,

      conversationId:
        result.conversationId,

      readAt:
        result.readAt,
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