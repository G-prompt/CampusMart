import {
  moderateOutgoingMessage,
  type MessageModerationAction,
} from "../src/services/messageModeration.service";

/*
 * =======================================================
 * CAMPUSMART ADVERSARIAL MESSAGE-MODERATION TESTS
 * =======================================================
 *
 * This is intentionally a RED-TEAM corpus.
 *
 * We are trying to break the scanner with:
 *
 * - slang
 * - abbreviations
 * - misspellings
 * - external-platform aliases
 * - punctuation
 * - invisible characters
 * - Unicode digits
 * - letter substitutions
 * - embedded phone numbers
 * - added/removed digits
 * - number words
 * - multi-part representations
 * - transformation instructions
 *
 * IMPORTANT:
 *
 * It is completely acceptable for the FIRST run of this
 * suite to contain failures.
 *
 * Those failures tell us which attacks still bypass the
 * scanner.
 */

/*
 * =======================================================
 * TYPES
 * =======================================================
 */

type TestCase = {
  input: string;

  expected:
    MessageModerationAction;

  label: string;

  recentPhoneSharingAttempt?: boolean;

  expectedCategory?:
    | "phone_number"
    | "circumvention";
};

/*
 * =======================================================
 * TEST CASES
 * =======================================================
 */

const cases:
  TestCase[] =
[
  /*
   * =====================================================
   * WHATSAPP — DIRECT
   * =====================================================
   */

  {
    input:
      "Should we text on WhatsApp?",

    expected:
      "blocked",

    label:
      "Should we text on WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Should we txt on whatsapp?",

    expected:
      "blocked",

    label:
      "txt on WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Can we talk on WhatsApp?",

    expected:
      "blocked",

    label:
      "talk on WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Can we chat on whatsapp",

    expected:
      "blocked",

    label:
      "chat on WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Let's use WhatsApp",

    expected:
      "blocked",

    label:
      "use WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "WhatsApp me",

    expected:
      "blocked",

    label:
      "WhatsApp me",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Message me on WhatsApp",

    expected:
      "blocked",

    label:
      "message me on WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "WhatsApp would be easier",

    expected:
      "blocked",

    label:
      "WhatsApp easier",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Maybe WhatsApp is easier",

    expected:
      "blocked",

    label:
      "maybe WhatsApp easier",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "U got whatsapp?",

    expected:
      "blocked",

    label:
      "u got WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "You have whatsapp?",

    expected:
      "blocked",

    label:
      "you have WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Are u on whatsapp?",

    expected:
      "blocked",

    label:
      "are u on WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "wats ur whatsapp",

    expected:
      "blocked",

    label:
      "wats ur WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "whats your whatsapp",

    expected:
      "blocked",

    label:
      "whats your WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "drop ur whatsapp",

    expected:
      "blocked",

    label:
      "drop ur WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "send your whatsapp",

    expected:
      "blocked",

    label:
      "send your WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Can I get your WhatsApp?",

    expected:
      "blocked",

    label:
      "get your WhatsApp",

    expectedCategory:
      "circumvention",
  },

  /*
   * =====================================================
   * WHATSAPP — ABBREVIATIONS / MISSPELLINGS
   * =====================================================
   */

  {
    input:
      "Can we text on wa?",

    expected:
      "blocked",

    label:
      "WA with communication intent",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "lets use wa",

    expected:
      "blocked",

    label:
      "use WA",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "whats ur wa",

    expected:
      "blocked",

    label:
      "your WA",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "watsapp me",

    expected:
      "blocked",

    label:
      "watsapp misspelling",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "watsap?",

    expected:
      "blocked",

    label:
      "watsap misspelling",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "whatsap?",

    expected:
      "blocked",

    label:
      "whatsap misspelling",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "whtsapp?",

    expected:
      "blocked",

    label:
      "whtsapp abbreviation",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "wh4tsapp?",

    expected:
      "blocked",

    label:
      "WhatsApp leetspeak",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "w h a t s a p p?",

    expected:
      "blocked",

    label:
      "WhatsApp letters spaced out",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "w.h.a.t.s.a.p.p?",

    expected:
      "blocked",

    label:
      "WhatsApp letters dotted",

    expectedCategory:
      "circumvention",
  },

  /*
   * =====================================================
   * GREEN APP EUPHEMISMS
   * =====================================================
   */

  {
    input:
      "green app?",

    expected:
      "blocked",

    label:
      "green app",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "greenapp?",

    expected:
      "blocked",

    label:
      "greenapp joined",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Let's talk on the green app",

    expected:
      "blocked",

    label:
      "talk on green app",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Should we move to the green app?",

    expected:
      "blocked",

    label:
      "move to green app",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "the green app is easier",

    expected:
      "blocked",

    label:
      "green app easier",

    expectedCategory:
      "circumvention",
  },

  /*
   * =====================================================
   * TELEGRAM
   * =====================================================
   */

  {
    input:
      "Can we use Telegram?",

    expected:
      "blocked",

    label:
      "use Telegram",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Are u on Telegram?",

    expected:
      "blocked",

    label:
      "on Telegram",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "drop ur telegram",

    expected:
      "blocked",

    label:
      "drop Telegram",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "whats ur tg",

    expected:
      "blocked",

    label:
      "your TG",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "move to tg",

    expected:
      "blocked",

    label:
      "move to TG",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "tele gram?",

    expected:
      "blocked",

    label:
      "Telegram split word",

    expectedCategory:
      "circumvention",
  },

  /*
   * =====================================================
   * INSTAGRAM / SOCIAL HANDLES
   * =====================================================
   */

  {
    input:
      "What's ur instagram?",

    expected:
      "blocked",

    label:
      "your Instagram",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "drop ur ig",

    expected:
      "blocked",

    label:
      "drop IG",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "ur ig?",

    expected:
      "blocked",

    label:
      "ur IG",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "DM me on IG",

    expected:
      "blocked",

    label:
      "DM on IG",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "lets use insta",

    expected:
      "blocked",

    label:
      "use Insta",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "insta gram?",

    expected:
      "blocked",

    label:
      "Instagram split word",

    expectedCategory:
      "circumvention",
  },

  /*
   * =====================================================
   * GENERIC CONTACT SOLICITATION
   * =====================================================
   */

  {
    input:
      "wats ur digits",

    expected:
      "blocked",

    label:
      "wats ur digits",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "what are your digits?",

    expected:
      "blocked",

    label:
      "what are your digits",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "whats ur num",

    expected:
      "blocked",

    label:
      "whats ur num",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "what's your number",

    expected:
      "blocked",

    label:
      "what is your number",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "your number?",

    expected:
      "blocked",

    label:
      "bare your number solicitation",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "ur digits?",

    expected:
      "blocked",

    label:
      "bare ur digits",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "send ur num",

    expected:
      "blocked",

    label:
      "send ur num",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "drop your number",

    expected:
      "blocked",

    label:
      "drop number",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "drop digits",

    expected:
      "blocked",

    label:
      "drop digits",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "give me ur line",

    expected:
      "blocked",

    label:
      "give line",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "gimme ur number",

    expected:
      "blocked",

    label:
      "gimme number",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "lemme get ur digits",

    expected:
      "blocked",

    label:
      "lemme get digits",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Can I call you?",

    expected:
      "blocked",

    label:
      "can I call you",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Can I text u?",

    expected:
      "blocked",

    label:
      "can I text you",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "how can I reach you?",

    expected:
      "blocked",

    label:
      "how can I reach you",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "where can i reach u?",

    expected:
      "blocked",

    label:
      "where can I reach you",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "abeg drop ur number",

    expected:
      "blocked",

    label:
      "Nigerian slang contact solicitation",

    expectedCategory:
      "circumvention",
  },

  /*
   * =====================================================
   * GENERIC OFF-PLATFORM LANGUAGE
   * =====================================================
   */

  {
    input:
      "let's talk elsewhere",

    expected:
      "blocked",

    label:
      "talk elsewhere",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "Can we continue somewhere else?",

    expected:
      "blocked",

    label:
      "continue somewhere else",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "let's move to another app",

    expected:
      "blocked",

    label:
      "move to another app",

    expectedCategory:
      "circumvention",
  },

  /*
   * =====================================================
   * STANDARD PHONE NUMBERS
   * =====================================================
   */

  {
    input:
      "08035535266",

    expected:
      "redacted",

    label:
      "080 number",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "08135535266",

    expected:
      "redacted",

    label:
      "081 number",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "07035535266",

    expected:
      "redacted",

    label:
      "070 number",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "09035535266",

    expected:
      "redacted",

    label:
      "090 number",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "09135535266",

    expected:
      "redacted",

    label:
      "091 number",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "+2348035535266",

    expected:
      "redacted",

    label:
      "+234 number",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "2348035535266",

    expected:
      "redacted",

    label:
      "234 number",

    expectedCategory:
      "phone_number",
  },

  /*
   * =====================================================
   * PHONE SEPARATORS
   * =====================================================
   */

  {
    input:
      "0803 553 5266",

    expected:
      "redacted",

    label:
      "space-separated phone",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "0803-553-5266",

    expected:
      "redacted",

    label:
      "hyphen-separated phone",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "0803.553.5266",

    expected:
      "redacted",

    label:
      "dot-separated phone",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "0803/553/5266",

    expected:
      "redacted",

    label:
      "slash-separated phone",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "0803_553_5266",

    expected:
      "redacted",

    label:
      "underscore phone",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      `"0803" "553" "5266"`,

    expected:
      "redacted",

    label:
      "quoted phone",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "0803|553|5266",

    expected:
      "redacted",

    label:
      "pipe-separated phone",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "0803•553•5266",

    expected:
      "redacted",

    label:
      "bullet-separated phone",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "0803📱553📱5266",

    expected:
      "redacted",

    label:
      "emoji-separated phone",

    expectedCategory:
      "phone_number",
  },

  /*
   * =====================================================
   * UNICODE PHONE NUMBERS
   * =====================================================
   */

  {
    input:
      "０８０３５５３５２６６",

    expected:
      "redacted",

    label:
      "full-width phone digits",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "٠٨٠٣٥٥٣٥٢٦٦",

    expected:
      "redacted",

    label:
      "Arabic-Indic phone digits",

    expectedCategory:
      "phone_number",
  },

  /*
   * =====================================================
   * LETTER SUBSTITUTION
   * =====================================================
   */

  {
    input:
      "O8O35535266",

    expected:
      "redacted",

    label:
      "O instead of zero",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "08O35535266",

    expected:
      "redacted",

    label:
      "middle O instead of zero",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "O8O-355-35266",

    expected:
      "redacted",

    label:
      "letter substitution with separators",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "0x8x0x3x5x5x3x5x2x6x6",

    expected:
      "redacted",

    label:
      "filler letters between digits",

    expectedCategory:
      "phone_number",
  },

  /*
   * =====================================================
   * INVISIBLE SEPARATORS
   * =====================================================
   */

  {
    input:
      "080\u200B355\u200B35266",

    expected:
      "redacted",

    label:
      "zero-width-space phone",

    expectedCategory:
      "phone_number",
  },

  /*
   * =====================================================
   * PHONE EMBEDDED INSIDE LARGER NUMBERS
   * =====================================================
   */

  {
    input:
      "1508035535266",

    expected:
      "redacted",

    label:
      "phone embedded after 15",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "9908035535266",

    expected:
      "redacted",

    label:
      "phone embedded after 99",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "0803553526699",

    expected:
      "redacted",

    label:
      "phone with trailing fake digits",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "15,0008037079361",

    expected:
      "redacted",

    label:
      "phone hidden after price-like prefix",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "abc08035535266xyz",

    expected:
      "redacted",

    label:
      "phone touching letters",

    expectedCategory:
      "phone_number",
  },

  /*
   * =====================================================
   * OMITTED LEADING ZERO
   * =====================================================
   */

  {
    input:
      "my number is 8035535266",

    expected:
      "redacted",

    label:
      "10-digit number with phone context",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "wats ur digits 8035535266",

    expected:
      "blocked",

    label:
      "10-digit number plus solicitation",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "WhatsApp 8035535266",

    expected:
      "blocked",

    label:
      "10-digit number with WhatsApp",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "my OPay is 8035535266",

    expected:
      "redacted",

    label:
      "OPay contextual number",

    expectedCategory:
      "phone_number",
  },

  /*
   * =====================================================
   * TRANSFORMATION / DECODE INSTRUCTIONS
   * =====================================================
   */

  {
    input:
      "1508035535266 remove the 15",

    expected:
      "blocked",

    label:
      "remove prefix digits",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "9908035535266 ignore the first two digits",

    expected:
      "blocked",

    label:
      "ignore first digits",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "8035535266 add 0 in front",

    expected:
      "blocked",

    label:
      "add zero in front",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "0803553526699 remove the last two",

    expected:
      "blocked",

    label:
      "remove trailing digits",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "665253553080 read it backwards",

    expected:
      "blocked",

    label:
      "reverse phone-number instruction",

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "08 03 55 35 26 6 join the digits",

    expected:
      "blocked",

    label:
      "join number fragments",

    expectedCategory:
      "circumvention",
  },

  /*
   * =====================================================
   * NUMBER WORDS
   * =====================================================
   */

  {
    input:
      "zero eight zero three five five three five two six six",

    expected:
      "redacted",

    label:
      "fully spelled phone",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "zero eight zero 3 5 5 3 5 2 6 6",

    expected:
      "redacted",

    label:
      "mixed spelled and numeric phone",

    expectedCategory:
      "phone_number",
  },

  {
    input:
      "080 three five five three five two six six",

    expected:
      "redacted",

    label:
      "mixed numeric prefix and number words",

    expectedCategory:
      "phone_number",
  },

  /*
   * =====================================================
   * CONTINUATION MODE
   * =====================================================
   */

  {
    input:
      "391",

    expected:
      "blocked",

    label:
      "split phone middle fragment",

    recentPhoneSharingAttempt:
      true,

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "5537",

    expected:
      "blocked",

    label:
      "split phone ending fragment",

    recentPhoneSharingAttempt:
      true,

    expectedCategory:
      "circumvention",
  },

  {
    input:
      `"391"`,

    expected:
      "blocked",

    label:
      "quoted continuation",

    recentPhoneSharingAttempt:
      true,

    expectedCategory:
      "circumvention",
  },

  {
    input:
      "5-5-3-7",

    expected:
      "blocked",

    label:
      "punctuated continuation",

    recentPhoneSharingAttempt:
      true,

    expectedCategory:
      "circumvention",
  },

  /*
   * =====================================================
   * FALSE-POSITIVE CONTROLS
   * =====================================================
   */

  {
    input:
      "Does this phone support WhatsApp?",

    expected:
      "allow",

    label:
      "WhatsApp product compatibility",
  },

  {
    input:
      "This laptop has WhatsApp installed.",

    expected:
      "allow",

    label:
      "WhatsApp installed on product",
  },

  {
    input:
      "Does this smartwatch show Telegram notifications?",

    expected:
      "allow",

    label:
      "Telegram notification support",
  },

  {
    input:
      "The Instagram app keeps crashing on this tablet.",

    expected:
      "allow",

    label:
      "Instagram product/software discussion",
  },

  {
    input:
      "The Instagram logo is printed on the case.",

    expected:
      "allow",

    label:
      "Instagram word in physical description",
  },

  {
    input:
      "IG",

    expected:
      "allow",

    label:
      "bare ambiguous IG abbreviation",
  },

  {
    input:
      "WA size 10",

    expected:
      "allow",

    label:
      "ambiguous WA abbreviation",
  },

  {
    input:
      "Meet me in Room 204",

    expected:
      "allow",

    label:
      "room number",
  },

  {
    input:
      "Let's meet at 4:30",

    expected:
      "allow",

    label:
      "time",
  },

  {
    input:
      "The price is ₦15,000",

    expected:
      "allow",

    label:
      "currency amount",
  },

  {
    input:
      "Order 391 is ready",

    expected:
      "allow",

    label:
      "short order reference",

    recentPhoneSharingAttempt:
      true,
  },

  {
    input:
      "Room 204",

    expected:
      "allow",

    label:
      "room during continuation mode",

    recentPhoneSharingAttempt:
      true,
  },

  {
    input:
      "4:30",

    expected:
      "allow",

    label:
      "time during continuation mode",

    recentPhoneSharingAttempt:
      true,
  },

  {
    input:
      "₦15,000",

    expected:
      "allow",

    label:
      "price during continuation mode",

    recentPhoneSharingAttempt:
      true,
  },
];

/*
 * =======================================================
 * RUNNER
 * =======================================================
 */

let passed =
  0;

let failed =
  0;

const failures:
  Array<{
    number: number;

    label: string;

    input: string;

    expected:
      MessageModerationAction;

    actual:
      MessageModerationAction;

    categories:
      string[];

    sanitizedBody:
      string;
  }> =
  [];

for (
  let index =
    0;
  index <
  cases.length;
  index +=
    1
) {
  const test =
    cases[
      index
    ];

  const result =
    moderateOutgoingMessage(
      test.input,
      {
        recentPhoneSharingAttempt:
          test
            .recentPhoneSharingAttempt ??
          false,
      }
    );

  const actionMatches =
    result.action ===
    test.expected;

  const categoryMatches =
    !test.expectedCategory ||
    result.categories.includes(
      test.expectedCategory
    );

  if (
    actionMatches &&
    categoryMatches
  ) {
    passed +=
      1;

    continue;
  }

  failed +=
    1;

  failures.push({
    number:
      index +
      1,

    label:
      test.label,

    input:
      test.input,

    expected:
      test.expected,

    actual:
      result.action,

    categories:
      result.categories,

    sanitizedBody:
      result.sanitizedBody,
  });
}

/*
 * =======================================================
 * REPORT
 * =======================================================
 */

console.log(
  "\n========================================"
);

console.log(
  "CampusMart adversarial moderation suite"
);

console.log(
  "========================================\n"
);

if (
  failures.length >
  0
) {
  console.log(
    "FAILURES:\n"
  );

  for (
    const failure
    of failures
  ) {
    console.log(
      `FAIL ${failure.number}: ${failure.label}`
    );

    console.log(
      `  Input:      ${JSON.stringify(
        failure.input
      )}`
    );

    console.log(
      `  Expected:   ${failure.expected}`
    );

    console.log(
      `  Actual:     ${failure.actual}`
    );

    console.log(
      `  Categories: ${failure.categories.join(
        ", "
      ) || "none"}`
    );

    console.log(
      `  Sanitized:  ${JSON.stringify(
        failure.sanitizedBody
      )}`
    );

    console.log();
  }
}

console.log(
  "----------------------------------------"
);

console.log(
  `Adversarial moderation tests: ${passed} passed / ${failed} failed`
);

console.log(
  `Total cases: ${cases.length}`
);

console.log(
  "----------------------------------------\n"
);

if (
  failed >
  0
) {
  console.log(
    "Good — the failures above are the remaining bypasses we need to close before committing.\n"
  );

  process.exitCode =
    1;
} else {
  console.log(
    "All adversarial cases passed.\n"
  );
}