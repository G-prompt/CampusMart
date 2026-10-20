/** Nigerian signup: 11 national digits; international: +234 plus 10 digits. */
export function formatNigerianNationalInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("234")) digits = digits.slice(3);
  if (digits && !digits.startsWith("0")) digits = `0${digits}`;
  digits = digits.slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

export function toNigeriaE164(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("234")) digits = digits.slice(3);
  if (/^0[789]\d{9}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^[789]\d{9}$/.test(digits)) return `+234${digits}`;
  return null;
}

/** Phone values can originate from older accounts; never pretend invalid values are valid. */
export function displayPhone(value: string | null | undefined): string {
  if (!value) return "";
  const valid = toNigeriaE164(value);
  if (!valid) return value;
  const number = valid.slice(4);
  return `+234 ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
}
