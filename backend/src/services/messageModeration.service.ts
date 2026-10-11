/*
 * =======================================================
 * CAMPUSMART MESSAGE MODERATION
 * =======================================================
 *
 * Purpose:
 *
 * - Prevent contact leakage before legitimate order
 *   contact access has been unlocked.
 *
 * - Redact high-confidence sensitive information rather
 *   than blindly deleting an entire otherwise useful
 *   message.
 *
 * - Detect attempts to move communication/payment away
 *   from CampusMart.
 *
 * - Avoid storing the detected sensitive value inside
 *   moderation metadata.
 *
 * IMPORTANT:
 *
 * Payment-circumvention enforcement is feature-gated
 * because protected CampusMart payments are not live yet.
 *
 * Set:
 *
 * MESSAGING_PAYMENT_PROTECTION_ENABLED=true
 *
 * only when CampusMart's real protected payment flow is
 * ready.
 */

/*
 * =======================================================
 * TYPES
 * =======================================================
 */

export type MessageModerationCategory =
  | "phone_number"
  | "email"
  | "external_username"
  | "external_link"
  | "bank_details"
  | "off_platform_payment"
  | "circumvention";

export type MessageModerationAction =
  | "allow"
  | "redacted"
  | "blocked";

export type MessageModerationConfidence =
  | "medium"
  | "high";

export type MessageModerationFinding = {
  category: MessageModerationCategory;

  confidence: MessageModerationConfidence;

  start: number;

  end: number;
};

export type MessageModerationOptions = {
  /**
   * Defaults to the environment feature flag.
   *
   * Keep false until real protected CampusMart payments
   * exist.
   */
  paymentProtectionEnabled?: boolean;
};

export type MessageModerationResult = {
  originalLength: number;

  sanitizedBody: string;

  action: MessageModerationAction;

  categories: MessageModerationCategory[];

  findings: MessageModerationFinding[];

  warningRequired: boolean;

  shouldRecordModerationEvent: boolean;

  warningCode:
    | "CONTACT_DETAILS_REDACTED"
    | "OFF_PLATFORM_ATTEMPT_BLOCKED"
    | null;
};

type SensitiveSpan = {
  start: number;

  end: number;

  category: MessageModerationCategory;

  confidence: MessageModerationConfidence;

  replacement: string;
};

/*
 * =======================================================
 * PAYMENT PROTECTION FEATURE FLAG
 * =======================================================
 */

export function isPaymentProtectionEnabled() {
  return (
    String(
      process.env
        .MESSAGING_PAYMENT_PROTECTION_ENABLED ??
        ""
    )
      .trim()
      .toLowerCase() ===
    "true"
  );
}

/*
 * =======================================================
 * HELPERS
 * =======================================================
 */

function addSpan(
  spans: SensitiveSpan[],
  span: SensitiveSpan
) {
  if (
    span.start < 0 ||
    span.end <= span.start
  ) {
    return;
  }

  spans.push(
    span
  );
}

function starMask(
  value: string
) {
  /*
   * Preserve punctuation/spacing while hiding letters
   * and digits.
   *
   * Example:
   *
   * 0816-616-6698
   * ****-***-****
   */

  return value.replace(
    /[A-Za-z0-9]/g,
    "*"
  );
}

function emailMask(
  _value: string
) {
  return "***@***";
}

function mergeSensitiveSpans(
  spans: SensitiveSpan[]
) {
  if (
    spans.length ===
    0
  ) {
    return [];
  }

  const sorted =
    [...spans].sort(
      (
        a,
        b
      ) => {
        if (
          a.start !==
          b.start
        ) {
          return (
            a.start -
            b.start
          );
        }

        return (
          b.end -
          a.end
        );
      }
    );

  const merged: SensitiveSpan[] =
    [];

  for (
    const current
    of sorted
  ) {
    const previous =
      merged[
        merged.length -
          1
      ];

    if (
      !previous ||
      current.start >=
        previous.end
    ) {
      merged.push({
        ...current,
      });

      continue;
    }

    previous.end =
      Math.max(
        previous.end,
        current.end
      );

    if (
      current.confidence ===
      "high"
    ) {
      previous.confidence =
        "high";
    }

    previous.replacement =
      starMask(
        "x".repeat(
          previous.end -
            previous.start
        )
      );
  }

  return merged;
}

function applyRedactions(
  input: string,
  spans: SensitiveSpan[]
) {
  if (
    spans.length ===
    0
  ) {
    return input;
  }

  const sorted =
    [...spans].sort(
      (
        a,
        b
      ) =>
        b.start -
        a.start
    );

  let output =
    input;

  for (
    const span
    of sorted
  ) {
    output =
      output.slice(
        0,
        span.start
      ) +
      span.replacement +
      output.slice(
        span.end
      );
  }

  return output;
}

function uniqueCategories(
  categories: MessageModerationCategory[]
) {
  return Array.from(
    new Set(
      categories
    )
  );
}

/*
 * =======================================================
 * EMAIL DETECTION
 * =======================================================
 */

function detectEmails(
  body: string
) {
  const spans: SensitiveSpan[] =
    [];

  const regex =
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

  let match:
    RegExpExecArray | null;

  while (
    (
      match =
        regex.exec(
          body
        )
    ) !==
    null
  ) {
    addSpan(
      spans,
      {
        start:
          match.index,

        end:
          match.index +
          match[0].length,

        category:
          "email",

        confidence:
          "high",

        replacement:
          emailMask(
            match[0]
          ),
      }
    );
  }

  return spans;
}

/*
 * =======================================================
 * PHONE NUMBER DETECTION
 * =======================================================
 *
 * Covers common Nigerian forms:
 *
 * 08166166698
 * 0816 616 6698
 * 0816-616-6698
 * +2348166166698
 * +234 816 616 6698
 * 2348166166698
 */

function detectPhoneNumbers(
  body: string
) {
  const spans: SensitiveSpan[] =
    [];

  const patterns =
    [
      /*
       * Nigerian local number:
       * 0 + 10 digits.
       */
      /\b0(?:[\s().-]*\d){10}\b/g,

      /*
       * Nigerian country-code forms.
       */
      /(?:\+234|234)(?:[\s().-]*\d){10}\b/g,

      /*
       * Explicit international numbers.
       */
      /\+\d{1,3}(?:[\s().-]*\d){7,12}\b/g,
    ];

  for (
    const regex
    of patterns
  ) {
    let match:
      RegExpExecArray | null;

    while (
      (
        match =
          regex.exec(
            body
          )
      ) !==
      null
    ) {
      addSpan(
        spans,
        {
          start:
            match.index,

          end:
            match.index +
            match[0].length,

          category:
            "phone_number",

          confidence:
            "high",

          replacement:
            starMask(
              match[0]
            ),
        }
      );
    }
  }

  return spans;
}

/*
 * =======================================================
 * NUMBER-WORD OBFUSCATION
 * =======================================================
 *
 * Examples:
 *
 * zero eight one six six one six six six nine eight
 */

function detectSpelledPhoneNumbers(
  body: string
) {
  const spans: SensitiveSpan[] =
    [];

  const regex =
    /\b(?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\s*(?:[-.,]\s*)?){7,15}\b/gi;

  let match:
    RegExpExecArray | null;

  while (
    (
      match =
        regex.exec(
          body
        )
    ) !==
    null
  ) {
    addSpan(
      spans,
      {
        start:
          match.index,

        end:
          match.index +
          match[0].length,

        category:
          "phone_number",

        confidence:
          "medium",

        replacement:
          starMask(
            match[0]
          ),
      }
    );
  }

  return spans;
}

/*
 * =======================================================
 * EXTERNAL CONTACT LINKS
 * =======================================================
 */

function detectExternalContactLinks(
  body: string
) {
  const spans: SensitiveSpan[] =
    [];

  const regex =
    /\b(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com|whatsapp\.com|t\.me|telegram\.me|instagram\.com|instagr\.am|snapchat\.com|tiktok\.com|twitter\.com|x\.com|facebook\.com|fb\.me)\/[^\s]+/gi;

  let match:
    RegExpExecArray | null;

  while (
    (
      match =
        regex.exec(
          body
        )
    ) !==
    null
  ) {
    addSpan(
      spans,
      {
        start:
          match.index,

        end:
          match.index +
          match[0].length,

        category:
          "external_link",

        confidence:
          "high",

        replacement:
          starMask(
            match[0]
          ),
      }
    );
  }

  return spans;
}

/*
 * =======================================================
 * EXTERNAL USERNAMES / HANDLES
 * =======================================================
 *
 * Context-aware.
 *
 * Examples:
 *
 * IG: @johnstore
 * instagram johnstore
 * Telegram @johnstore
 * snap me johndoe
 */

function detectExternalUsernames(
  body: string
) {
  const spans: SensitiveSpan[] =
    [];

  const patterns =
    [
      /\b(?:instagram|insta|ig|telegram|tg|tiktok|snapchat|snap|twitter|x)\s*(?:username|user|handle|is|:|=|-)?\s*@?([A-Z0-9._]{3,30})\b/gi,

      /\b(?:snap|snapchat|telegram|instagram|insta|ig|tiktok|twitter)\s+(?:me\s+)?(?:on\s+)?@?([A-Z0-9._]{3,30})\b/gi,
    ];

  for (
    const regex
    of patterns
  ) {
    let match:
      RegExpExecArray | null;

    while (
      (
        match =
          regex.exec(
            body
          )
      ) !==
      null
    ) {
      const captured =
        match[1];

      if (
        !captured
      ) {
        continue;
      }

      const relativeIndex =
        match[0]
          .toLowerCase()
          .lastIndexOf(
            captured.toLowerCase()
          );

      if (
        relativeIndex <
        0
      ) {
        continue;
      }

      const start =
        match.index +
        relativeIndex;

      const end =
        start +
        captured.length;

      addSpan(
        spans,
        {
          start,

          end,

          category:
            "external_username",

          confidence:
            "high",

          replacement:
            starMask(
              captured
            ),
        }
      );
    }
  }

  return spans;
}

/*
 * =======================================================
 * BANK ACCOUNT DETECTION
 * =======================================================
 *
 * Bank enforcement remains disabled until protected
 * CampusMart payments are enabled.
 */

function detectBankDetails(
  body: string
) {
  const spans: SensitiveSpan[] =
    [];

  const numberRegex =
    /\b\d(?:[\s-]?\d){9}\b/g;

  const bankContextRegex =
    /\b(?:account|acct|bank|transfer|send\s+money|payment|pay\s+to|opay|o-pay|palmpay|palm\s*pay|moniepoint|kuda|gtbank|gtb|access\s+bank|uba|zenith|first\s+bank|fcmb|fidelity|sterling|wema|alat|ecobank|stanbic|standard\s+chartered|union\s+bank)\b/i;

  let match:
    RegExpExecArray | null;

  while (
    (
      match =
        numberRegex.exec(
          body
        )
    ) !==
    null
  ) {
    const contextStart =
      Math.max(
        0,
        match.index -
          50
      );

    const contextEnd =
      Math.min(
        body.length,
        match.index +
          match[0].length +
          50
      );

    const context =
      body.slice(
        contextStart,
        contextEnd
      );

    if (
      !bankContextRegex.test(
        context
      )
    ) {
      continue;
    }

    addSpan(
      spans,
      {
        start:
          match.index,

        end:
          match.index +
          match[0].length,

        category:
          "bank_details",

        confidence:
          "high",

        replacement:
          starMask(
            match[0]
          ),
      }
    );
  }

  return spans;
}

/*
 * =======================================================
 * CONTACT-CIRCUMVENTION LANGUAGE
 * =======================================================
 *
 * Detect explicit attempts to move communication away
 * from CampusMart.
 *
 * IMPORTANT:
 *
 * Physical meetup coordination remains allowed.
 *
 * Examples that SHOULD be blocked:
 *
 * "Let's move this conversation to WhatsApp."
 * "Let's move this chat to Telegram."
 * "Continue on WhatsApp."
 * "DM me on Instagram."
 *
 * Examples that should remain allowed:
 *
 * "Meet me by the library at 4:30."
 * "I'll be outside your faculty."
 */

function detectsContactCircumvention(
  body: string
) {
  const externalPlatform =
    "(?:whatsapp|telegram|instagram|insta|ig|snapchat|snap|tiktok|twitter)";

  const patterns =
    [
      /*
       * "WhatsApp me"
       * "Telegram me"
       */
      new RegExp(
        `\\b${externalPlatform}\\s+(?:me|us)\\b`,
        "i"
      ),

      /*
       * "message me on WhatsApp"
       * "DM me via Instagram"
       */
      new RegExp(
        `\\b(?:message|dm|text|contact)\\s+(?:me|us)\\s+(?:on|through|via)\\s+${externalPlatform}\\b`,
        "i"
      ),

      /*
       * FIXED:
       *
       * "move this conversation to WhatsApp"
       * "move this chat to WhatsApp"
       * "take the conversation to Telegram"
       * "move conversation over to Instagram"
       */
      new RegExp(
        `\\b(?:move|take)\\s+(?:(?:this|the)\\s+)?(?:chat|conversation|discussion|messages?)\\s+(?:to|onto|over\\s+to)\\s+${externalPlatform}\\b`,
        "i"
      ),

      /*
       * "move this to WhatsApp"
       * "take it to Telegram"
       */
      new RegExp(
        `\\b(?:move|take)\\s+(?:this|it)\\s+(?:to|onto|over\\s+to)\\s+${externalPlatform}\\b`,
        "i"
      ),

      /*
       * "let's talk on WhatsApp"
       * "we can continue via Telegram"
       */
      new RegExp(
        `\\b(?:let'?s|we\\s+can)\\s+(?:talk|chat|continue|message)\\s+(?:on|via|through)\\s+${externalPlatform}\\b`,
        "i"
      ),

      /*
       * "continue on WhatsApp"
       * "chat via Telegram"
       */
      new RegExp(
        `\\b(?:continue|talk|chat|message)\\s+(?:on|via|through)\\s+${externalPlatform}\\b`,
        "i"
      ),

      /*
       * "switch to WhatsApp"
       * "use Telegram instead"
       */
      new RegExp(
        `\\b(?:switch\\s+to|use)\\s+${externalPlatform}(?:\\s+instead)?\\b`,
        "i"
      ),
    ];

  return patterns.some(
    (
      pattern
    ) =>
      pattern.test(
        body
      )
  );
}

/*
 * =======================================================
 * OFF-PLATFORM PAYMENT LANGUAGE
 * =======================================================
 *
 * Detection exists now.
 *
 * Blocking is enabled only when CampusMart's protected
 * payment flow is live.
 */

function detectsOffPlatformPayment(
  body: string
) {
  const patterns =
    [
      /\b(?:pay|send|transfer)\s+(?:me\s+)?(?:direct|directly)\b/i,

      /\b(?:pay|send|transfer)\s+(?:outside|off)\s+(?:campusmart|the\s+app|the\s+platform)\b/i,

      /\b(?:avoid|skip|bypass)\s+(?:the\s+)?(?:campusmart\s+)?(?:fee|fees|commission|checkout|payment)\b/i,

      /\b(?:let'?s|we\s+can)\s+(?:do|handle)\s+(?:the\s+)?(?:payment|transfer|deal)\s+(?:outside|off)\s+(?:campusmart|the\s+app|the\s+platform)\b/i,

      /\b(?:cash|bank\s+transfer)\s+(?:instead|outside\s+campusmart|off[-\s]?platform)\b/i,

      /\b(?:don'?t|do\s+not)\s+(?:pay|checkout)\s+(?:through|on|with)\s+campusmart\b/i,
    ];

  return patterns.some(
    (
      pattern
    ) =>
      pattern.test(
        body
      )
  );
}

/*
 * =======================================================
 * MAIN MODERATION FUNCTION
 * =======================================================
 */

export function moderateOutgoingMessage(
  body: string,
  options: MessageModerationOptions =
    {}
): MessageModerationResult {
  const paymentProtectionEnabled =
    options
      .paymentProtectionEnabled ??
    isPaymentProtectionEnabled();

  const detectedSpans: SensitiveSpan[] =
    [];

  detectedSpans.push(
    ...detectEmails(
      body
    )
  );

  detectedSpans.push(
    ...detectPhoneNumbers(
      body
    )
  );

  detectedSpans.push(
    ...detectSpelledPhoneNumbers(
      body
    )
  );

  detectedSpans.push(
    ...detectExternalContactLinks(
      body
    )
  );

  detectedSpans.push(
    ...detectExternalUsernames(
      body
    )
  );

  /*
   * Bank details only become enforceable once protected
   * CampusMart payments exist.
   */

  if (
    paymentProtectionEnabled
  ) {
    detectedSpans.push(
      ...detectBankDetails(
        body
      )
    );
  }

  const contactCircumvention =
    detectsContactCircumvention(
      body
    );

  const offPlatformPayment =
    paymentProtectionEnabled &&
    detectsOffPlatformPayment(
      body
    );

  const mergedSpans =
    mergeSensitiveSpans(
      detectedSpans
    );

  const sanitizedBody =
    applyRedactions(
      body,
      mergedSpans
    );

  const categories: MessageModerationCategory[] =
    detectedSpans.map(
      (
        span
      ) =>
        span.category
    );

  if (
    contactCircumvention
  ) {
    categories.push(
      "circumvention"
    );
  }

  if (
    offPlatformPayment
  ) {
    categories.push(
      "off_platform_payment"
    );
  }

  const unique =
    uniqueCategories(
      categories
    );

  /*
   * Explicit circumvention is blocked completely.
   *
   * Merely including contact details is redacted.
   */

  const shouldBlock =
    contactCircumvention ||
    offPlatformPayment;

  let action: MessageModerationAction =
    "allow";

  let warningCode:
    MessageModerationResult["warningCode"] =
      null;

  if (
    shouldBlock
  ) {
    action =
      "blocked";

    warningCode =
      "OFF_PLATFORM_ATTEMPT_BLOCKED";
  } else if (
    mergedSpans.length >
    0
  ) {
    action =
      "redacted";

    warningCode =
      "CONTACT_DETAILS_REDACTED";
  }

  const findings: MessageModerationFinding[] =
    mergedSpans.map(
      (
        span
      ) => ({
        category:
          span.category,

        confidence:
          span.confidence,

        start:
          span.start,

        end:
          span.end,
      })
    );

  return {
    originalLength:
      body.length,

    sanitizedBody,

    action,

    categories:
      unique,

    findings,

    warningRequired:
      action !==
      "allow",

    shouldRecordModerationEvent:
      action !==
      "allow",

    warningCode,
  };
}