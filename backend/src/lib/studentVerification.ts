export type UniversityMatricRule = {
  name: string;
  shortName: string;

  matricValidationEnabled: boolean;
  matricPattern: string | null;
  matricFormatHint: string | null;
};

export type MatricValidationResult = {
  valid: boolean;
  skipped: boolean;

  normalizedMatricNumber: string;

  errorCode?:
    | "REQUIRED"
    | "INVALID_FORMAT"
    | "RULE_NOT_CONFIGURED"
    | "INVALID_RULE";

  message?: string;

  formatHint?: string | null;
};

/**
 * Normalizes harmless formatting differences only.
 *
 * Examples:
 *
 * "De. 2022 / 7408"
 *      ↓
 * "DE.2022/7408"
 *
 * " de.2022 /7408 "
 *      ↓
 * "DE.2022/7408"
 *
 * IMPORTANT:
 * This function deliberately DOES NOT guess missing punctuation
 * or replace characters.
 *
 * Example:
 *
 * "DE2022-7408"
 *
 * remains:
 *
 * "DE2022-7408"
 *
 * If that does not match the university's official pattern,
 * validation will fail.
 */
export function normalizeMatricNumber(
  value: string
): string {
  return value
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export type AcceptedMatricFormat = {label:string; pattern:string; example?:string};
/** Backwards compatible: legacy regex or JSON array of labelled accepted formats. */
export function parseAcceptedMatricFormats(value: string): AcceptedMatricFormat[] {
  if (!value.trim().startsWith("[")) return [{label:"Standard",pattern:value}];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 8) throw new Error("Expected 1–8 accepted matric formats.");
  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid matric format record.");
    const record=entry as Record<string,unknown>;
    if (typeof record.label !== "string" || typeof record.pattern !== "string" ||
        record.label.trim().length < 2 || record.label.length > 60 ||
        record.pattern.length < 1 || record.pattern.length > 300) throw new Error("Invalid matric format.");
    return {label:record.label.trim(),pattern:record.pattern,example:typeof record.example==="string"?record.example.slice(0,90):undefined};
  });
}
export function validAcceptedMatricFormats(value:string):boolean {
  try {
    return parseAcceptedMatricFormats(value).every(rule=>{
      if (rule.pattern.length>300) return false;
      new RegExp(`^(?:${rule.pattern})$`);
      return true;
    });
  } catch { return false; }
}

/**
 * Validates a matric number against the rules stored
 * for the selected university.
 *
 * The matricPattern itself should never be sent to the frontend.
 * Only the harmless format hint may be exposed.
 */
export function validateMatricNumber(
  rawMatricNumber: string,
  university: UniversityMatricRule
): MatricValidationResult {
  const normalizedMatricNumber =
    normalizeMatricNumber(rawMatricNumber);

  if (!normalizedMatricNumber) {
    return {
      valid: false,
      skipped: false,
      normalizedMatricNumber,
      errorCode: "REQUIRED",
      message: `Enter your ${university.shortName} matric number.`,
      formatHint:
        university.matricFormatHint,
    };
  }

  /*
   * Some universities may exist in CampusMart before
   * we have configured their official matric-number pattern.
   *
   * In that case, format validation is skipped.
   * This does NOT mean the student is verified.
   */
  if (
    !university.matricValidationEnabled
  ) {
    return {
      valid: true,
      skipped: true,
      normalizedMatricNumber,
      formatHint:
        university.matricFormatHint,
    };
  }

  if (!university.matricPattern) {
    return {
      valid: false,
      skipped: false,
      normalizedMatricNumber,
      errorCode:
        "RULE_NOT_CONFIGURED",
      message:
        "Student verification is temporarily unavailable for this university.",
      formatHint:
        university.matricFormatHint,
    };
  }

  try {
    /*
     * Wrap the university pattern so the whole matric number
     * must match, not just part of it.
     */
    const formats = parseAcceptedMatricFormats(university.matricPattern);
    if (!formats.some(rule => new RegExp(`^(?:${rule.pattern})$`).test(normalizedMatricNumber))) {
      return {
        valid: false,
        skipped: false,
        normalizedMatricNumber,
        errorCode:
          "INVALID_FORMAT",
        message: `That does not look like a valid ${university.shortName} matric number. Check your details and try again.`,
        formatHint:
          university.matricFormatHint,
      };
    }

    return {
      valid: true,
      skipped: false,
      normalizedMatricNumber,
      formatHint:
        university.matricFormatHint,
    };
  } catch (error) {
    console.error(
      `Invalid matric pattern configured for ${university.name}:`,
      error
    );

    return {
      valid: false,
      skipped: false,
      normalizedMatricNumber,
      errorCode:
        "INVALID_RULE",
      message:
        "Student verification is temporarily unavailable for this university.",
      formatHint:
        university.matricFormatHint,
    };
  }
}