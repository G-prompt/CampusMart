import {
  MessagingModerationAction,
  MessagingModerationCategory,
  MessagingModerationSeverity,
  type ConversationContextType,
} from "../generated/prisma/client";

import { prisma } from "../lib/prisma";

/*
 * =======================================================
 * CAMPUSMART MESSAGING ENFORCEMENT
 * =======================================================
 *
 * This service provides:
 *
 * - moderation-event history
 * - strike weighting
 * - temporary messaging restrictions
 * - Admin-review escalation
 *
 * IMPORTANT:
 *
 * This service DOES NOT automatically:
 *
 * - suspend a seller
 * - restrict marketplace selling
 * - disable an entire account
 *
 * Seller/account penalties remain a separate moderation
 * decision.
 */

/*
 * =======================================================
 * POLICY
 * =======================================================
 */

const ONE_HOUR_MS =
  60 * 60 * 1000;

const ONE_DAY_MS =
  24 * ONE_HOUR_MS;

const SEVEN_DAYS_MS =
  7 * ONE_DAY_MS;

const THIRTY_DAYS_MS =
  30 * ONE_DAY_MS;

/**
 * Escalation thresholds.
 *
 * These can later move into Admin-configurable platform
 * settings.
 */
const RESTRICTION_POLICY = {
  /*
   * 4 strike points within 24 hours:
   * temporary cooling-off restriction.
   */
  short: {
    windowMs:
      ONE_DAY_MS,

    threshold:
      4,

    restrictionMs:
      ONE_HOUR_MS,
  },

  /*
   * 7 points within 7 days:
   * stronger restriction and Admin review.
   */
  medium: {
    windowMs:
      SEVEN_DAYS_MS,

    threshold:
      7,

    restrictionMs:
      ONE_DAY_MS,
  },

  /*
   * 12 points within 30 days:
   * serious repeated circumvention.
   */
  serious: {
    windowMs:
      THIRTY_DAYS_MS,

    threshold:
      12,

    restrictionMs:
      SEVEN_DAYS_MS,
  },
} as const;

/*
 * =======================================================
 * ERROR
 * =======================================================
 */

export class MessagingRestrictionError extends Error {
  statusCode: number;

  code: string;

  restrictedUntil:
    Date | null;

  constructor(
    message: string,
    restrictedUntil: Date | null
  ) {
    super(message);

    this.name =
      "MessagingRestrictionError";

    this.statusCode =
      403;

    this.code =
      "MESSAGING_TEMPORARILY_RESTRICTED";

    this.restrictedUntil =
      restrictedUntil;
  }
}

/*
 * =======================================================
 * TYPES
 * =======================================================
 */

export type RecordMessagingModerationInput = {
  userId: string;

  conversationId?:
    string | null;

  messageId?:
    string | null;

  contextType?:
    ConversationContextType | null;

  categories:
    MessagingModerationCategory[];

  action:
    MessagingModerationAction;

  warningCode?:
    string | null;
};

export type MessagingStrikeSummary = {
  score24Hours: number;

  score7Days: number;

  score30Days: number;
};

/*
 * =======================================================
 * DATE HELPERS
 * =======================================================
 */

function subtractMilliseconds(
  date: Date,
  milliseconds: number
) {
  return new Date(
    date.getTime() -
      milliseconds
  );
}

function addMilliseconds(
  date: Date,
  milliseconds: number
) {
  return new Date(
    date.getTime() +
      milliseconds
  );
}

function laterDate(
  first:
    Date | null,
  second:
    Date | null
) {
  if (
    !first
  ) {
    return second;
  }

  if (
    !second
  ) {
    return first;
  }

  return first.getTime() >=
    second.getTime()
    ? first
    : second;
}

/*
 * =======================================================
 * RISK CLASSIFICATION
 * =======================================================
 *
 * One message attempt receives ONE strike weight.
 *
 * We do not add:
 *
 * phone = 1
 * email = 1
 * username = 1
 *
 * for a single message.
 *
 * Otherwise one message could unfairly become several
 * separate strikes.
 */

function calculateStrikeWeight(
  action:
    MessagingModerationAction,

  categories:
    MessagingModerationCategory[]
) {
  /*
   * Explicit payment bypass is highest-risk.
   */
  if (
    categories.includes(
      MessagingModerationCategory.off_platform_payment
    )
  ) {
    return 3;
  }

  /*
   * Explicit attempt to move the conversation away from
   * CampusMart.
   */
  if (
    categories.includes(
      MessagingModerationCategory.circumvention
    )
  ) {
    return 2;
  }

  /*
   * Other blocked behaviour is stronger than a simple
   * redacted contact detail.
   */
  if (
    action ===
    MessagingModerationAction.blocked
  ) {
    return 2;
  }

  /*
   * Phone/email/social/contact leakage that CampusMart
   * successfully redacted.
   */
  return 1;
}

function calculateBaseSeverity(
  action:
    MessagingModerationAction,

  categories:
    MessagingModerationCategory[]
) {
  if (
    categories.includes(
      MessagingModerationCategory.off_platform_payment
    )
  ) {
    return MessagingModerationSeverity.high;
  }

  if (
    categories.includes(
      MessagingModerationCategory.circumvention
    ) ||
    action ===
      MessagingModerationAction.blocked
  ) {
    return MessagingModerationSeverity.medium;
  }

  return MessagingModerationSeverity.low;
}

/*
 * =======================================================
 * CURRENT RESTRICTION
 * =======================================================
 */

export async function getMessagingRestriction(
  userId: string
) {
  const user =
    await prisma.user.findUnique({
      where: {
        id:
          userId,
      },

      select: {
        id:
          true,

        messagingRestrictedUntil:
          true,

        messagingRestrictionReason:
          true,
      },
    });

  if (
    !user
  ) {
    return {
      exists:
        false,

      restricted:
        false,

      restrictedUntil:
        null,

      reason:
        null,
    };
  }

  const now =
    new Date();

  const restricted =
    Boolean(
      user.messagingRestrictedUntil &&
        user.messagingRestrictedUntil.getTime() >
          now.getTime()
    );

  return {
    exists:
      true,

    restricted,

    restrictedUntil:
      restricted
        ? user.messagingRestrictedUntil
        : null,

    reason:
      restricted
        ? user.messagingRestrictionReason
        : null,
  };
}

/*
 * =======================================================
 * ASSERT SEND ACCESS
 * =======================================================
 *
 * This should run before accepting a new outgoing
 * message.
 *
 * Users may still READ their conversation history while
 * temporarily restricted.
 */

export async function assertMessagingAllowed(
  userId: string
) {
  const restriction =
    await getMessagingRestriction(
      userId
    );

  if (
    !restriction.exists
  ) {
    throw new MessagingRestrictionError(
      "User account was not found.",
      null
    );
  }

  if (
    restriction.restricted
  ) {
    throw new MessagingRestrictionError(
      "Messaging is temporarily restricted because of repeated attempts to share off-platform contact or payment information.",
      restriction.restrictedUntil
    );
  }

  return {
    allowed:
      true as const,
  };
}

/*
 * =======================================================
 * STRIKE SCORE
 * =======================================================
 */

export async function getMessagingStrikeSummary(
  userId: string
): Promise<MessagingStrikeSummary> {
  const now =
    new Date();

  const start24Hours =
    subtractMilliseconds(
      now,
      ONE_DAY_MS
    );

  const start7Days =
    subtractMilliseconds(
      now,
      SEVEN_DAYS_MS
    );

  const start30Days =
    subtractMilliseconds(
      now,
      THIRTY_DAYS_MS
    );

  const [
    score24Hours,
    score7Days,
    score30Days,
  ] =
    await prisma.$transaction([
      prisma.messagingModerationEvent.aggregate({
        where: {
          userId,

          createdAt: {
            gte:
              start24Hours,
          },
        },

        _sum: {
          strikeWeight:
            true,
        },
      }),

      prisma.messagingModerationEvent.aggregate({
        where: {
          userId,

          createdAt: {
            gte:
              start7Days,
          },
        },

        _sum: {
          strikeWeight:
            true,
        },
      }),

      prisma.messagingModerationEvent.aggregate({
        where: {
          userId,

          createdAt: {
            gte:
              start30Days,
          },
        },

        _sum: {
          strikeWeight:
            true,
        },
      }),
    ]);

  return {
    score24Hours:
      score24Hours._sum
        .strikeWeight ??
      0,

    score7Days:
      score7Days._sum
        .strikeWeight ??
      0,

    score30Days:
      score30Days._sum
        .strikeWeight ??
      0,
  };
}

/*
 * =======================================================
 * DETERMINE ESCALATION
 * =======================================================
 */

function determineRestriction(
  now: Date,
  scores: MessagingStrikeSummary
) {
  /*
   * Evaluate strongest rule first.
   */

  if (
    scores.score30Days >=
    RESTRICTION_POLICY.serious
      .threshold
  ) {
    return {
      restrictedUntil:
        addMilliseconds(
          now,
          RESTRICTION_POLICY.serious
            .restrictionMs
        ),

      reason:
        "REPEATED_OFF_PLATFORM_CIRCUMVENTION",

      requiresReview:
        true,

      level:
        "serious" as const,
    };
  }

  if (
    scores.score7Days >=
    RESTRICTION_POLICY.medium
      .threshold
  ) {
    return {
      restrictedUntil:
        addMilliseconds(
          now,
          RESTRICTION_POLICY.medium
            .restrictionMs
        ),

      reason:
        "REPEATED_OFF_PLATFORM_CIRCUMVENTION",

      requiresReview:
        true,

      level:
        "medium" as const,
    };
  }

  if (
    scores.score24Hours >=
    RESTRICTION_POLICY.short
      .threshold
  ) {
    return {
      restrictedUntil:
        addMilliseconds(
          now,
          RESTRICTION_POLICY.short
            .restrictionMs
        ),

      reason:
        "REPEATED_CONTACT_SHARING",

      requiresReview:
        false,

      level:
        "short" as const,
    };
  }

  return {
    restrictedUntil:
      null,

    reason:
      null,

    requiresReview:
      false,

    level:
      "none" as const,
  };
}

/*
 * =======================================================
 * RECORD MODERATION ATTEMPT
 * =======================================================
 *
 * This function:
 *
 * 1. Creates ONE moderation event.
 * 2. Calculates recent strike history.
 * 3. Applies a temporary messaging restriction when
 *    thresholds are reached.
 * 4. Flags serious/repeated behaviour for Admin review.
 *
 * It never stores the original sensitive value.
 */

export async function recordMessagingModerationAttempt(
  input: RecordMessagingModerationInput
) {
  if (
    input.categories.length ===
    0
  ) {
    throw new Error(
      "Cannot record a messaging moderation event without a category."
    );
  }

  const strikeWeight =
    calculateStrikeWeight(
      input.action,
      input.categories
    );

  const baseSeverity =
    calculateBaseSeverity(
      input.action,
      input.categories
    );

  const now =
    new Date();

  return prisma.$transaction(
    async (
      tx
    ) => {
      /*
       * -----------------------------------------------
       * CREATE EVENT
       * -----------------------------------------------
       */

      const event =
        await tx.messagingModerationEvent.create({
          data: {
            userId:
              input.userId,

            conversationId:
              input.conversationId ??
              null,

            messageId:
              input.messageId ??
              null,

            contextType:
              input.contextType ??
              null,

            categories:
              input.categories,

            action:
              input.action,

            severity:
              baseSeverity,

            strikeWeight,

            warningCode:
              input.warningCode ??
              null,

            requiresReview:
              false,
          },

          select: {
            id:
              true,

            userId:
              true,

            conversationId:
              true,

            messageId:
              true,

            contextType:
              true,

            categories:
              true,

            action:
              true,

            severity:
              true,

            strikeWeight:
              true,

            warningCode:
              true,

            requiresReview:
              true,

            restrictionAppliedUntil:
              true,

            createdAt:
              true,
          },
        });

      /*
       * -----------------------------------------------
       * CALCULATE STRIKE WINDOWS
       * -----------------------------------------------
       *
       * The event above is already included.
       */

      const start24Hours =
        subtractMilliseconds(
          now,
          ONE_DAY_MS
        );

      const start7Days =
        subtractMilliseconds(
          now,
          SEVEN_DAYS_MS
        );

      const start30Days =
        subtractMilliseconds(
          now,
          THIRTY_DAYS_MS
        );

      const [
        aggregate24Hours,
        aggregate7Days,
        aggregate30Days,
      ] =
        await Promise.all([
          tx.messagingModerationEvent.aggregate({
            where: {
              userId:
                input.userId,

              createdAt: {
                gte:
                  start24Hours,
              },
            },

            _sum: {
              strikeWeight:
                true,
            },
          }),

          tx.messagingModerationEvent.aggregate({
            where: {
              userId:
                input.userId,

              createdAt: {
                gte:
                  start7Days,
              },
            },

            _sum: {
              strikeWeight:
                true,
            },
          }),

          tx.messagingModerationEvent.aggregate({
            where: {
              userId:
                input.userId,

              createdAt: {
                gte:
                  start30Days,
              },
            },

            _sum: {
              strikeWeight:
                true,
            },
          }),
        ]);

      const scores: MessagingStrikeSummary =
        {
          score24Hours:
            aggregate24Hours
              ._sum
              .strikeWeight ??
            0,

          score7Days:
            aggregate7Days
              ._sum
              .strikeWeight ??
            0,

          score30Days:
            aggregate30Days
              ._sum
              .strikeWeight ??
            0,
        };

      /*
       * -----------------------------------------------
       * DETERMINE ESCALATION
       * -----------------------------------------------
       */

      const escalation =
        determineRestriction(
          now,
          scores
        );

      /*
       * Explicit payment-circumvention attempts are worth
       * surfacing to Admin even before a repeated-abuse
       * threshold is reached.
       *
       * This does NOT automatically suspend the account.
       */

      const seriousPaymentAttempt =
        input.categories.includes(
          MessagingModerationCategory.off_platform_payment
        );

      const requiresReview =
        escalation.requiresReview ||
        seriousPaymentAttempt;

      /*
       * -----------------------------------------------
       * APPLY RESTRICTION
       * -----------------------------------------------
       */

      let finalRestrictedUntil:
        Date | null =
          null;

      if (
        escalation.restrictedUntil
      ) {
        const user =
          await tx.user.findUnique({
            where: {
              id:
                input.userId,
            },

            select: {
              messagingRestrictedUntil:
                true,
            },
          });

        if (
          !user
        ) {
          throw new Error(
            "Cannot apply messaging enforcement to a user that does not exist."
          );
        }

        /*
         * Never shorten an existing restriction.
         */

        finalRestrictedUntil =
          laterDate(
            user.messagingRestrictedUntil,
            escalation.restrictedUntil
          );

        await tx.user.update({
          where: {
            id:
              input.userId,
          },

          data: {
            messagingRestrictedUntil:
              finalRestrictedUntil,

            messagingRestrictionReason:
              escalation.reason,
          },
        });
      }

      /*
       * -----------------------------------------------
       * UPDATE EVENT AUDIT RESULT
       * -----------------------------------------------
       */

      const updatedEvent =
        await tx.messagingModerationEvent.update({
          where: {
            id:
              event.id,
          },

          data: {
            requiresReview,

            restrictionAppliedUntil:
              finalRestrictedUntil,
          },

          select: {
            id:
              true,

            userId:
              true,

            conversationId:
              true,

            messageId:
              true,

            contextType:
              true,

            categories:
              true,

            action:
              true,

            severity:
              true,

            strikeWeight:
              true,

            warningCode:
              true,

            requiresReview:
              true,

            restrictionAppliedUntil:
              true,

            createdAt:
              true,
          },
        });

      return {
        event:
          updatedEvent,

        scores,

        enforcement: {
          level:
            escalation.level,

          restricted:
            Boolean(
              finalRestrictedUntil
            ),

          restrictedUntil:
            finalRestrictedUntil,

          requiresReview,
        },
      };
    }
  );
}