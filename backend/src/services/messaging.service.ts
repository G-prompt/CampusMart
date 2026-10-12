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
  PHONE_CONTINUATION_WINDOW_MS,
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

  replyToMessageId?: unknown;
};

/*
 * =======================================================
 * DATE HELPERS
 * =======================================================
 */

function laterDate(
  first:
    Date | null | undefined,
  second:
    Date | null | undefined
) {
  if (
    !first
  ) {
    return second ?? null;
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
 * RECENT PHONE-SHARING HISTORY
 * =======================================================
 *
 * IMPORTANT:
 *
 * We do NOT store previous phone digits here.
 *
 * We only check whether this same sender produced a
 * phone-number moderation event in this same conversation
 * during the short continuation window.
 *
 * That is enough to detect:
 *
 * message 1: 080
 * message 2: 391
 * message 3: 5537
 *
 * without reconstructing or persisting the secret.
 */

async function hasRecentPhoneSharingAttempt(
  userId: string,
  conversationId:
    string | null | undefined
) {
  if (
    !conversationId
  ) {
    return false;
  }

  const since =
    new Date(
      Date.now() -
        PHONE_CONTINUATION_WINDOW_MS
    );

  const recentEvent =
    await prisma.messagingModerationEvent.findFirst({
      where: {
        userId,

        conversationId,

        createdAt: {
          gte:
            since,
        },

        categories: {
          has:
            PrismaMessagingModerationCategory.phone_number,
        },
      },

      orderBy: {
        createdAt:
          "desc",
      },

      select: {
        id:
          true,
      },
    });

  return Boolean(
    recentEvent
  );
}

/*
 * =======================================================
 * RECENT SAME-SENDER MESSAGE CONTEXT
 * =======================================================
 *
 * Phone continuation based on moderation history catches
 * cases such as:
 *
 *   080
 *   391
 *   5537
 *
 * There is a separate bypass class where each individual
 * message looks harmless but the same sender's recent
 * messages clearly combine into contact-sharing intent:
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
 * Only a very small same-sender window is considered.
 * Messages from the other participant are never mixed
 * into this context.
 *
 * Reconstructed context exists only in memory for the
 * current moderation decision. It is never written to a
 * message row or moderation metadata.
 */

const CROSS_MESSAGE_CONTEXT_LIMIT =
  10;

const CROSS_MESSAGE_CONTEXT_PART_MAX_LENGTH =
  80;

type RecentSenderMessage = {
  body: string;

  createdAt: Date;
};

type CrossMessageModerationSignal = {
  categories: MessageModerationCategory[];
};

async function getRecentSenderMessages(
  userId: string,
  conversationId:
    string | null | undefined
): Promise<RecentSenderMessage[]> {
  if (
    !conversationId
  ) {
    return [];
  }

  const since =
    new Date(
      Date.now() -
        PHONE_CONTINUATION_WINDOW_MS
    );

  const messages =
    await prisma.message.findMany({
      where: {
        conversationId,

        senderId:
          userId,

        deletedAt:
          null,

        createdAt: {
          gte:
            since,
        },
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
        CROSS_MESSAGE_CONTEXT_LIMIT,

      select: {
        body:
          true,

        createdAt:
          true,
      },
    });

  return messages.reverse();
}

function normalizeCrossMessageText(
  value: string
) {
  return value
    .normalize(
      "NFKC"
    )
    .toLowerCase()
    .replace(
      /[’‘`´]/g,
      "'"
    )
    .replace(
      /([a-z])'([a-z])/g,
      "$1$2"
    )
    .replace(
      /[^a-z0-9+]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function compactCrossMessageText(
  value: string
) {
  return value
    .normalize(
      "NFKC"
    )
    .toLowerCase()
    .replace(
      /4/g,
      "a"
    )
    .replace(
      /@/g,
      "a"
    )
    .replace(
      /7/g,
      "t"
    )
    .replace(
      /[^a-z0-9]/g,
      ""
    );
}

function toCrossMessageDigit(
  character: string
): string | null {
  const code =
    character.charCodeAt(
      0
    );

  if (
    code >=
      0x30 &&
    code <=
      0x39
  ) {
    return character;
  }

  if (
    code >=
      0x0660 &&
    code <=
      0x0669
  ) {
    return String(
      code -
        0x0660
    );
  }

  if (
    code >=
      0x06f0 &&
    code <=
      0x06f9
  ) {
    return String(
      code -
        0x06f0
    );
  }

  if (
    code >=
      0xff10 &&
    code <=
      0xff19
  ) {
    return String(
      code -
        0xff10
    );
  }

  return null;
}

function extractStandaloneNumericFragment(
  value: string
) {
  const normalized =
    value
      .normalize(
        "NFKC"
      )
      .toLowerCase()
      .trim();

  /*
   * First support fragments written as number words or a
   * mixture of number words and ordinary digits:
   *
   *   eight
   *   zero eight
   *   8 zero 3
   */

  const numberWordMap:
    Record<
      string,
      string
    > = {
      zero:
        "0",

      oh:
        "0",

      one:
        "1",

      two:
        "2",

      three:
        "3",

      four:
        "4",

      five:
        "5",

      six:
        "6",

      seven:
        "7",

      eight:
        "8",

      nine:
        "9",
    };

  const wordTokens =
    normalized
      .split(
        /[\s().,\-_/"'’‘“”:;|~+\u200B\u200C\u200D\uFEFF]+/u
      )
      .filter(
        Boolean
      );

  if (
    wordTokens.length >
    0
  ) {
    let wordDigits =
      "";

    let validWordSequence =
      true;

    for (
      const token
      of wordTokens
    ) {
      if (
        numberWordMap[
          token
        ]
      ) {
        wordDigits +=
          numberWordMap[
            token
          ];

        continue;
      }

      let tokenDigits =
        "";

      let tokenIsDigits =
        true;

      for (
        const character
        of token
      ) {
        const digit =
          toCrossMessageDigit(
            character
          );

        if (
          digit ===
          null
        ) {
          tokenIsDigits =
            false;

          break;
        }

        tokenDigits +=
          digit;
      }

      if (
        tokenIsDigits &&
        tokenDigits
      ) {
        wordDigits +=
          tokenDigits;

        continue;
      }

      validWordSequence =
        false;

      break;
    }

    if (
      validWordSequence &&
      wordDigits.length >=
        1 &&
      wordDigits.length <=
        13
    ) {
      return wordDigits;
    }
  }

  /*
   * Fall back to symbol/filler-aware numeric extraction:
   *
   *   8x0x3
   *   080📱355
   */

  let digits =
    "";

  let meaningfulNonDigit =
    false;

  for (
    const character
    of value.normalize(
      "NFKC"
    )
  ) {
    const digit =
      toCrossMessageDigit(
        character
      );

    if (
      digit !==
      null
    ) {
      digits +=
        digit;

      continue;
    }

    if (
      /[\s().,\-_/"'’‘“”:;|~+\u200B\u200C\u200D\uFEFF]/u.test(
        character
      )
    ) {
      continue;
    }

    if (
      character ===
        "x" ||
      character ===
        "X"
    ) {
      continue;
    }

    meaningfulNonDigit =
      true;

    break;
  }

  if (
    meaningfulNonDigit ||
    digits.length <
      1 ||
    digits.length >
      13
  ) {
    return null;
  }

  return digits;
}

function containsNigerianPhoneShape(
  digits: string
) {
  /*
   * Local number.
   */

  for (
    let start =
      0;
    start +
        11 <=
      digits.length;
    start +=
      1
  ) {
    if (
      /^0[789]\d{9}$/.test(
        digits.slice(
          start,
          start +
            11
        )
      )
    ) {
      return true;
    }
  }

  /*
   * Country-code number.
   */

  for (
    let start =
      0;
    start +
        13 <=
      digits.length;
    start +=
      1
  ) {
    if (
      /^234[789]\d{9}$/.test(
        digits.slice(
          start,
          start +
            13
        )
      )
    ) {
      return true;
    }
  }

  /*
   * A 10-digit no-leading-zero Nigerian mobile shape is
   * accepted here only when it had to be assembled from
   * multiple separate messages.
   */

  return /^[789]\d{9}$/.test(
    digits
  );
}

function hasSplitPlatformName(
  parts: string[]
) {
  if (
    parts.length <
      2
  ) {
    return false;
  }

  const platformPatterns =
    [
      "whatsapp",
      "whatsap",
      "watsapp",
      "watsap",
      "whatapp",
      "whtsapp",
      "telegram",
      "instagram",
      "snapchat",
      "tiktok",
      "facebook",
      "discord",
      "signal",
      "greenapp",
    ];

  const compactParts =
    parts.map(
      compactCrossMessageText
    );

  const combined =
    compactParts.join(
      ""
    );

  return platformPatterns.some(
    (
      platform
    ) => {
      if (
        !combined.includes(
          platform
        )
      ) {
        return false;
      }

      /*
       * This helper is specifically for a platform name
       * split across message boundaries.
       *
       * If one individual message already contains the
       * full platform name, normal single-message
       * moderation owns that case.
       */

      return !compactParts.some(
        (
          part
        ) =>
          part.includes(
            platform
          )
      );
    }
  );
}

function hasCrossMessageContactIntent(
  parts: string[]
) {
  if (
    parts.length <
      2
  ) {
    return false;
  }

  const text =
    normalizeCrossMessageText(
      parts.join(
        " "
      )
    );

  const patterns =
    [
      /\b(?:what|wat|wats|whats|wht)\s+(?:(?:is|are)\s+)?(?:your|ur|ya)\s+(?:number|num|digits?|line|contact|handle|username|whatsapp|wa|telegram|tg|instagram|ig)\b/i,

      /\b(?:your|ur|ya)\s+(?:number|num|digits?|line|contact|handle|username|whatsapp|wa|telegram|tg|instagram|ig)\b/i,

      /\b(?:send|drop|give|share|pass|gimme)\b.{0,35}\b(?:(?:your|ur|ya)\s+)?(?:number|num|digits?|line|contact|handle|username|whatsapp|wa|telegram|tg|instagram|ig)\b/i,

      /\b(?:lemme|let\s+me)\b.{0,30}\b(?:get|have)\b.{0,20}\b(?:(?:your|ur|ya)\s+)?(?:number|num|digits?|line|contact|handle|username|whatsapp|wa|telegram|tg|instagram|ig)\b/i,

      /\b(?:should|shall|can|could|would|may|maybe|lets)\b.{0,20}\b(?:we|i|you|u)?\b.{0,20}\b(?:text|txt|message|msg|dm|chat|talk|call|continue|move|switch|use|go)\b.{0,25}\b(?:whatsapp|wa|wapp|telegram|tg|instagram|ig|insta|snap|green\s+app|another\s+app|other\s+app)\b/i,

      /\b(?:can|could|may)\s+i\b.{0,25}\b(?:get|have|call|text|txt|message|msg|reach|contact)\b.{0,25}\b(?:you|u|your|ur|ya)\b/i,

      /\b(?:how|where)\b.{0,20}\b(?:can|could|do)\s+i\b.{0,25}\b(?:reach|contact|text|message|call|get\s+in\s+touch\s+with)\b.{0,20}\b(?:you|u)\b/i,

      /\b(?:move|take|continue|switch|go|talk|chat|message|text)\b.{0,40}\b(?:somewhere\s+else|elsewhere|another\s+app|other\s+app|off\s+platform|outside\s+campusmart)\b/i,
    ];

  return patterns.some(
    (
      pattern
    ) =>
      pattern.test(
        text
      )
  );
}

function hasCrossMessagePhoneDisclosure(
  parts: string[]
) {
  if (
    parts.length <
      2
  ) {
    return false;
  }

  const current =
    parts[
      parts.length -
        1
    ];

  const currentDigits =
    extractStandaloneNumericFragment(
      current
    );

  if (
    !currentDigits
  ) {
    return false;
  }

  const previousText =
    normalizeCrossMessageText(
      parts
        .slice(
          0,
          -1
        )
        .join(
          " "
        )
    );

  const personalPhoneSetup =
    /\b(?:my|the)\s+(?:phone\s+)?(?:number|num|digits?|line)\s*(?:is|are)?\s*$|\b(?:contact|reach|call|text)\s+me\s+(?:on|at)\s*$|\b(?:my\s+)?(?:whatsapp|wa)\s*(?:is|:|=)?\s*$/i;

  /*
   * Example:
   *
   * my
   * number is
   * 8035535266
   */

  if (
    personalPhoneSetup.test(
      previousText
    ) &&
    /^[789]\d{9}$/.test(
      currentDigits
    )
  ) {
    return true;
  }

  /*
   * Also detect a phone number assembled entirely from
   * standalone numeric fragments across messages:
   *
   *   80355
   *   35266
   *
   *   08
   *   0355
   *   35266
   *
   *   234
   *   80355
   *   35266
   */

  const numericParts =
    parts.map(
      extractStandaloneNumericFragment
    );

  if (
    numericParts.some(
      (
        part
      ) =>
        !part
    )
  ) {
    return false;
  }

  const reconstructed =
    (
      numericParts as string[]
    ).join(
      ""
    );

  /*
   * If multiple messages themselves assemble a Nigerian
   * local prefix, stop the sequence early instead of
   * waiting for all eleven digits.
   *
   * Examples:
   *
   *   0
   *   8
   *   0
   *
   *   08
   *   03
   *
   * Existing single-message partial-prefix moderation
   * already owns the equivalent one-message case.
   */

  if (
    reconstructed.length >=
      3 &&
    reconstructed.length <=
      10 &&
    /^0[789]\d{1,8}$/.test(
      reconstructed
    )
  ) {
    return true;
  }

  /*
   * Same idea for a country-code number assembled across
   * message boundaries.
   */

  if (
    reconstructed.length >=
      4 &&
    reconstructed.length <=
      12 &&
    /^234[789]\d{0,8}$/.test(
      reconstructed
    )
  ) {
    return true;
  }

  return containsNigerianPhoneShape(
    reconstructed
  );
}

function detectCrossMessageModerationSignal(
  recentMessages:
    RecentSenderMessage[],
  currentBody: string
): CrossMessageModerationSignal | null {
  if (
    recentMessages.length ===
    0
  ) {
    return null;
  }

  /*
   * Only short recent messages are useful for deliberate
   * fragment reconstruction.
   *
   * Stop at a longer message so an old paragraph is not
   * accidentally combined with a new unrelated message.
   */

  const recentShortParts:
    string[] = [];

  for (
    let index =
      recentMessages.length -
        1;
    index >=
      0;
    index -=
      1
  ) {
    const body =
      recentMessages[
        index
      ].body.trim();

    if (
      !body ||
      body.length >
        CROSS_MESSAGE_CONTEXT_PART_MAX_LENGTH
    ) {
      break;
    }

    recentShortParts.unshift(
      body
    );
  }

  if (
    recentShortParts.length ===
      0
  ) {
    return null;
  }

  /*
   * Test progressively larger suffixes so a harmless
   * earlier message does not poison the newest context.
   */

  for (
    let count =
      1;
    count <=
      Math.min(
        recentShortParts.length,
        9
      );
    count +=
      1
  ) {
    const parts =
      [
        ...recentShortParts.slice(
          -count
        ),
        currentBody,
      ];

    /*
     * Phone reconstruction can use up to ten total
     * fragments.
     */

    if (
      count <=
        9 &&
      hasCrossMessagePhoneDisclosure(
        parts
      )
    ) {
      return {
        categories: [
          "phone_number",
          "circumvention",
        ],
      };
    }

    /*
     * A platform name may be split extremely finely:
     *
     * w
     * h
     * a
     * t
     * s
     * app
     */

    if (
      hasSplitPlatformName(
        parts
      )
    ) {
      return {
        categories: [
          "circumvention",
        ],
      };
    }

    /*
     * Natural-language intent is deliberately kept to a
     * tighter context to avoid joining unrelated short
     * messages from a longer conversation.
     */

    if (
      count <=
        3 &&
      hasCrossMessageContactIntent(
        parts
      )
    ) {
      return {
        categories: [
          "circumvention",
        ],
      };
    }
  }

  return null;
}

function mergeModerationCategories(
  first:
    MessageModerationCategory[],
  second:
    MessageModerationCategory[]
) {
  return Array.from(
    new Set([
      ...first,
      ...second,
    ])
  );
}

/*
 * =======================================================
 * CONTEXTUAL PRODUCT-PLATFORM EXEMPTION
 * =======================================================
 *
 * Single-message moderation intentionally blocks a bare:
 *
 *   WhatsApp?
 *
 * because, by itself, it strongly suggests moving the
 * conversation off CampusMart.
 *
 * But the same fragment can be legitimate when it clearly
 * completes a product-capability question from the SAME
 * sender in the SAME conversation:
 *
 *   Does this phone support
 *   WhatsApp?
 *
 * We only reconsider blocks that contain no sensitive
 * spans and are categorised purely as circumvention.
 *
 * Phone numbers, emails, handles, links and other direct
 * sensitive content can never be downgraded here.
 */

function isPlatformOnlyProductFragment(
  body: string
) {
  const text =
    normalizeCrossMessageText(
      body
    );

  return /^(?:whatsapp|telegram|instagram|snapchat|tiktok|facebook|discord|signal|messenger)(?:\s+(?:app|apps|notification|notifications))?$/.test(
    text
  );
}

function isProductCapabilityLead(
  value: string
) {
  const text =
    normalizeCrossMessageText(
      value
    );

  const patterns =
    [
      /\b(?:does|do|can|could|will|would)\s+(?:this|that|the)\s+(?:phone|tablet|laptop|watch|smartwatch|device|item|product)\b.{0,45}\b(?:support|supports|run|runs|use|uses|have|has|show|shows|display|displays|install|work|works|open|handle)\s*$/i,

      /\b(?:is|are)\s+(?:this|that|the)\s+(?:phone|tablet|laptop|watch|smartwatch|device|item|product)\b.{0,45}\b(?:compatible\s+with|able\s+to\s+run|able\s+to\s+use)\s*$/i,

      /\b(?:does|do|can|could|will|would)\s+(?:it|this|that)\b.{0,35}\b(?:support|run|use|have|show|display|install|work\s+with|open)\s*$/i,
    ];

  return patterns.some(
    (
      pattern
    ) =>
      pattern.test(
        text
      )
  );
}

function canAllowBlockedPlatformFragmentFromProductContext(
  recentMessages:
    RecentSenderMessage[],
  currentBody: string,
  moderation:
    ReturnType<
      typeof moderateOutgoingMessage
    >,
  recentPhoneSharingAttempt:
    boolean
) {
  if (
    recentPhoneSharingAttempt ||
    moderation.action !==
      "blocked" ||
    moderation.findings.length >
      0 ||
    moderation.categories.length ===
      0 ||
    moderation.categories.some(
      (
        category
      ) =>
        category !==
        "circumvention"
    ) ||
    !isPlatformOnlyProductFragment(
      currentBody
    )
  ) {
    return false;
  }

  const recentShortParts:
    string[] = [];

  for (
    let index =
      recentMessages.length -
        1;
    index >=
      0 &&
    recentShortParts.length <
      3;
    index -=
      1
  ) {
    const body =
      recentMessages[
        index
      ].body.trim();

    if (
      !body ||
      body.length >
        CROSS_MESSAGE_CONTEXT_PART_MAX_LENGTH
    ) {
      break;
    }

    recentShortParts.unshift(
      body
    );
  }

  if (
    recentShortParts.length ===
      0
  ) {
    return false;
  }

  for (
    let count =
      1;
    count <=
      recentShortParts.length;
    count +=
      1
  ) {
    const previousParts =
      recentShortParts.slice(
        -count
      );

    const previousText =
      previousParts.join(
        " "
      );

    if (
      !isProductCapabilityLead(
        previousText
      )
    ) {
      continue;
    }

    const combined =
      [
        ...previousParts,
        currentBody,
      ].join(
        " "
      );

    /*
     * Ask the existing single-message moderation engine to
     * validate the reconstructed sentence as one unit.
     *
     * We only downgrade when that canonical moderation
     * result itself considers the complete product
     * question safe.
     */

    const combinedModeration =
      moderateOutgoingMessage(
        combined,
        {
          recentPhoneSharingAttempt:
            false,
        }
      );

    if (
      combinedModeration.action ===
        "allow"
    ) {
      return true;
    }
  }

  return false;
}

function allowContextualProductPlatformFragment(
  prepared: {
    originalBody: string;

    body: string;

    moderation:
      ReturnType<
        typeof moderateOutgoingMessage
      >;
  }
) {
  return {
    ...prepared,

    body:
      prepared.originalBody,

    moderation: {
      ...prepared.moderation,

      sanitizedBody:
        prepared.originalBody,

      action:
        "allow" as const,

      categories:
        [],

      findings:
        [],

      warningRequired:
        false,

      shouldRecordModerationEvent:
        false,

      warningCode:
        null,
    },
  };
}

function promoteToContextualBlock(
  base:
    ReturnType<
      typeof moderateOutgoingMessage
    >,
  signal:
    CrossMessageModerationSignal
): ReturnType<
  typeof moderateOutgoingMessage
> {
  return {
    ...base,

    action:
      "blocked",

    categories:
      mergeModerationCategories(
        base.categories,
        signal.categories
      ),

    /*
     * Findings belong only to spans in the current
     * message.
     *
     * We intentionally do not copy offsets from
     * reconstructed historical context.
     */

    findings:
      base.findings,

    warningRequired:
      true,

    shouldRecordModerationEvent:
      true,

    warningCode:
      "OFF_PLATFORM_ATTEMPT_BLOCKED",
  };
}

/*
 * =======================================================
 * MODERATION CATEGORY MAPPING
 * =======================================================
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
 */

function prepareOutgoingMessage(
  value: unknown,
  options?: {
    recentPhoneSharingAttempt?: boolean;
  }
) {
  const normalizedBody =
    normalizeMessageBody(
      value
    );

  const moderation =
    moderateOutgoingMessage(
      normalizedBody,
      {
        recentPhoneSharingAttempt:
          options
            ?.recentPhoneSharingAttempt ??
          false,
      }
    );

  return {
    originalBody:
      normalizedBody,

    body:
      moderation.sanitizedBody,

    moderation,
  };
}

async function prepareOutgoingMessageWithConversationContext(
  value: unknown,
  options: {
    userId: string;

    conversationId?:
      string | null;

    recentPhoneSharingAttempt?: boolean;
  }
) {
  const prepared =
    prepareOutgoingMessage(
      value,
      {
        recentPhoneSharingAttempt:
          options
            .recentPhoneSharingAttempt ??
          false,
      }
    );

  if (
    !options.conversationId
  ) {
    return prepared;
  }

  const recentMessages =
    await getRecentSenderMessages(
      options.userId,
      options.conversationId
    );

  /*
   * A bare platform fragment is normally blocked, but we
   * allow a very narrow contextual exception when it
   * clearly completes a legitimate product-capability
   * question from this same sender.
   *
   * Example:
   *
   *   Does this phone support
   *   WhatsApp?
   *
   * Direct sensitive content can never enter this branch.
   */

  if (
    prepared.moderation.action ===
      "blocked"
  ) {
    if (
      canAllowBlockedPlatformFragmentFromProductContext(
        recentMessages,
        prepared.originalBody,
        prepared.moderation,
        options
          .recentPhoneSharingAttempt ??
        false
      )
    ) {
      return allowContextualProductPlatformFragment(
        prepared
      );
    }

    return prepared;
  }

  const contextualSignal =
    detectCrossMessageModerationSignal(
      recentMessages,
      prepared.originalBody
    );

  if (
    !contextualSignal
  ) {
    return prepared;
  }

  return {
    ...prepared,

    moderation:
      promoteToContextualBlock(
        prepared.moderation,
        contextualSignal
      ),
  };
}

/*
 * =======================================================
 * REPLY TARGET
 * =======================================================
 */

async function resolveReplyTarget(
  conversationId: string,
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
      "Reply message ID must be a string.",
      400,
      "INVALID_REPLY_MESSAGE_ID"
    );
  }

  const replyToMessageId =
    value.trim();

  if (
    !replyToMessageId
  ) {
    return null;
  }

  const target =
    await prisma.message.findFirst({
      where: {
        id:
          replyToMessageId,

        conversationId,

        deletedAt:
          null,
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

        createdAt:
          true,
      },
    });

  if (
    !target
  ) {
    throw new MessagingError(
      "The message you are replying to could not be found in this conversation.",
      404,
      "REPLY_MESSAGE_NOT_FOUND"
    );
  }

  return target;
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

  if (
    order.buyerId ===
    input.actorId
  ) {
    let vendorId =
      typeof input.vendorId ===
        "string"
        ? input.vendorId.trim()
        : "";

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
 * RECEIPT MESSAGE RESOLUTION
 * =======================================================
 */

async function resolveIncomingReceiptMessage(
  conversationId: string,
  userId: string,
  messageId?: string | null
) {
  const cleanMessageId =
    typeof messageId ===
      "string"
      ? messageId.trim()
      : "";

  if (
    cleanMessageId
  ) {
    const message =
      await prisma.message.findUnique({
        where: {
          id:
            cleanMessageId,
        },

        select: {
          id:
            true,

          conversationId:
            true,

          senderId:
            true,

          createdAt:
            true,
        },
      });

    if (
      !message ||
      message.conversationId !==
        conversationId
    ) {
      throw new MessagingError(
        "Receipt message was not found in this conversation.",
        404,
        "RECEIPT_MESSAGE_NOT_FOUND"
      );
    }

    if (
      message.senderId ===
      userId
    ) {
      throw new MessagingError(
        "You cannot acknowledge your own outgoing message.",
        400,
        "INVALID_RECEIPT_MESSAGE"
      );
    }

    return message;
  }

  return prisma.message.findFirst({
    where: {
      conversationId,

      senderId: {
        not:
          userId,
      },
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

    select: {
      id:
        true,

      conversationId:
        true,

      senderId:
        true,

      createdAt:
        true,
    },
  });
}

/*
 * =======================================================
 * START CONVERSATION + FIRST MESSAGE
 * =======================================================
 */

export async function startConversationWithMessage(
  input: StartConversationInput
) {
  /*
   * Existing messaging restrictions always run first.
   */

  await assertMessagingAllowed(
    input.actorId
  );

  /*
   * Resolve the actual buyer/seller/context before
   * moderation-history lookup.
   */

  const context =
    await resolveConversationContext(
      input
    );

  /*
   * There may already be a canonical conversation for
   * this buyer/seller/context.
   *
   * This matters because "start conversation" can also
   * be used against a conversation that already exists.
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
   * Activate strict numeric continuation scanning only
   * when this same user recently attempted to share a
   * phone number in this exact conversation.
   */

  const recentPhoneSharingAttempt =
    await hasRecentPhoneSharingAttempt(
      input.actorId,
      existingConversation
        ?.id ??
        null
    );

  const prepared =
    await prepareOutgoingMessageWithConversationContext(
      input.body,
      {
        userId:
          input.actorId,

        conversationId:
          existingConversation
            ?.id ??
          null,

        recentPhoneSharingAttempt,
      }
    );

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

              buyerLastDeliveredAt:
                null,

              vendorLastDeliveredAt:
                null,

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
            },
          });

        const message =
          await tx.message.create({
            data: {
              conversationId:
                conversation.id,

              senderId:
                input.actorId,

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

              replyToMessageId:
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
   * A redacted first message may have created the
   * conversation only AFTER its moderation event was
   * recorded.
   *
   * Link the event now so future continuation checks can
   * find it by conversation ID.
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
   * ---------------------------------------------------
   * 1. EXISTING RESTRICTION
   * ---------------------------------------------------
   */

  await assertMessagingAllowed(
    input.senderId
  );

  /*
   * ---------------------------------------------------
   * 2. CONVERSATION ACCESS
   * ---------------------------------------------------
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
   * ---------------------------------------------------
   * 3. CROSS-MESSAGE MODERATION HISTORY
   * ---------------------------------------------------
   *
   * The moderation-event lookup activates the existing
   * strict phone-continuation mode.
   *
   * The preparation step below separately reads only a
   * small, recent, same-sender message window so split
   * contact intent can be evaluated transiently.
   */

  const recentPhoneSharingAttempt =
    await hasRecentPhoneSharingAttempt(
      input.senderId,
      conversation.id
    );

  /*
   * ---------------------------------------------------
   * 4. MESSAGE BODY + MODERATION
   * ---------------------------------------------------
   */

  const prepared =
    await prepareOutgoingMessageWithConversationContext(
      input.body,
      {
        userId:
          input.senderId,

        conversationId:
          conversation.id,

        recentPhoneSharingAttempt,
      }
    );

  /*
   * ---------------------------------------------------
   * 5. VALIDATE REPLY TARGET
   * ---------------------------------------------------
   */

  const replyTarget =
    await resolveReplyTarget(
      conversation.id,
      input.replyToMessageId
    );

  /*
   * ---------------------------------------------------
   * 6. RECORD MODERATION
   * ---------------------------------------------------
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
   * ---------------------------------------------------
   * 7. BLOCK WHEN REQUIRED
   * ---------------------------------------------------
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
   * ---------------------------------------------------
   * 8. STORE ALLOWED / SANITIZED MESSAGE
   * ---------------------------------------------------
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

              replyToMessageId:
                replyTarget?.id ??
                null,
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
   * ---------------------------------------------------
   * 9. LINK REDACTION EVENT
   * ---------------------------------------------------
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
 * MARK CONVERSATION DELIVERED
 * =======================================================
 */

export async function markConversationDelivered(
  conversationId: string,
  userId: string,
  deliveredThroughMessageId?:
    string | null
) {
  const {
    conversation,
    side,
  } =
    await getConversationAccess(
      conversationId,
      userId
    );

  const receiptMessage =
    await resolveIncomingReceiptMessage(
      conversation.id,
      userId,
      deliveredThroughMessageId
    );

  if (
    !receiptMessage
  ) {
    return {
      conversationId:
        conversation.id,

      deliveredAt:
        side ===
        "buyer"
          ? conversation
              .buyerLastDeliveredAt
          : conversation
              .vendorLastDeliveredAt,

      deliveredThroughMessageId:
        null,
    };
  }

  const existingDeliveredAt =
    side ===
    "buyer"
      ? conversation
          .buyerLastDeliveredAt
      : conversation
          .vendorLastDeliveredAt;

  const nextDeliveredAt =
    laterDate(
      existingDeliveredAt,
      receiptMessage.createdAt
    );

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
              buyerLastDeliveredAt:
                nextDeliveredAt,
            }
          : {
              vendorLastDeliveredAt:
                nextDeliveredAt,
            },

      select: {
        id:
          true,

        buyerLastDeliveredAt:
          true,

        vendorLastDeliveredAt:
          true,

        buyerLastReadAt:
          true,

        vendorLastReadAt:
          true,
      },
    });

  return {
    conversationId:
      updated.id,

    deliveredAt:
      side ===
      "buyer"
        ? updated
            .buyerLastDeliveredAt
        : updated
            .vendorLastDeliveredAt,

    deliveredThroughMessageId:
      receiptMessage.id,
  };
}

/*
 * =======================================================
 * MARK CONVERSATION READ
 * =======================================================
 */

export async function markConversationRead(
  conversationId: string,
  userId: string,
  readThroughMessageId?:
    string | null
) {
  const {
    conversation,
    side,
  } =
    await getConversationAccess(
      conversationId,
      userId
    );

  const receiptMessage =
    await resolveIncomingReceiptMessage(
      conversation.id,
      userId,
      readThroughMessageId
    );

  const requestedReadAt =
    receiptMessage
      ?.createdAt ??
    new Date();

  if (
    side ===
    "buyer"
  ) {
    const nextReadAt =
      laterDate(
        conversation
          .buyerLastReadAt,
        requestedReadAt
      );

    const nextDeliveredAt =
      receiptMessage
        ? laterDate(
            conversation
              .buyerLastDeliveredAt,
            receiptMessage
              .createdAt
          )
        : conversation
            .buyerLastDeliveredAt;

    const updated =
      await prisma.conversation.update({
        where: {
          id:
            conversation.id,
        },

        data: {
          buyerLastReadAt:
            nextReadAt,

          buyerLastDeliveredAt:
            nextDeliveredAt,
        },

        select: {
          id:
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
        },
      });

    return {
      conversationId:
        updated.id,

      deliveredAt:
        updated
          .buyerLastDeliveredAt,

      readAt:
        updated
          .buyerLastReadAt,

      readThroughMessageId:
        receiptMessage
          ?.id ??
        null,
    };
  }

  const nextReadAt =
    laterDate(
      conversation
        .vendorLastReadAt,
      requestedReadAt
    );

  const nextDeliveredAt =
    receiptMessage
      ? laterDate(
          conversation
            .vendorLastDeliveredAt,
          receiptMessage
            .createdAt
        )
      : conversation
          .vendorLastDeliveredAt;

  const updated =
    await prisma.conversation.update({
      where: {
        id:
          conversation.id,
      },

      data: {
        vendorLastReadAt:
          nextReadAt,

        vendorLastDeliveredAt:
          nextDeliveredAt,
      },

      select: {
        id:
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
      },
    });

  return {
    conversationId:
      updated.id,

    deliveredAt:
      updated
        .vendorLastDeliveredAt,

    readAt:
      updated
        .vendorLastReadAt,

    readThroughMessageId:
      receiptMessage
        ?.id ??
      null,
  };
}