import { toDateString } from '../../../../shared/utils/date';
import { pickUnambiguousMatch } from './nearbyKeyword';

const DATE_PREFIX_KEYWORDS = ['유효기간', '유효기한', '만료'];
const DATE_SUFFIX_KEYWORDS = ['까지'];

const DOT_DATE_RE = /(20\d{2})[.\-/](0[1-9]|1[0-2]|[1-9])[.\-/](0[1-9]|[12]\d|3[01]|[1-9])(?!\d)/g;
const KOREAN_DATE_RE = /(20\d{2})\s*년\s*(0?[1-9]|1[0-2])\s*월\s*(0?[1-9]|[12]\d|3[01])\s*일/g;

// Each pattern must capture (year, month, day) in groups 1-3. Recognising a new
// written form of a date is adding an entry here, not editing the scan below.
const DATE_PATTERNS = [DOT_DATE_RE, KOREAN_DATE_RE];

interface DateMatch {
  index: number;
  length: number;
  year: number;
  month: number;
  day: number;
}

// Rejects impossible dates the regex still lets through (e.g. 2026.02.30),
// which would otherwise roll over silently in `new Date(...)`.
function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function collectDateMatches(text: string, re: RegExp): DateMatch[] {
  const matches: DateMatch[] = [];
  for (const m of text.matchAll(re)) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (!isRealCalendarDate(year, month, day)) continue;
    matches.push({ index: m.index ?? 0, length: m[0].length, year, month, day });
  }
  return matches;
}

/**
 * Finds a single, unambiguous expiry-date-looking substring in OCR text and
 * normalizes it to a "YYYY-MM-DD" string. Returns null whenever the result would
 * be a guess (no dates found, or multiple dates with no keyword to disambiguate).
 */
export function parseExpiryDateFromText(text: string): string | null {
  const matches = DATE_PATTERNS.flatMap((re) => collectDateMatches(text, re));
  const match = pickUnambiguousMatch(text, matches, DATE_PREFIX_KEYWORDS, DATE_SUFFIX_KEYWORDS);
  if (!match) return null;

  return toDateString(new Date(match.year, match.month - 1, match.day));
}
