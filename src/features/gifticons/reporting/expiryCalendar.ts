import type { Gifticon } from '../types';
import { statusOf } from '../gifticonFilters';
import { parseDate, toDateString } from '../../../shared/utils/date';

// Pure helpers behind the expiry calendar screen: the month's day grid, and
// the not-yet-used gifticons bucketed by the day they expire.

const DAYS_IN_WEEK = 7;
const WEEKS_SHOWN = 6;

/**
 * A 6×7 grid of "YYYY-MM-DD" strings for the given month (month is 0-based, as
 * in Date). Cells before the 1st and after the last day of the month are
 * `null`, so every grid is the same shape regardless of how the month falls.
 */
export function monthMatrix(year: number, month: number): (string | null)[][] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < DAYS_IN_WEEK * WEEKS_SHOWN; i += 1) {
    const dayOfMonth = i - firstWeekday + 1;
    cells.push(
      dayOfMonth >= 1 && dayOfMonth <= daysInMonth
        ? toDateString(new Date(year, month, dayOfMonth))
        : null,
    );
  }

  return Array.from({ length: WEEKS_SHOWN }, (_, week) =>
    cells.slice(week * DAYS_IN_WEEK, week * DAYS_IN_WEEK + DAYS_IN_WEEK),
  );
}

/**
 * Not-yet-used gifticons keyed by their `expiresAt` day. A gifticon already
 * marked used drops out (its expiry no longer matters); an expired-but-unused
 * one stays, so the calendar still shows a missed deadline in the current month.
 */
export function gifticonsByExpiryDate(items: Gifticon[]): Record<string, Gifticon[]> {
  const byDate: Record<string, Gifticon[]> = {};
  for (const item of items) {
    if (statusOf(item) === 'used') continue;
    // Normalise to "YYYY-MM-DD" so a legacy full-ISO expiresAt (still tolerated
    // by date.ts) matches the grid cells, which monthMatrix builds via
    // toDateString.
    const key = toDateString(parseDate(item.expiresAt));
    (byDate[key] ??= []).push(item);
  }
  return byDate;
}

/** Step one month back or forward from a {year, month} pair (month 0-based),
 *  rolling the year over at the boundaries. */
export function shiftMonth(
  year: number,
  month: number,
  delta: 1 | -1,
): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
