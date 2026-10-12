/*
 * =======================================================
 * CAMPUSMART MESSAGE MODERATION
 * =======================================================
 *
 * Core policy:
 *
 * DIRECT CONTACT DISCLOSURE
 * -------------------------
 *
 * Someone supplies their own contact information:
 *
 *   My number is 080...
 *   Call me on 080...
 *   Instagram: @john
 *
 * => REDACT the contact information and allow the
 *    sanitized message to be stored/sent.
 *
 * Explicit WhatsApp + phone disclosure is stricter:
 *
 *   WhatsApp 080...
 *   My WhatsApp is 080...
 *
 * => BLOCK the message as an off-platform contact attempt.
 *
 *
 * CONTACT SOLICITATION / CIRCUMVENTION
 * ------------------------------------
 *
 * Someone asks for contact information or tries to move
 * the conversation away from CampusMart:
 *
 *   What's your number?
 *   Can I call you?
 *   WhatsApp?
 *   WhatsApp me.
 *   Let's move to WhatsApp.
 *   DM me on Instagram.
 *
 * => BLOCK the message.
 *
 *
 * SPLIT / OBFUSCATED CONTACT DATA
 * -------------------------------
 *
 * Phone numbers split with punctuation, filler
 * characters, words, Unicode digits, or multiple
 * messages are detected and prevented.
 *
 *
 * PAYMENT PROTECTION
 * ------------------
 *
 * Payment-circumvention enforcement remains feature
 * gated until CampusMart's protected payment flow is
 * actually live.
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
  paymentProtectionEnabled?: boolean;
  recentPhoneSharingAttempt?: boolean;
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

  category:
    MessageModerationCategory;

  confidence:
    MessageModerationConfidence;

  replacement: string;
};

type DigitPoint = {
  digit: string;
  index: number;
};

type DigitCluster = {
  points: DigitPoint[];
  digits: string;
};

type NumberWordPoint = {
  digit: string;
  start: number;
  end: number;
  cameFromWord: boolean;
};

/*
 * =======================================================
 * CONFIGURATION
 * =======================================================
 */

export const PHONE_CONTINUATION_WINDOW_MS =
  10 * 60 * 1000;

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
 * CONTEXT
 * =======================================================
 */

const PHONE_CONTEXT_REGEX =
  /\b(?:phone|number|num|digits?|mobile|telephone|tel|call|text|txt|sms|whatsapp|whats\s*app|watsapp|watsap|contact|reach|line|opay|o-pay|account|acct)\b/i;

const BENIGN_NUMBER_CONTEXT_REGEX =
  /\b(?:room|lecture|hall|order|item|quantity|qty|price|year|level|course|unit|units|seat|table|block)\b/i;

/*
 * =======================================================
 * BASIC HELPERS
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

function uniqueCategories(
  categories:
    MessageModerationCategory[]
) {
  return Array.from(
    new Set(
      categories
    )
  );
}

function digitCount(
  value: string
) {
  return (
    value.match(
      /\d/g
    )?.length ??
    0
  );
}

function contextAround(
  body: string,
  start: number,
  end: number,
  radius =
    50
) {
  return body.slice(
    Math.max(
      0,
      start -
        radius
    ),
    Math.min(
      body.length,
      end +
        radius
    )
  );
}

/*
 * =======================================================
 * INTENT NORMALIZATION
 * =======================================================
 */

function normalizeIntentText(
  body: string
) {
  return body
    .normalize(
      "NFKC"
    )
    .toLowerCase()
    .replace(
      /[â€™â€˜`Â´]/g,
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

/*
 * =======================================================
 * DIGIT NORMALIZATION
 * =======================================================
 */

function toAsciiDigit(
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

/*
 * =======================================================
 * LOOSE DIGIT SEPARATORS
 * =======================================================
 */

function isLooseDigitGap(
  gap: string
) {
  if (
    gap.length ===
    0
  ) {
    return true;
  }

  if (
    /^[\s().,\-_/"'â€™â€˜â€œâ€:;|~+\u200B\u200C\u200D\uFEFF]*$/u.test(
      gap
    )
  ) {
    return true;
  }

  if (
    gap.length <=
      6 &&
    !/[A-WYZa-wyz0-9]/.test(
      gap
    )
  ) {
    return true;
  }

  return false;
}

/*
 * =======================================================
 * DIGIT PROJECTION
 * =======================================================
 */

function buildDigitClusters(
  body: string
) {
  const allPoints:
    DigitPoint[] =
    [];

  for (
    let index =
      0;
    index <
    body.length;
    index +=
      1
  ) {
    const digit =
      toAsciiDigit(
        body[
          index
        ]
      );

    if (
      digit ===
      null
    ) {
      continue;
    }

    allPoints.push({
      digit,
      index,
    });
  }

  if (
    allPoints.length ===
    0
  ) {
    return [];
  }

  const clusters:
    DigitCluster[] =
    [];

  let current:
    DigitPoint[] =
    [
      allPoints[
        0
      ],
    ];

  for (
    let index =
      1;
    index <
    allPoints.length;
    index +=
      1
  ) {
    const next =
      allPoints[
        index
      ];

    const previous =
      current[
        current.length -
          1
      ];

    const gap =
      body.slice(
        previous.index +
          1,
        next.index
      );

    if (
      isLooseDigitGap(
        gap
      )
    ) {
      current.push(
        next
      );

      continue;
    }

    clusters.push({
      points:
        current,

      digits:
        current
          .map(
            (
              point
            ) =>
              point.digit
          )
          .join(
            ""
          ),
    });

    current =
      [
        next,
      ];
  }

  clusters.push({
    points:
      current,

    digits:
      current
        .map(
          (
            point
          ) =>
            point.digit
        )
        .join(
          ""
        ),
  });

  return clusters;
}

/*
 * =======================================================
 * NIGERIAN MOBILE STRUCTURE
 * =======================================================
 */

function isNigerianLocalPhoneDigits(
  value: string
) {
  return /^0[789]\d{9}$/.test(
    value
  );
}

function isNigerianNoZeroPhoneDigits(
  value: string
) {
  return /^[789]\d{9}$/.test(
    value
  );
}

function isNigerianCountryPhoneDigits(
  value: string
) {
  return /^234[789]\d{9}$/.test(
    value
  );
}

function isNigerianCountryPhoneWithZeroDigits(
  value: string
) {
  return /^2340[789]\d{9}$/.test(
    value
  );
}

function isNigerianPhonePrefix(
  value: string
) {
  return /^0[789]/.test(
    value
  );
}

/*
 * =======================================================
 * DIGIT WINDOW -> ORIGINAL SPAN
 * =======================================================
 */

function addDigitWindowSpan(
  spans: SensitiveSpan[],
  cluster: DigitCluster,
  startOffset: number,
  length: number,
  confidence:
    MessageModerationConfidence =
    "high"
) {
  const first =
    cluster.points[
      startOffset
    ];

  const last =
    cluster.points[
      startOffset +
        length -
        1
    ];

  if (
    !first ||
    !last
  ) {
    return;
  }

  const start =
    first.index;

  const end =
    last.index +
    1;

  addSpan(
    spans,
    {
      start,
      end,

      category:
        "phone_number",

      confidence,

      replacement:
        "*".repeat(
          end -
            start
        ),
    }
  );
}

/*
 * =======================================================
 * REDACTION
 * =======================================================
 */

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
    [
      ...spans,
    ].sort(
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

  const merged:
    SensitiveSpan[] =
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
      "*".repeat(
        previous.end -
          previous.start
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
    [
      ...spans,
    ].sort(
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

/*
 * =======================================================
 * EMAIL
 * =======================================================
 */

function detectEmails(
  body: string
) {
  const spans:
    SensitiveSpan[] =
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
          match[
            0
          ].length,

        category:
          "email",

        confidence:
          "high",

        replacement:
          emailMask(
            match[
              0
            ]
          ),
      }
    );
  }

  return spans;
}

/*
 * =======================================================
 * NUMERIC TRANSFORMATION LANGUAGE
 * =======================================================
 */

function detectsNumericTransformationLanguage(
  body: string
) {
  const text =
    normalizeIntentText(
      body
    );

  const patterns =
    [
      /\b(?:remove|delete|drop|ignore|skip|cut|minus|without)\s+(?:the\s+)?(?:first|last|starting|ending|front|back)?\s*(?:one|two|three|four|five|\d{1,3})?\s*(?:digits?|numbers?)?\b/i,

      /\b(?:take\s+off|take\s+away)\s+(?:the\s+)?(?:first|last)?\s*(?:one|two|three|four|five|\d{1,3})?\s*(?:digits?|numbers?)?\b/i,

      /\b(?:add|put|insert|prepend|prefix)\s+(?:a\s+)?(?:0|zero|one|1)\s+(?:in\s+)?(?:front|before|at\s+the\s+start|at\s+the\s+beginning)?\b/i,

      /\b(?:start|begin)\s+(?:it\s+)?with\s+(?:0|zero|1|one)\b/i,

      /\b(?:join|combine|merge|put\s+together)\s+(?:the\s+)?(?:digits?|numbers?|parts?|pieces?)\b/i,

      /\b(?:reverse|backwards|backward)\b/i,

      /\b(?:read|type|enter)\s+(?:it\s+)?backwards\b/i,

      /\b(?:remove|ignore|skip|take\s+out)\s+(?:the\s+)?(?:spaces?|commas?|dots?|full\s+stops?|dashes?|hyphens?|underscores?)\b/i,
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

/*
 * =======================================================
 * EMBEDDED PHONE WINDOWS
 * =======================================================
 */

function detectEmbeddedPhoneWindows(
  body: string
) {
  const spans:
    SensitiveSpan[] =
    [];

  const clusters =
    buildDigitClusters(
      body
    );

  for (
    const cluster
    of clusters
  ) {
    const digits =
      cluster.digits;

    for (
      let start =
        0;
      start +
          11 <=
        digits.length;
      start +=
        1
    ) {
      const candidate =
        digits.slice(
          start,
          start +
            11
        );

      if (
        isNigerianLocalPhoneDigits(
          candidate
        )
      ) {
        addDigitWindowSpan(
          spans,
          cluster,
          start,
          11
        );
      }
    }

    for (
      let start =
        0;
      start +
          13 <=
        digits.length;
      start +=
        1
    ) {
      const candidate =
        digits.slice(
          start,
          start +
            13
        );

      if (
        isNigerianCountryPhoneDigits(
          candidate
        )
      ) {
        addDigitWindowSpan(
          spans,
          cluster,
          start,
          13
        );
      }
    }

    for (
      let start =
        0;
      start +
          14 <=
        digits.length;
      start +=
        1
    ) {
      const candidate =
        digits.slice(
          start,
          start +
            14
        );

      if (
        isNigerianCountryPhoneWithZeroDigits(
          candidate
        )
      ) {
        addDigitWindowSpan(
          spans,
          cluster,
          start,
          14
        );
      }
    }

    for (
      let start =
        0;
      start +
          10 <=
        digits.length;
      start +=
        1
    ) {
      const candidate =
        digits.slice(
          start,
          start +
            10
        );

      if (
        !isNigerianNoZeroPhoneDigits(
          candidate
        )
      ) {
        continue;
      }

      const first =
        cluster.points[
          start
        ];

      const last =
        cluster.points[
          start +
            9
        ];

      if (
        !first ||
        !last
      ) {
        continue;
      }

      const context =
        contextAround(
          body,
          first.index,
          last.index +
            1,
          65
        );

      if (
        !PHONE_CONTEXT_REGEX.test(
          context
        ) &&
        !detectsNumericTransformationLanguage(
          context
        )
      ) {
        continue;
      }

      addDigitWindowSpan(
        spans,
        cluster,
        start,
        10
      );
    }
  }

  return spans;
}

/*
 * =======================================================
 * PARTIAL PHONE PREFIXES
 * =======================================================
 */

function detectPartialPhonePrefixes(
  body: string
) {
  const spans:
    SensitiveSpan[] =
    [];

  const clusters =
    buildDigitClusters(
      body
    );

  for (
    const cluster
    of clusters
  ) {
    const digits =
      cluster.digits;

    for (
      let start =
        0;
      start <
        digits.length;
      start +=
        1
    ) {
      const remaining =
        digits.slice(
          start
        );

      if (
        remaining.length <
          3 ||
        remaining.length >
          10
      ) {
        continue;
      }

      if (
        !isNigerianPhonePrefix(
          remaining
        )
      ) {
        continue;
      }

      addDigitWindowSpan(
        spans,
        cluster,
        start,
        remaining.length,
        "medium"
      );
    }
  }

  return spans;
}

/*
 * =======================================================
 * EXPLICIT INTERNATIONAL +PHONE
 * =======================================================
 */

function detectExplicitInternationalPhones(
  body: string
) {
  const spans:
    SensitiveSpan[] =
    [];

  const regex =
    /\+\d{1,3}(?:[\s().,\-_/"'â€™â€œâ€:;|]*\d){7,12}\b/g;

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
          match[
            0
          ].length,

        category:
          "phone_number",

        confidence:
          "high",

        replacement:
          starMask(
            match[
              0
            ]
          ),
      }
    );
  }

  return spans;
}

/*
 * =======================================================
 * LETTER-SUBSTITUTED PHONE NUMBERS
 * =======================================================
 */

function detectLetterSubstitutedPhones(
  body: string
) {
  const spans:
    SensitiveSpan[] =
    [];

  const regex =
    /[0-9OoIiLl](?:[\s().,\-_/"'â€™â€œâ€:;|]*[0-9OoIiLl]){7,14}/g;

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
    const raw =
      match[
        0
      ];

    if (
      !/[OoIiLl]/.test(
        raw
      )
    ) {
      continue;
    }

    const normalized =
      raw
        .replace(
          /[^0-9OoIiLl]/g,
          ""
        )
        .replace(
          /[Oo]/g,
          "0"
        )
        .replace(
          /[IiLl]/g,
          "1"
        );

    let phoneLike =
      false;

    for (
      let start =
        0;
      start +
          11 <=
        normalized.length;
      start +=
        1
    ) {
      if (
        isNigerianLocalPhoneDigits(
          normalized.slice(
            start,
            start +
              11
          )
        )
      ) {
        phoneLike =
          true;

        break;
      }
    }

    if (
      !phoneLike
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
          raw.length,

        category:
          "phone_number",

        confidence:
          "high",

        replacement:
          starMask(
            raw
          ),
      }
    );
  }

  return spans;
}

/*
 * =======================================================
 * NUMBER WORDS + MIXED DIGITS
 * =======================================================
 */

function numberWordToDigit(
  value: string
) {
  switch (
    value.toLowerCase()
  ) {
    case "zero":
    case "oh":
      return "0";

    case "one":
      return "1";

    case "two":
      return "2";

    case "three":
      return "3";

    case "four":
      return "4";

    case "five":
      return "5";

    case "six":
      return "6";

    case "seven":
      return "7";

    case "eight":
      return "8";

    case "nine":
      return "9";

    default:
      return value;
  }
}

function detectSpelledAndMixedPhoneNumbers(
  body: string
) {
  const spans:
    SensitiveSpan[] =
    [];

  const tokenRegex =
    /\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|\d)\b/gi;

  const points:
    NumberWordPoint[] =
    [];

  let match:
    RegExpExecArray | null;

  while (
    (
      match =
        tokenRegex.exec(
          body
        )
    ) !==
    null
  ) {
    const token =
      match[
        0
      ];

    points.push({
      digit:
        numberWordToDigit(
          token
        ),

      start:
        match.index,

      end:
        match.index +
        token.length,

      cameFromWord:
        !/^\d$/.test(
          token
        ),
    });
  }

  if (
    points.length ===
    0
  ) {
    return spans;
  }

  let group:
    NumberWordPoint[] =
    [];

  const flush =
    () => {
      if (
        group.length <
          7
      ) {
        group =
          [];

        return;
      }

      if (
        !group.some(
          (
            point
          ) =>
            point.cameFromWord
        )
      ) {
        group =
          [];

        return;
      }

      const digits =
        group
          .map(
            (
              point
            ) =>
              point.digit
          )
          .join(
            ""
          );

      let phoneLike =
        false;

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
          isNigerianLocalPhoneDigits(
            digits.slice(
              start,
              start +
                11
            )
          )
        ) {
          phoneLike =
            true;

          break;
        }
      }

      for (
        let start =
          0;
        !phoneLike &&
        start +
            13 <=
          digits.length;
        start +=
          1
      ) {
        if (
          isNigerianCountryPhoneDigits(
            digits.slice(
              start,
              start +
                13
            )
          )
        ) {
          phoneLike =
            true;

          break;
        }
      }

      if (
        !phoneLike &&
        digits.length >=
          7 &&
        digits.length <=
          15 &&
        group.every(
          (
            point
          ) =>
            point.cameFromWord
        )
      ) {
        phoneLike =
          true;
      }

      if (
        phoneLike
      ) {
        const first =
          group[
            0
          ];

        const last =
          group[
            group.length -
              1
          ];

        addSpan(
          spans,
          {
            start:
              first.start,

            end:
              last.end,

            category:
              "phone_number",

            confidence:
              "medium",

            replacement:
              "*".repeat(
                last.end -
                  first.start
              ),
          }
        );
      }

      group =
        [];
    };

  for (
    const point
    of points
  ) {
    if (
      group.length ===
      0
    ) {
      group.push(
        point
      );

      continue;
    }

    const previous =
      group[
        group.length -
          1
      ];

    const gap =
      body.slice(
        previous.end,
        point.start
      );

    if (
      /^[\s.,\-_/"'â€™â€˜â€œâ€:;|~+]*$/u.test(
        gap
      )
    ) {
      group.push(
        point
      );

      continue;
    }

    flush();

    group.push(
      point
    );
  }

  flush();

  return spans;
}

/*
 * =======================================================
 * EXPLICIT PHONE FRAGMENTS
 * =======================================================
 */

function detectExplicitPhoneFragments(
  body: string
) {
  const spans:
    SensitiveSpan[] =
    [];

  const numberRegex =
    /\b\d(?:[\s.,\-_/"'â€™â€œâ€]*\d){2,7}\b/g;

  const contextRegex =
    /\b(?:my\s+digits?|remaining\s+digits?|rest\s+of\s+(?:the\s+)?(?:digits?|number)|last\s+digits?|next\s+digits?|phone\s+digits?|number\s+is|num\s+is|digits?\s+are|my\s+line)\b/i;

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
    const digits =
      digitCount(
        match[
          0
        ]
      );

    if (
      digits <
        3 ||
      digits >
        8
    ) {
      continue;
    }

    const context =
      contextAround(
        body,
        match.index,
        match.index +
          match[
            0
          ].length,
        45
      );

    if (
      !contextRegex.test(
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
          match[
            0
          ].length,

        category:
          "phone_number",

        confidence:
          "high",

        replacement:
          starMask(
            match[
              0
            ]
          ),
      }
    );
  }

  return spans;
}

/*
 * =======================================================
 * CROSS-MESSAGE PHONE CONTINUATION
 * =======================================================
 */

function detectPhoneContinuationFragments(
  body: string
) {
  const spans:
    SensitiveSpan[] =
    [];

  const numberRegex =
    /\b\d(?:[\s.,\-_/"'â€™â€œâ€]*\d){2,6}\b/g;

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
    const digits =
      digitCount(
        match[
          0
        ]
      );

    if (
      digits <
        3 ||
      digits >
        7
    ) {
      continue;
    }

    const context =
      contextAround(
        body,
        match.index,
        match.index +
          match[
            0
          ].length,
        30
      );

    /*
     * Benign marketplace/reference numbers.
     *
     * Examples:
     *
     * Room 204
     * Order 391
     * Table 5537
     */

    if (
      BENIGN_NUMBER_CONTEXT_REGEX.test(
        context
      )
    ) {
      continue;
    }

    /*
     * Times.
     *
     * Examples:
     *
     * 4:30
     * 14:30
     */

    if (
      /\b\d{1,2}:\d{2}\b/.test(
        context
      )
    ) {
      continue;
    }

    /*
     * Currency amounts.
     *
     * Use Unicode escapes for symbols so this remains
     * reliable even if the source file is copied through
     * a terminal/editor using a different encoding.
     *
     * Supported here:
     *
     * ₦  = U+20A6
     * £  = U+00A3
     * €  = U+20AC
     * $
     * NGN
     *
     * Examples:
     *
     * ₦15,000
     * NGN 15,000
     * £15,000
     * $15,000
     * €15,000
     */

    if (
      /(?:\u20A6|NGN|\u00A3|\$|\u20AC)\s*\d/i.test(
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
          match[
            0
          ].length,

        category:
          "phone_number",

        confidence:
          "high",

        replacement:
          starMask(
            match[
              0
            ]
          ),
      }
    );
  }

  return spans;
}

/*
 * =======================================================
 * WHATSAPP SIGNALS
 * =======================================================
 */

function hasPlainWhatsApp(
  body: string
) {
  const text =
    body
      .normalize(
        "NFKC"
      )
      .toLowerCase();

  return /\b(?:whatsapp|whatsap|watsapp|watsap|whatapp|whtsapp)\b/i.test(
    text
  );
}

function hasDeliberatelyObfuscatedWhatsApp(
  body: string
) {
  if (
    hasPlainWhatsApp(
      body
    )
  ) {
    return false;
  }

  const text =
    body
      .normalize(
        "NFKC"
      )
      .toLowerCase();

  return /\bw[\s._-]*h[\s._-]*[a4@][\s._-]*t[\s._-]*s[\s._-]*a[\s._-]*p[\s._-]*p\b/i.test(
    text
  );
}

function hasWhatsAppSignal(
  body: string
) {
  return (
    hasPlainWhatsApp(
      body
    ) ||
    hasDeliberatelyObfuscatedWhatsApp(
      body
    )
  );
}

function hasStrongExternalPlatform(
  body: string
) {
  const text =
    body
      .normalize(
        "NFKC"
      )
      .toLowerCase();

  if (
    hasWhatsAppSignal(
      body
    )
  ) {
    return true;
  }

  return /\b(?:telegram|tele\s*gram|instagram|insta\s*gram|snapchat|tik\s*tok|tiktok|twitter|facebook|signal|discord|messenger|green\s*app|greenapp)\b/i.test(
    text
  );
}

function hasShortExternalPlatformAlias(
  body: string
) {
  const text =
    normalizeIntentText(
      body
    );

  return /\b(?:wa|wapp|w\s+app|tg|tele|ig|insta|snap|fb|sc)\b/i.test(
    text
  );
}

/*
 * =======================================================
 * EXTERNAL CONTACT LINKS
 * =======================================================
 */

function detectExternalContactLinks(
  body: string
) {
  const spans:
    SensitiveSpan[] =
    [];

  const regex =
    /\b(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com|whatsapp\.com|t\.me|telegram\.me|instagram\.com|instagr\.am|snapchat\.com|tiktok\.com|twitter\.com|x\.com|facebook\.com|fb\.me|discord\.gg|discord\.com)\/[^\s]+/gi;

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
          match[
            0
          ].length,

        category:
          "external_link",

        confidence:
          "high",

        replacement:
          starMask(
            match[
              0
            ]
          ),
      }
    );
  }

  return spans;
}

/*
 * =======================================================
 * EXTERNAL USERNAMES
 * =======================================================
 */

function detectExternalUsernames(
  body: string
) {
  const spans:
    SensitiveSpan[] =
    [];

  const patterns:
    RegExp[] =
    [
      /\b(?:instagram|insta|ig|telegram|tg|tiktok|snapchat|snap|twitter|facebook|fb|discord)\s+(?:username|user|handle)\s*(?:is|:|=|-)?\s*@?([A-Z0-9._]{3,30})\b/gi,

      /\b(?:instagram|insta|ig|telegram|tg|tiktok|snapchat|snap|twitter|facebook|fb|discord)\s*[:=]\s*@?([A-Z0-9._]{3,30})\b/gi,

      /\b(?:instagram|insta|ig|telegram|tg|tiktok|snapchat|snap|twitter|facebook|fb|discord)\s+@([A-Z0-9._]{3,30})\b/gi,

      /\b(?:my|your|ur)\s+(?:instagram|insta|ig|telegram|tg|tiktok|snapchat|snap|twitter|facebook|fb|discord)\s*(?:is|:|=|-)\s*@?([A-Z0-9._]{3,30})\b/gi,

      /(?:^|[\s(])@([A-Z0-9._]{3,30})\b/gi,
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
        match[
          1
        ];

      if (
        !captured
      ) {
        continue;
      }

      const relativeIndex =
        match[
          0
        ]
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
 * GENERIC CONTACT SOLICITATION
 * =======================================================
 */

function detectsContactSolicitation(
  body: string,
  hasPhoneDisclosure:
    boolean
) {
  const text =
    normalizeIntentText(
      body
    );

  const contactNoun =
    "(?:number|num|digits?|line|contact|handle|username)";

  const possessive =
    "(?:your|ur|ya)";

  const hardSolicitationPatterns =
    [
      new RegExp(
        `\\b(?:what|wat|wats|whats|wht)\\s+(?:(?:is|are)\\s+)?${possessive}\\s+${contactNoun}\\b`,
        "i"
      ),

      new RegExp(
        `^(?:${possessive}\\s+${contactNoun})$`,
        "i"
      ),

      new RegExp(
        `\\b(?:send|drop|give|share|pass)\\s+(?:me\\s+)?(?:${possessive}\\s+)?${contactNoun}\\b`,
        "i"
      ),

      new RegExp(
        `\\b(?:gimme|give\\s+me)\\s+(?:${possessive}\\s+)?${contactNoun}\\b`,
        "i"
      ),

      new RegExp(
        `\\b(?:can|could|may)\\s+i\\s+(?:get|have)\\s+(?:${possessive}\\s+)?${contactNoun}\\b`,
        "i"
      ),

      new RegExp(
        `\\b(?:lemme|let\\s+me)\\s+(?:get|have)\\s+(?:${possessive}\\s+)?${contactNoun}\\b`,
        "i"
      ),

      /\b(?:can|could|may)\s+i\s+(?:call|text|txt|message|msg|ring|ping)\s+(?:you|u)\b/i,

      /\b(?:how|where)\s+(?:can|could|do)\s+i\s+(?:reach|contact|text|message|call)\s+(?:you|u)\b/i,

      /\b(?:how|where)\s+(?:can|could|do)\s+i\s+(?:get\s+in\s+touch\s+with|contact)\s+(?:you|u)\b/i,

      /\b(?:best|easiest)\s+way\s+to\s+(?:reach|contact|message|text|call)\s+(?:you|u)\b/i,

      /\breach\s+(?:me|us)\s+(?:on|at)\s*$/i,

      /\b(?:what|wat|wats|whats)\s+(?:(?:is|are)\s+)?(?:your|ur)\s+no\b/i,

      /\b(?:send|drop|give|share|pass)\s+(?:me\s+)?(?:your|ur)\s+no\b/i,
    ];

  if (
    hardSolicitationPatterns.some(
      (
        pattern
      ) =>
        pattern.test(
          text
        )
    )
  ) {
    return true;
  }

  const selfContactInstruction =
    /\b(?:call|text|txt|ring|ping)\s+(?:me|us)\b/i;

  if (
    selfContactInstruction.test(
      text
    )
  ) {
    return !hasPhoneDisclosure;
  }

  return false;
}

/*
 * =======================================================
 * EXTERNAL PLATFORM CIRCUMVENTION
 * =======================================================
 */

function detectsExternalPlatformCircumvention(
  body: string,
  hasExternalUsernameDisclosure:
    boolean,
  hasPhoneDisclosure:
    boolean
) {
  const text =
    normalizeIntentText(
      body
    );

  const plainWhatsApp =
    hasPlainWhatsApp(
      body
    );

  const deliberatelyObfuscatedWhatsApp =
    hasDeliberatelyObfuscatedWhatsApp(
      body
    );

  const whatsappSignal =
    plainWhatsApp ||
    deliberatelyObfuscatedWhatsApp;

  const strongPlatform =
    hasStrongExternalPlatform(
      body
    );

  const shortPlatform =
    hasShortExternalPlatformAlias(
      body
    );

  if (
    !strongPlatform &&
    !shortPlatform
  ) {
    return false;
  }

  const productTechnologyContext =
    /\b(?:support|supports|supported|install|installed|installation|notification|notifications|compatible|compatibility|version|update|updates|updated|crash|crashes|crashing|logo|printed|app\s+store|play\s+store|phone|tablet|laptop|watch|smartwatch|device|software|feature|features)\b/i;

  const personalQuestion =
    /\b(?:(?:what|wat|wats|whats|wht)\s+(?:(?:is|are)\s+)?(?:your|ur|ya)\s+|(?:are|r)\s+(?:you|u)\s+(?:on|using)\s+|(?:do|d)\s+(?:you|u)\s+(?:have|use)\s+|(?:you|u)\s+(?:got|have)\s+|(?:can|could|may)\s+i\s+(?:get|have)\s+(?:your|ur|ya)?\s*)/i;

  const directCommunication =
    /\b(?:text|txt|message|messages|msg|dm|chat|talk|speak|call|contact|reach|continue|move|switch|take|go|ping|follow|add)\b/i;

  const movementLanguage =
    /\b(?:instead|easier|better|faster|simpler|there|elsewhere|outside|off\s+platform|other\s+app|another\s+app)\b/i;

  const platformVerbInstruction =
    /\b(?:whatsapp|whatsap|watsapp|watsap|telegram|instagram|insta|snapchat|snap|tiktok|twitter|facebook|discord|signal)\s+(?:me|us)\b/i;

  const possessivePlatform =
    /\b(?:your|ur|ya|my|our)\s+(?:whatsapp|whatsap|watsapp|watsap|wa|wapp|telegram|tg|instagram|insta|ig|snapchat|snap|facebook|fb|discord|signal)\b/i;

  const personalSuggestion =
    /\b(?:should|shall|can|could|would|may|maybe|lets|wanna|want\s+to)\s+(?:(?:we|i|you|u)\s+)?(?:text|txt|message|msg|dm|chat|talk|call|continue|move|switch|use|go|add|follow)\b/i;

  if (
    personalQuestion.test(
      text
    ) ||
    directCommunication.test(
      text
    ) ||
    movementLanguage.test(
      text
    ) ||
    platformVerbInstruction.test(
      text
    ) ||
    personalSuggestion.test(
      text
    )
  ) {
    return true;
  }

  /*
   * Possessive platform reference without an actual value:
   *
   *   your IG
   *   your WhatsApp
   *
   * => BLOCK
   *
   * A disclosed social handle such as:
   *
   *   my IG is @john
   *
   * can still be sanitized by the username detector.
   *
   * WhatsApp paired with a detected phone number is
   * handled separately below and is BLOCKED.
   */

  if (
    possessivePlatform.test(
      text
    ) &&
    !hasExternalUsernameDisclosure &&
    !hasPhoneDisclosure
  ) {
    return true;
  }

  /*
   * Explicit social-handle disclosure remains sanitizable.
   *
   * Instagram: @john
   * My IG is @john
   *
   * => REDACT.
   */

  if (
    hasExternalUsernameDisclosure &&
    !whatsappSignal
  ) {
    return false;
  }

  /*
   * IMPORTANT:
   *
   * Plain WhatsApp + an actual detected phone number is
   * now BLOCKED, not merely redacted.
   *
   * Examples:
   *
   *   WhatsApp 8035535219
   *   WhatsApp: 08035535219
   *   My WhatsApp is 08035535219
   *
   * Once WhatsApp is paired with an actual phone value,
   * the purpose is explicitly to establish an external
   * contact route.
   *
   * The detector still sanitizes the number for safe
   * moderation output, but the message itself must not
   * be stored or delivered.
   */

  if (
    plainWhatsApp &&
    hasPhoneDisclosure
  ) {
    return true;
  }

  /*
   * Legitimate product/software discussion remains valid.
   */

  if (
    productTechnologyContext.test(
      text
    )
  ) {
    return false;
  }

  /*
   * Deliberately obfuscated WhatsApp is blocked.
   */

  if (
    deliberatelyObfuscatedWhatsApp
  ) {
    return true;
  }

  /*
   * Bare WhatsApp probe is blocked.
   */

  if (
    whatsappSignal
  ) {
    return true;
  }

  const words =
    text
      .split(
        /\s+/
      )
      .filter(
        Boolean
      );

  if (
    strongPlatform &&
    words.length <=
      4
  ) {
    return true;
  }

  return false;
}

/*
 * =======================================================
 * GENERIC MOVE-OFF-PLATFORM
 * =======================================================
 */

function detectsGenericExternalMove(
  body: string
) {
  const text =
    normalizeIntentText(
      body
    );

  const patterns =
    [
      /\b(?:move|take|continue|switch|go)\b.{0,35}\b(?:somewhere\s+else|elsewhere|another\s+app|other\s+app|outside\s+campusmart|off\s+platform)\b/i,

      /\b(?:lets|we\s+can|should\s+we|can\s+we|could\s+we)\b.{0,35}\b(?:move|take|continue|switch|go|talk|chat|message|text)\b.{0,35}\b(?:somewhere\s+else|elsewhere|another\s+app|other\s+app|outside|off\s+platform)\b/i,

      /\b(?:another|other)\s+app\b.{0,25}\b(?:easier|better|faster|simpler)\b/i,
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

function hasDenseNumericSequence(
  body: string
) {
  return buildDigitClusters(
    body
  ).some(
    (
      cluster
    ) =>
      cluster.digits.length >=
      6
  );
}

/*
 * =======================================================
 * BANK DETAILS
 * =======================================================
 */

function detectBankDetails(
  body: string
) {
  const spans:
    SensitiveSpan[] =
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
    const context =
      contextAround(
        body,
        match.index,
        match.index +
          match[
            0
          ].length
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
          match[
            0
          ].length,

        category:
          "bank_details",

        confidence:
          "high",

        replacement:
          starMask(
            match[
              0
            ]
          ),
      }
    );
  }

  return spans;
}

/*
 * =======================================================
 * OFF-PLATFORM PAYMENT
 * =======================================================
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
 * MAIN
 * =======================================================
 */

export function moderateOutgoingMessage(
  body: string,
  options:
    MessageModerationOptions =
    {}
): MessageModerationResult {
  const paymentProtectionEnabled =
    options
      .paymentProtectionEnabled ??
    isPaymentProtectionEnabled();

  const recentPhoneSharingAttempt =
    options
      .recentPhoneSharingAttempt ??
    false;

  const detectedSpans:
    SensitiveSpan[] =
    [];

  detectedSpans.push(
    ...detectEmails(
      body
    )
  );

  detectedSpans.push(
    ...detectEmbeddedPhoneWindows(
      body
    )
  );

  detectedSpans.push(
    ...detectPartialPhonePrefixes(
      body
    )
  );

  detectedSpans.push(
    ...detectExplicitInternationalPhones(
      body
    )
  );

  detectedSpans.push(
    ...detectLetterSubstitutedPhones(
      body
    )
  );

  detectedSpans.push(
    ...detectSpelledAndMixedPhoneNumbers(
      body
    )
  );

  detectedSpans.push(
    ...detectExplicitPhoneFragments(
      body
    )
  );

  detectedSpans.push(
    ...detectExternalContactLinks(
      body
    )
  );

  const externalUsernameSpans =
    detectExternalUsernames(
      body
    );

  detectedSpans.push(
    ...externalUsernameSpans
  );

  const hasPhoneDisclosure =
    detectedSpans.some(
      (
        span
      ) =>
        span.category ===
        "phone_number"
    );

  const hasExternalUsernameDisclosure =
    externalUsernameSpans.length >
    0;

  const continuationSpans =
    recentPhoneSharingAttempt
      ? detectPhoneContinuationFragments(
          body
        )
      : [];

  detectedSpans.push(
    ...continuationSpans
  );

  if (
    paymentProtectionEnabled
  ) {
    detectedSpans.push(
      ...detectBankDetails(
        body
      )
    );
  }

  const contactSolicitation =
    detectsContactSolicitation(
      body,
      hasPhoneDisclosure
    );

  const platformCircumvention =
    detectsExternalPlatformCircumvention(
      body,
      hasExternalUsernameDisclosure,
      hasPhoneDisclosure
    );

  const genericExternalMove =
    detectsGenericExternalMove(
      body
    );

  const numericTransformation =
    hasDenseNumericSequence(
      body
    ) &&
    detectsNumericTransformationLanguage(
      body
    );

  const splitPhoneCircumvention =
    recentPhoneSharingAttempt &&
    continuationSpans.length >
      0;

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

  const categories:
    MessageModerationCategory[] =
    detectedSpans.map(
      (
        span
      ) =>
        span.category
    );

  if (
    numericTransformation
  ) {
    categories.push(
      "phone_number"
    );
  }

  if (
    contactSolicitation ||
    platformCircumvention ||
    genericExternalMove ||
    numericTransformation ||
    splitPhoneCircumvention
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

  const shouldBlock =
    contactSolicitation ||
    platformCircumvention ||
    genericExternalMove ||
    numericTransformation ||
    splitPhoneCircumvention ||
    offPlatformPayment;

  let action:
    MessageModerationAction =
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

  const findings:
    MessageModerationFinding[] =
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