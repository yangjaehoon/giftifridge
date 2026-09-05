import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { toDateString } from '../../../shared/utils/date';

const PREFIX_KEYWORDS = ['유효기간', '유효기한', '만료'];
const SUFFIX_KEYWORDS = ['까지'];
const KEYWORD_WINDOW = 15;

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

function collectMatches(text: string, re: RegExp): DateMatch[] {
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

function hasNearbyKeyword(text: string, match: DateMatch): boolean {
  const before = text.slice(Math.max(0, match.index - KEYWORD_WINDOW), match.index);
  const after = text.slice(
    match.index + match.length,
    Math.min(text.length, match.index + match.length + KEYWORD_WINDOW),
  );
  return (
    PREFIX_KEYWORDS.some((keyword) => before.includes(keyword)) ||
    SUFFIX_KEYWORDS.some((keyword) => after.includes(keyword))
  );
}

/**
 * Finds a single, unambiguous expiry-date-looking substring in OCR text and
 * normalizes it to a "YYYY-MM-DD" string. Returns null whenever the result would
 * be a guess (no dates found, or multiple dates with no keyword to disambiguate).
 */
export function parseExpiryDateFromText(text: string): string | null {
  const matches = DATE_PATTERNS.flatMap((re) => collectMatches(text, re));
  if (matches.length === 0) return null;

  const withKeyword = matches.filter((match) => hasNearbyKeyword(text, match));
  const candidates = withKeyword.length > 0 ? withKeyword : matches;
  if (candidates.length !== 1) return null;

  const { year, month, day } = candidates[0];
  return toDateString(new Date(year, month - 1, day));
}

/** Raw OCR text, or null if recognition failed. Shared by recognizeExpiryDate
 * and the gallery auto-import scan, which also needs it to spot gifticon
 * keywords. */
export async function recognizeText(imageUri: string): Promise<string | null> {
  try {
    const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.KOREAN);
    return result.text;
  } catch {
    return null;
  }
}

export async function recognizeExpiryDate(imageUri: string): Promise<string | null> {
  const text = await recognizeText(imageUri);
  return text == null ? null : parseExpiryDateFromText(text);
}

// Boilerplate that shows up on gifticons but is never the brand/product name
// itself, so a line containing one of these is skipped as a candidate.
const NOISE_KEYWORDS = [
  '기프티콘',
  '교환권',
  '모바일',
  '유효기간',
  '유효기한',
  '교환처',
  '바코드',
  '고객센터',
  '환불',
  '전국',
  '점',
];
const MIN_LINE_LENGTH = 2;
const MAX_LINE_LENGTH = 30;
// A line more digit-dense than this reads as a barcode number or price, not text.
const MAX_DIGIT_RATIO = 0.4;

function isNoiseLine(line: string): boolean {
  if (line.length < MIN_LINE_LENGTH || line.length > MAX_LINE_LENGTH) return true;
  if (parseExpiryDateFromText(line) != null) return true;
  const digitCount = (line.match(/\d/g) ?? []).length;
  if (digitCount / line.length > MAX_DIGIT_RATIO) return true;
  return NOISE_KEYWORDS.some((keyword) => line.includes(keyword));
}

/**
 * Best-effort brand/product-name guess from OCR text — there's no format to
 * anchor on the way a date has one, so this is a heuristic the user is
 * expected to double-check, not a reliable parse. Most gifticon layouts put
 * the brand name above the product name, so the first two non-boilerplate
 * lines are read as (brand, name) in that order.
 */
export function guessBrandAndName(text: string): { brand: string | null; name: string | null } {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isNoiseLine(line));
  return { brand: lines[0] ?? null, name: lines[1] ?? null };
}
