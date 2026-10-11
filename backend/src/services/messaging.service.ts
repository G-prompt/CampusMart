import {
  ConversationContextType,
  MessagingModerationAction as PrismaMessagingModerationAction,
  MessagingModerationCategory as PrismaMessagingModerationCategory,
  UserRole,
  VendorAccessStatus,
} from "../generated/prisma/client";

import { prisma } from "../lib/prisma";

import {
  moderateOutgoingMessage,
  type MessageModerationAction,
  type MessageModerationCategory,
} from "./messageModeration.service";

import {
  assertMessagingAllowed,
  recordMessagingModerationAttempt,
} from "./messagingEnforcement.service";

/*
 * =======================================================
 * CONFIGURATION
 * =======================================================
 */

export const MESSAGE_MAX_LENGTH = 2000;

/*
 * =======================================================
 * ERROR TYPE
 * =======================================================
 */

export class MessagingError extends Error {
  statusCode: number;

  code: string;

  moderationAction?: MessageModerationAction;

  moderationCategories?: MessageModerationCategory[];

  restrictedUntil?: Date | null;

  requiresReview?: boolean;

  constructor(
    message: string,
    statusCode = 400,
    code = "MESSAGING_ERROR",
    options?: {
      moderationAction?: MessageModerationAction;
      moderationCategories?: MessageModerationCategory[];
      restrictedUntil?: Date | null;
      requiresReview?: boolean;
    }
  ) {
    super(message);

    this.name = "MessagingError";

    this.statusCode = statusCode;

    this.code = code;

    this.moderationAction =
      options?.moderationAction;

    this.moderationCategories =
      options?.moderationCategories;

    this.restrictedUntil =
      options?.restrictedUntil;

    this.requiresReview =
      options?.requiresReview;
  }
}

/*
 * =======================================================
 * TYPES
 * =======================================================
 */

export type ConversationSide =
  | "buyer"
  | "vendor";

export type ResolveConversationContextInput = {
  actorId: string;

  actorRole: UserRole;

  contextType: ConversationContextType;

  vendorId?: string | null;

  productId?: number | null;

  orderId?: string | null;
};

export type ResolvedConversationContext = {
  buyerId: string;

  vendorId: string;

  contextType: ConversationContextType;

  contextKey: string;

  productId: number | null;

  orderId: string | null;

  actorSide: ConversationSide;
};

type StartConversationInput =
  ResolveConversationContextInput & {
    body: unknown;
  };

type SendMessageInput = {
  conversationId: string;

  senderId: string;

  body: unknown;
};

/*
 * =======================================================
 * MESSAGE BODY
 * =======================================================
 */

export function normalizeMessageBody(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    throw new MessagingError(
      "Message text is required.",
      400,
      "MESSAGE_REQUIRED"
    );
  }

  const body =
    value.trim();

  if (
    !body
  ) {
    throw new MessagingError(
      "Message cannot be empty.",
      400,
      "MESSAGE_EMPTY"
    );
  }

  if (
    body.length >
    MESSAGE_MAX_LENGTH
  ) {
    throw new MessagingError(
      `Messages cannot exceed ${MESSAGE_MAX_LENGTH} characters.`,
      400,
      "MESSAGE_TOO_LONG"
    );
  }

  return body;
}

/*
 * =======================================================
 * MODERATION CATEGORY MAPPING
 * =======================================================
 *
 * The scanner deliberately uses simple string-union
 * types so it remains independent from Prisma.
 *
 * Persistent moderation events use Prisma enums.
 *
 * We map explicitly instead of trusting casts.
 */

function toPrismaModerationCategory(
  category: MessageModerationCategory
): PrismaMessagingModerationCategory {
  switch (
    category
  ) {
    case "phone_number":
      return PrismaMessagingModerationCategory.phone_number;

    case "email":
      return PrismaMessagingModerationCategory.email;

    case "external_username":
      return PrismaMessagingModerationCategory.external_username;

    case "external_link":
      return PrismaMessagingModerationCategory.external_link;

    case "bank_details":
      return PrismaMessagingModerationCategory.bank_details;

    case "off_platform_payment":
      return PrismaMessagingModerationCategory.off_platform_payment;

    case "circumvention":
      return PrismaMessagingModerationCategory.circumvention;
  }
}

function toPrismaModerationAction(
  action: MessageModerationAction
) {
  switch (
    action
  ) {
    case "redacted":
      return PrismaMessagingModerationAction.redacted;

    case "blocked":
      return PrismaMessagingModerationAction.blocked;

    case "allow":
      throw new Error(
        "Allowed messages must not create moderation-event rows."
      );
  }
}

/*
 * =======================================================
 * PREPARE OUTGOING MESSAGE
 * =======================================================
 *
 * Important:
 *
 * This function does NOT write to Prisma.
 *
 * It also does NOT throw merely because moderation
 * detected something.
 *
 * That allows the calling operation to:
 *
 * 1. validate conversation context
 * 2. record the moderation attempt
 * 3. apply strikes/restrictions
 * 4. then decide whether a Message may be created
 */

function prepareOutgoingMessage(
  value: unknown
) {
  const normalizedBody =
    normalizeMessageBody(
      value
    );

  const moderation =
    moderateOutgoingMessage(
      normalizedBody
    );

  return {
    body:
      moderation.sanitizedBody,

    moderation,
  };
}

/*
 * =======================================================
 * MODERATION EVENT HELPER
 * =======================================================
 */

async function recordModerationIfRequired(input: {
  userId: string;

  conversationId?: string | null;

  contextType?: ConversationContextType | null;

  moderation: ReturnType<
    typeof moderateOutgoingMessage
  >;
}) {
  if (
    input.moderation.action ===
    "allow"
  ) {
    return null;
  }

  const categories =
    input.moderation.categories.map(
      toPrismaModerationCategory
    );

  if (
    categories.length ===
    0
  ) {
    /*
     * A blocked/redacted moderation result should always
     * carry at least one category.
     */
    throw new Error(
      "Messaging moderation produced an actionable result without a moderation category."
    );
  }

  return recordMessagingModerationAttempt({
    userId:
      input.userId,

    conversationId:
      input.conversationId ??
      null,

    contextType:
      input.contextType ??
      null,

    categories,

    action:
      toPrismaModerationAction(
        input.moderation.action
      ),

    warningCode:
      input.moderation.warningCode,
  });
}

/*
 * =======================================================
 * BLOCKED MESSAGE ERROR
 * =======================================================
 */

function throwBlockedMessage(
  moderation: ReturnType<
    typeof moderateOutgoingMessage
  >,
  enforcement:
    Awaited<
      ReturnType<
        typeof recordMessagingModerationAttempt
      >
    >
) {
  throw new MessagingError(
    "This message appears to be trying to move communication or payment outside CampusMart. Please keep the conversation on CampusMart.",
    400,
    moderation.warningCode ??
      "OFF_PLATFORM_ATTEMPT_BLOCKED",
    {
      moderationAction:
        moderation.action,

      moderationCategories:
        moderation.categories,

      restrictedUntil:
        enforcement.enforcement
          .restrictedUntil,

      requiresReview:
        enforcement.enforcement
          .requiresReview,
    }
  );
}

/*
 * =======================================================
 * SELLER AVAILABILITY
 * =======================================================
 *
 * Used only when opening a NEW general/listing thread.
 *
 * Existing conversations remain readable/usable even if
 * seller marketplace access later changes.
 *
 * Messaging-specific restrictions are handled
 * independently.
 */

async function assertSellerAvailableForNewConversation(
  vendorId: string
) {
  const vendor =
    await prisma.user.findUnique({
      where: {
        id:
          vendorId,
      },

      select: {
        id:
          true,

        role:
          true,

        vendorProfile: {
          select: {
            accessStatus:
              true,
          },
        },
      },
    });

  if (
    !vendor ||
    vendor.role !==
      UserRole.vendor
  ) {
    throw new MessagingError(
      "Seller not found.",
      404,
      "SELLER_NOT_FOUND"
    );
  }

  if (
    !vendor.vendorProfile ||
    vendor.vendorProfile
      .accessStatus !==
      VendorAccessStatus.active
  ) {
    throw new MessagingError(
      "This seller is not currently available for new conversations.",
      400,
      "SELLER_UNAVAILABLE"
    );
  }

  return vendor;
}

/*
 * =======================================================
 * GENERAL SELLER CHAT
 * =======================================================
 *
 * The actor becomes the buyer side of this conversation.
 *
 * A vendor account can therefore still message another
 * vendor while shopping as a buyer.
 */

async function resolveGeneralContext(
  input: ResolveConversationContextInput
): Promise<ResolvedConversationContext> {
  const vendorId =
    typeof input.vendorId ===
      "string"
      ? input.vendorId.trim()
      : "";

  if (
    !vendorId
  ) {
    throw new MessagingError(
      "Seller ID is required.",
      400,
      "SELLER_ID_REQUIRED"
    );
  }

  if (
    vendorId ===
    input.actorId
  ) {
    throw new MessagingError(
      "You cannot start a conversation with yourself.",
      400,
      "SELF_CONVERSATION_NOT_ALLOWED"
    );
  }

  await assertSellerAvailableForNewConversation(
    vendorId
  );

  return {
    buyerId:
      input.actorId,

    vendorId,

    contextType:
      ConversationContextType.general,

    contextKey:
      "general",

    productId:
      null,

    orderId:
      null,

    actorSide:
      "buyer",
  };
}

/*
 * =======================================================
 * LISTING CHAT
 * =======================================================
 *
 * The seller is resolved from Product.
 *
 * A client cannot spoof vendor ownership.
 */

async function resolveListingContext(
  input: ResolveConversationContextInput
): Promise<ResolvedConversationContext> {
  const productId =
    Number(
      input.productId
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
      "LISTING_ID_REQUIRED"
    );
  }

  const product =
    await prisma.product.findUnique({
      where: {
        id:
          productId,
      },

      select: {
        id:
          true,

        vendorId:
          true,

        isArchived:
          true,

        vendor: {
          select: {
            id:
              true,

            role:
              true,

            vendorProfile: {
              select: {
                accessStatus:
                  true,
              },
            },
          },
        },
      },
    });

  if (
    !product
  ) {
    throw new MessagingError(
      "Listing not found.",
      404,
      "LISTING_NOT_FOUND"
    );
  }

  /*
   * Existing conversations survive an archive.
   *
   * Only creation of a NEW listing conversation is
   * prevented.
   */

  if (
    product.isArchived
  ) {
    throw new MessagingError(
      "This listing is no longer available for new conversations.",
      400,
      "LISTING_UNAVAILABLE"
    );
  }

  if (
    product.vendor.role !==
      UserRole.vendor ||
    !product.vendor
      .vendorProfile ||
    product.vendor
      .vendorProfile
      .accessStatus !==
      VendorAccessStatus.active
  ) {
    throw new MessagingError(
      "This seller is not currently available for new conversations.",
      400,
      "SELLER_UNAVAILABLE"
    );
  }

  if (
    product.vendorId ===
    input.actorId
  ) {
    throw new MessagingError(
      "You cannot message yourself about your own listing.",
      400,
      "SELF_CONVERSATION_NOT_ALLOWED"
    );
  }

  if (
    input.vendorId &&
    input.vendorId !==
      product.vendorId
  ) {
    throw new MessagingError(
      "The selected seller does not own this listing.",
      400,
      "LISTING_SELLER_MISMATCH"
    );
  }

  return {
    buyerId:
      input.actorId,

    vendorId:
      product.vendorId,

    contextType:
      ConversationContextType.listing,

    contextKey:
      `listing:${product.id}`,

    productId:
      product.id,

    orderId:
      null,

    actorSide:
      "buyer",
  };
}

/*
 * =======================================================
 * ORDER CHAT
 * =======================================================
 *
 * Buyer:
 *
 * - must own the order
 * - can message only sellers represented in that order
 *
 * Seller:
 *
 * - must actually own items inside the order
 * - cannot use arbitrary order IDs to reach unrelated
 *   buyers
 *
 * Multi-vendor orders get one conversation per seller.
 */

async function resolveOrderContext(
  input: ResolveConversationContextInput
): Promise<ResolvedConversationContext> {
  const orderId =
    typeof input.orderId ===
      "string"
      ? input.orderId.trim()
      : "";

  if (
    !orderId
  ) {
    throw new MessagingError(
      "Order ID is required.",
      400,
      "ORDER_ID_REQUIRED"
    );
  }

  const order =
    await prisma.order.findUnique({
      where: {
        id:
          orderId,
      },

      select: {
        id:
          true,

        buyerId:
          true,

        items: {
          select: {
            vendorId:
              true,
          },
        },
      },
    });

  if (
    !order
  ) {
    throw new MessagingError(
      "Order not found.",
      404,
      "ORDER_NOT_FOUND"
    );
  }

  const vendorIds =
    Array.from(
      new Set(
        order.items.map(
          (
            item
          ) =>
            item.vendorId
        )
      )
    );

  /*
   * ---------------------------------------------------
   * ACTOR IS ORDER BUYER
   * ---------------------------------------------------
   */

  if (
    order.buyerId ===
    input.actorId
  ) {
    let vendorId =
      typeof input.vendorId ===
        "string"
        ? input.vendorId.trim()
        : "";

    /*
     * Single-seller order:
     * infer seller automatically.
     */

    if (
      !vendorId &&
      vendorIds.length ===
        1
    ) {
      vendorId =
        vendorIds[0];
    }

    if (
      !vendorId
    ) {
      throw new MessagingError(
        "Select which seller in this order you want to message.",
        400,
        "ORDER_SELLER_REQUIRED"
      );
    }

    if (
      !vendorIds.includes(
        vendorId
      )
    ) {
      throw new MessagingError(
        "That seller is not part of this order.",
        403,
        "ORDER_SELLER_NOT_FOUND"
      );
    }

    if (
      vendorId ===
      input.actorId
    ) {
      throw new MessagingError(
        "You cannot start an order conversation with yourself.",
        400,
        "SELF_CONVERSATION_NOT_ALLOWED"
      );
    }

    return {
      buyerId:
        order.buyerId,

      vendorId,

      contextType:
        ConversationContextType.order,

      contextKey:
        `order:${order.id}`,

      productId:
        null,

      orderId:
        order.id,

      actorSide:
        "buyer",
    };
  }

  /*
   * ---------------------------------------------------
   * ACTOR IS ONE OF THE ORDER SELLERS
   * ---------------------------------------------------
   */

  const actorIsSeller =
    vendorIds.includes(
      input.actorId
    );

  if (
    actorIsSeller
  ) {
    if (
      input.actorRole !==
      UserRole.vendor
    ) {
      throw new MessagingError(
        "Seller access is required for this conversation.",
        403,
        "SELLER_ACCESS_REQUIRED"
      );
    }

    if (
      input.vendorId &&
      input.vendorId !==
        input.actorId
    ) {
      throw new MessagingError(
        "You cannot open another seller's order conversation.",
        403,
        "ORDER_SELLER_MISMATCH"
      );
    }

    return {
      buyerId:
        order.buyerId,

      vendorId:
        input.actorId,

      contextType:
        ConversationContextType.order,

      contextKey:
        `order:${order.id}`,

      productId:
        null,

      orderId:
        order.id,

      actorSide:
        "vendor",
    };
  }

  throw new MessagingError(
    "You do not have access to this order conversation.",
    403,
    "ORDER_CONVERSATION_FORBIDDEN"
  );
}

/*
 * =======================================================
 * RESOLVE CONVERSATION CONTEXT
 * =======================================================
 */

export async function resolveConversationContext(
  input: ResolveConversationContextInput
): Promise<ResolvedConversationContext> {
  switch (
    input.contextType
  ) {
    case ConversationContextType.general:
      return resolveGeneralContext(
        input
      );

    case ConversationContextType.listing:
      return resolveListingContext(
        input
      );

    case ConversationContextType.order:
      return resolveOrderContext(
        input
      );

    default:
      throw new MessagingError(
        "Unsupported conversation type.",
        400,
        "INVALID_CONVERSATION_TYPE"
      );
  }
}

/*
 * =======================================================
 * CONVERSATION ACCESS
 * =======================================================
 */

export async function getConversationAccess(
  conversationId: string,
  userId: string
) {
  const cleanConversationId =
    String(
      conversationId ??
        ""
    ).trim();

  if (
    !cleanConversationId
  ) {
    throw new MessagingError(
      "Conversation ID is required.",
      400,
      "CONVERSATION_ID_REQUIRED"
    );
  }

  const conversation =
    await prisma.conversation.findUnique({
      where: {
        id:
          cleanConversationId,
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

  if (
    conversation.buyerId ===
    userId
  ) {
    return {
      conversation,

      side:
        "buyer" as const,
    };
  }

  if (
    conversation.vendorId ===
    userId
  ) {
    return {
      conversation,

      side:
        "vendor" as const,
    };
  }

  throw new MessagingError(
    "You do not have access to this conversation.",
    403,
    "CONVERSATION_FORBIDDEN"
  );
}

/*
 * =======================================================
 * START CONVERSATION + FIRST MESSAGE
 * =======================================================
 *
 * V1 does not create empty inbox conversations.
 *
 * A valid first message is required.
 */

export async function startConversationWithMessage(
  input: StartConversationInput
) {
  /*
   * -----------------------------------------------
   * 1. CHECK CURRENT MESSAGING RESTRICTION
   * -----------------------------------------------
   *
   * Restricted users may read history, but cannot send.
   */

  await assertMessagingAllowed(
    input.actorId
  );

  /*
   * -----------------------------------------------
   * 2. NORMALIZE + SCAN
   * -----------------------------------------------
   */

  const prepared =
    prepareOutgoingMessage(
      input.body
    );

  /*
   * -----------------------------------------------
   * 3. VALIDATE TRUSTED CONVERSATION CONTEXT
   * -----------------------------------------------
   *
   * Do this before recording a strike so bogus seller,
   * product or order IDs do not create moderation events.
   */

  const context =
    await resolveConversationContext(
      input
    );

  /*
   * If this canonical conversation already exists, attach
   * moderation attempts to it.
   *
   * A blocked first-ever attempt will correctly have no
   * conversation row.
   */

  const existingConversation =
    await prisma.conversation.findUnique({
      where: {
        buyerId_vendorId_contextKey: {
          buyerId:
            context.buyerId,

          vendorId:
            context.vendorId,

          contextKey:
            context.contextKey,
        },
      },

      select: {
        id:
          true,
      },
    });

  /*
   * -----------------------------------------------
   * 4. RECORD MODERATION EVENT
   * -----------------------------------------------
   *
   * This happens BEFORE any suspicious content can reach
   * the Message table.
   *
   * It may also activate a temporary messaging
   * restriction for FUTURE sends.
   */

  const moderationRecord =
    await recordModerationIfRequired({
      userId:
        input.actorId,

      conversationId:
        existingConversation?.id ??
        null,

      contextType:
        context.contextType,

      moderation:
        prepared.moderation,
    });

  /*
   * -----------------------------------------------
   * 5. BLOCK WHEN REQUIRED
   * -----------------------------------------------
   *
   * No Conversation is created for a first-ever blocked
   * attempt.
   *
   * No Message row is ever created.
   */

  if (
    prepared.moderation.action ===
    "blocked"
  ) {
    if (
      !moderationRecord
    ) {
      throw new Error(
        "Blocked message did not create a moderation record."
      );
    }

    throwBlockedMessage(
      prepared.moderation,
      moderationRecord
    );
  }

  /*
   * -----------------------------------------------
   * 6. CREATE/REUSE CONVERSATION + STORE MESSAGE
   * -----------------------------------------------
   *
   * prepared.body is safe:
   *
   * allow    -> normal body
   * redacted -> sanitized body
   */

  const now =
    new Date();

  const result =
    await prisma.$transaction(
      async (
        tx
      ) => {
        const conversation =
          await tx.conversation.upsert({
            where: {
              buyerId_vendorId_contextKey: {
                buyerId:
                  context.buyerId,

                vendorId:
                  context.vendorId,

                contextKey:
                  context.contextKey,
              },
            },

            update: {},

            create: {
              buyerId:
                context.buyerId,

              vendorId:
                context.vendorId,

              contextType:
                context.contextType,

              contextKey:
                context.contextKey,

              productId:
                context.productId,

              orderId:
                context.orderId,

              buyerLastReadAt:
                context.actorSide ===
                "buyer"
                  ? now
                  : null,

              vendorLastReadAt:
                context.actorSide ===
                "vendor"
                  ? now
                  : null,

              lastMessageAt:
                now,
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
            },
          });

        const message =
          await tx.message.create({
            data: {
              conversationId:
                conversation.id,

              senderId:
                input.actorId,

              /*
               * The raw sensitive body never reaches this
               * field after redaction.
               */
              body:
                prepared.body,
            },

            select: {
              id:
                true,

              conversationId:
                true,

              senderId:
                true,

              body:
                true,

              editedAt:
                true,

              deletedAt:
                true,

              createdAt:
                true,

              updatedAt:
                true,
            },
          });

        const updatedConversation =
          await tx.conversation.update({
            where: {
              id:
                conversation.id,
            },

            data: {
              lastMessageAt:
                message.createdAt,

              ...(context.actorSide ===
              "buyer"
                ? {
                    buyerLastReadAt:
                      message.createdAt,
                  }
                : {
                    vendorLastReadAt:
                      message.createdAt,
                  }),
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
            },
          });

        return {
          conversation:
            updatedConversation,

          message,
        };
      }
    );

  /*
   * -----------------------------------------------
   * 7. LINK REDACTION EVENT TO STORED MESSAGE
   * -----------------------------------------------
   *
   * The moderation event already exists before storage,
   * so a suspicious send cannot bypass strike history.
   *
   * Now attach the resulting sanitized Message and final
   * Conversation IDs for audit/review.
   */

  if (
    moderationRecord
  ) {
    await prisma.messagingModerationEvent.update({
      where: {
        id:
          moderationRecord.event.id,
      },

      data: {
        conversationId:
          result.conversation.id,

        messageId:
          result.message.id,
      },
    });
  }

  return {
    ...result,

    moderation: {
      action:
        prepared.moderation.action,

      categories:
        prepared.moderation.categories,

      warningRequired:
        prepared.moderation.warningRequired,

      warningCode:
        prepared.moderation.warningCode,

      restrictedUntil:
        moderationRecord?.enforcement
          .restrictedUntil ??
        null,

      requiresReview:
        moderationRecord?.enforcement
          .requiresReview ??
        false,
    },
  };
}

/*
 * =======================================================
 * SEND MESSAGE TO EXISTING CONVERSATION
 * =======================================================
 */

export async function sendConversationMessage(
  input: SendMessageInput
) {
  /*
   * -----------------------------------------------
   * 1. EXISTING RESTRICTION CHECK
   * -----------------------------------------------
   */

  await assertMessagingAllowed(
    input.senderId
  );

  /*
   * -----------------------------------------------
   * 2. CONVERSATION ACCESS
   * -----------------------------------------------
   */

  const {
    conversation,
    side,
  } =
    await getConversationAccess(
      input.conversationId,
      input.senderId
    );

  /*
   * -----------------------------------------------
   * 3. NORMALIZE + MODERATE
   * -----------------------------------------------
   */

  const prepared =
    prepareOutgoingMessage(
      input.body
    );

  /*
   * -----------------------------------------------
   * 4. RECORD SUSPICIOUS ATTEMPT
   * -----------------------------------------------
   */

  const moderationRecord =
    await recordModerationIfRequired({
      userId:
        input.senderId,

      conversationId:
        conversation.id,

      contextType:
        conversation.contextType,

      moderation:
        prepared.moderation,
    });

  /*
   * -----------------------------------------------
   * 5. BLOCKED MESSAGE
   * -----------------------------------------------
   */

  if (
    prepared.moderation.action ===
    "blocked"
  ) {
    if (
      !moderationRecord
    ) {
      throw new Error(
        "Blocked message did not create a moderation record."
      );
    }

    throwBlockedMessage(
      prepared.moderation,
      moderationRecord
    );
  }

  /*
   * -----------------------------------------------
   * 6. STORE ALLOWED / SANITIZED BODY
   * -----------------------------------------------
   */

  const result =
    await prisma.$transaction(
      async (
        tx
      ) => {
        const message =
          await tx.message.create({
            data: {
              conversationId:
                conversation.id,

              senderId:
                input.senderId,

              body:
                prepared.body,
            },

            select: {
              id:
                true,

              conversationId:
                true,

              senderId:
                true,

              body:
                true,

              editedAt:
                true,

              deletedAt:
                true,

              createdAt:
                true,

              updatedAt:
                true,
            },
          });

        await tx.conversation.update({
          where: {
            id:
              conversation.id,
          },

          data: {
            lastMessageAt:
              message.createdAt,

            ...(side ===
            "buyer"
              ? {
                  buyerLastReadAt:
                    message.createdAt,
                }
              : {
                  vendorLastReadAt:
                    message.createdAt,
                }),
          },
        });

        return {
          conversationId:
            conversation.id,

          message,
        };
      }
    );

  /*
   * -----------------------------------------------
   * 7. LINK REDACTION EVENT
   * -----------------------------------------------
   */

  if (
    moderationRecord
  ) {
    await prisma.messagingModerationEvent.update({
      where: {
        id:
          moderationRecord.event.id,
      },

      data: {
        messageId:
          result.message.id,
      },
    });
  }

  return {
    ...result,

    moderation: {
      action:
        prepared.moderation.action,

      categories:
        prepared.moderation.categories,

      warningRequired:
        prepared.moderation.warningRequired,

      warningCode:
        prepared.moderation.warningCode,

      restrictedUntil:
        moderationRecord?.enforcement
          .restrictedUntil ??
        null,

      requiresReview:
        moderationRecord?.enforcement
          .requiresReview ??
        false,
    },
  };
}

/*
 * =======================================================
 * MARK CONVERSATION READ
 * =======================================================
 *
 * Messaging restrictions intentionally do NOT affect
 * reading.
 *
 * A temporarily restricted user may still:
 *
 * - open their inbox
 * - read previous messages
 * - view order-related communication
 *
 * They simply cannot SEND new messages until expiry.
 */

export async function markConversationRead(
  conversationId: string,
  userId: string
) {
  const {
    conversation,
    side,
  } =
    await getConversationAccess(
      conversationId,
      userId
    );

  const readAt =
    new Date();

  const updated =
    await prisma.conversation.update({
      where: {
        id:
          conversation.id,
      },

      data:
        side ===
        "buyer"
          ? {
              buyerLastReadAt:
                readAt,
            }
          : {
              vendorLastReadAt:
                readAt,
            },

      select: {
        id:
          true,

        buyerLastReadAt:
          true,

        vendorLastReadAt:
          true,

        lastMessageAt:
          true,
      },
    });

  return {
    conversationId:
      updated.id,

    readAt:
      side ===
      "buyer"
        ? updated.buyerLastReadAt
        : updated.vendorLastReadAt,
  };
}