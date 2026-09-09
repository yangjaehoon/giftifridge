import { toDateString } from '../../../shared/utils/date';
import { hasNearbyKeyword, pickUnambiguousMatch, type ParseResult } from './nearbyKeyword';

const DATE_PREFIX_KEYWORDS = ['유효기간', '유효기한', '만료'];
const DATE_SUFFIX_KEYWORDS = ['까지'];

// Year is 4 digits (20xx) or 2 ("26.12.31", "'26.12.31"), the 2-digit form
// read as 20xx and bounded to 20-39 so a stray "31.4.15"-style token is less
// likely to read as a date. Separators may carry surrounding spaces — OCR
// frequently inserts them ("2026. 12. 31"). Each pattern captures
// (year, month, day) in groups 1-3; recognising a new written form is adding
// an entry to DATE_PATTERNS, not editing the scan below.
const DOT_DATE_RE =
  /(20\d{2}|[23]\d)\s*[.\-/]\s*(0[1-9]|1[0-2]|[1-9])\s*[.\-/]\s*(0[1-9]|[12]\d|3[01]|[1-9])(?!\d)/g;
const KOREAN_DATE_RE =
  /(20\d{2}|[23]\d)\s*년\s*(0?[1-9]|1[0-2])\s*월\s*(0?[1-9]|[12]\d|3[01])\s*일/g;
const DATE_PATTERNS = [DOT_DATE_RE, KOREAN_DATE_RE];

// Day-less forms ("2026.12", "2026년 12월"), taken as the last day of that
// month — what an expiry printed to month precision means. A weak signal (a
// version string or a rating can look the same), so a month-only match counts
// only when an expiry keyword sits next to it, and never when a full date is
// present anywhere in the text.
const DOT_MONTH_RE = /(20\d{2}|[23]\d)\s*[.\-/]\s*(0[1-9]|1[0-2]|[1-9])(?!\s*[.\-/]?\s*\d)/g;
const KOREAN_MONTH_RE = /(20\d{2}|[23]\d)\s*년\s*(0?[1-9]|1[0-2])\s*월(?!\s*\d{1,2}\s*일)/g;
const MONTH_PATTERNS = [DOT_MONTH_RE, KOREAN_MONTH_RE];

interface DateMatch {
  index: number;
  length: number;
  year: number;
  month: number;
  day: number;
}

function normalizeYear(raw: string): number {
  const year = Number(raw);
  return year < 100 ? year + 2000 : year;
}

// Rejects impossible dates the regex still lets through (e.g. 2026.02.30),
// which would otherwise roll over silently in `new Date(...)`.
function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function collectFullMatches(text: string): DateMatch[] {
  const matches: DateMatch[] = [];
  for (const re of DATE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const year = normalizeYear(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      if (!isRealCalendarDate(year, month, day)) continue;
      matches.push({ index: m.index ?? 0, length: m[0].length, year, month, day });
    }
  }
  return matches;
}

function collectMonthMatches(text: string): DateMatch[] {
  const matches: DateMatch[] = [];
  for (const re of MONTH_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const year = normalizeYear(m[1]);
      const month = Number(m[2]);
      if (month < 1 || month > 12) continue;
      matches.push({
        index: m.index ?? 0,
        length: m[0].length,
        year,
        month,
        day: lastDayOfMonth(year, month),
      });
    }
  }
  return matches;
}

function ordinal(match: DateMatch): number {
  return match.year * 10000 + match.month * 100 + match.day;
}

function latest(matches: DateMatch[]): DateMatch {
  return matches.reduce((a, b) => (ordinal(b) > ordinal(a) ? b : a));
}

function toResult(match: DateMatch): string {
  return toDateString(new Date(match.year, match.month - 1, match.day));
}

function parse(text: string): ParseResult<string> | null {
  const full = collectFullMatches(text);
  const monthOnly =
    full.length > 0
      ? []
      : collectMonthMatches(text).filter((m) =>
          hasNearbyKeyword(text, m.index, m.length, DATE_PREFIX_KEYWORDS, DATE_SUFFIX_KEYWORDS),
        );
  const matches = full.length > 0 ? full : monthOnly;
  if (matches.length === 0) return null;

  // pickUnambiguousMatch resolves via a keyword or, failing that, returns the
  // sole match — both count as anchored. Only the several-dates-no-keyword
  // "latest" fallback is a guess.
  const picked = pickUnambiguousMatch(text, matches, DATE_PREFIX_KEYWORDS, DATE_SUFFIX_KEYWORDS);
  if (picked) return { value: toResult(picked), confident: true };
  return { value: toResult(latest(matches)), confident: false };
}

/**
 * Finds an expiry-date-looking substring in OCR text and normalizes it to a
 * "YYYY-MM-DD" string. Prefers a date next to an expiry keyword; failing that
 * (several dates, none tagged), takes the latest — an expiry is never earlier
 * than the issue/purchase date printed beside it, and a real value beats
 * leaving the caller to invent a default. Returns null only when no date-like
 * text is found at all.
 */
export function parseExpiryDateFromText(text: string): string | null {
  return parse(text)?.value ?? null;
}

/** As parseExpiryDateFromText, but keeps the confidence flag (see ParseResult). */
export function parseExpiryDateResult(text: string): ParseResult<string> | null {
  return parse(text);
}
