/** Phone is stored in E.164. Nigerian national input has 11 digits starting 0. */
export function normalizeSignupPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const source = value.trim();
  if (!source || /[^+\d\s()-]/.test(source)) return null;
  let digits = source.replace(/\D/g, "");
  if (digits.startsWith("234")) {
    digits = digits.slice(3);
    if (digits.startsWith("0")) digits = digits.slice(1);
    return /^[789]\d{9}$/.test(digits) ? `+234${digits}` : null;
  }
  if (/^0[789]\d{9}$/.test(digits)) return `+234${digits.slice(1)}`;
  // Other countries: caller must provide explicit country calling code.
  if (source.startsWith("+") && /^\d{8,15}$/.test(digits)) return `+${digits}`;
  return null;
}

/** Human-readable phone for API responses; use canonical value for phone dial links. */
export function displayPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  let digits=value.replace(/\D/g,"");
  if (digits.startsWith("0") && digits.length===11) digits="234"+digits.slice(1);
  if (digits.startsWith("234") && digits.length===13) {
    const n=digits.slice(3);
    return `+234 ${n.slice(0,3)} ${n.slice(3,6)} ${n.slice(6)}`;
  }
  return value;
}
