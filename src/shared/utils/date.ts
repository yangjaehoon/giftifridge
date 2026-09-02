// A gifticon's `expiresAt` is a calendar day, not an instant — "2026-08-01"
// means end of that day wherever the user is. Storing it as a UTC ISO string
// and reading it back with local getters drifts by a day across time zones
// (an issue for shared spaces), so it is stored and compared as "YYYY-MM-DD".
// `createdAt` / `usedAt` are genuine moments and stay full ISO; the helpers
// below accept either shape so those still format correctly.

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local calendar day of `d` as "YYYY-MM-DD". */
export function toDateString(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Today's local calendar day as "YYYY-MM-DD". */
export function todayDateString(): string {
  return toDateString(new Date());
}

/**
 * Local-midnight Date for a "YYYY-MM-DD" string. A legacy full ISO instant is
 * tolerated (collapsed to the local midnight of its local day).
 */
export function parseDate(value: string): Date {
  const m = DATE_ONLY_RE.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Whole days from today (local) to the given calendar day; negative if past. */
export function daysUntil(value: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseDate(value).getTime() - today.getTime()) / 86_400_000);
}

/** "YYYY.MM.DD" for display. Accepts "YYYY-MM-DD" or a full ISO instant. */
export function formatDate(value: string): string {
  const m = DATE_ONLY_RE.exec(value);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  const d = new Date(value);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${month}.${day}`;
}
