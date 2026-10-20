const TZ = "Africa/Lagos";
export function handoffDeadline(confirmedAt: Date): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(confirmedAt);
  const n = (key: string) => Number(parts.find((p) => p.type === key)?.value);
  // End of third calendar day AFTER confirmation, Nigeria UTC+1.
  return new Date(Date.UTC(n("year"), n("month") - 1, n("day") + 3, 22, 59, 59, 999));
}
