import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';

const PREFIX_KEYWORDS = ['유효기간', '유효기한', '만료'];
const SUFFIX_KEYWORDS = ['까지'];
const KEYWORD_WINDOW = 15;

const DOT_DATE_RE = /(20\d{2})[.\-/](0[1-9]|1[0-2]|[1-9])[.\-/](0[1-9]|[12]\d|3[01]|[1-9])(?!\d)/g;
const KOREAN_DATE_RE = /(20\d{2})\s*년\s*(0?[1-9]|1[0-2])\s*월\s*(0?[1-9]|[12]\d|3[01])\s*일/g;

interface DateMatch {
  index: number;
  length: number;
  year: number;
  month: number;
  day: number;
}

function collectMatches(text: string, re: RegExp): DateMatch[] {
  const matches: DateMatch[] = [];
  for (const m of text.matchAll(re)) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
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
 * normalizes it to an ISO date string. Returns null whenever the result would
 * be a guess (no dates found, or multiple dates with no keyword to disambiguate).
 */
export function parseExpiryDateFromText(text: string): string | null {
  const matches = [...collectMatches(text, DOT_DATE_RE), ...collectMatches(text, KOREAN_DATE_RE)];
  if (matches.length === 0) return null;

  const withKeyword = matches.filter((match) => hasNearbyKeyword(text, match));
  const candidates = withKeyword.length > 0 ? withKeyword : matches;
  if (candidates.length !== 1) return null;

  const { year, month, day } = candidates[0];
  return new Date(year, month - 1, day).toISOString();
}

export async function recognizeExpiryDate(imageUri: string): Promise<string | null> {
  try {
    const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.KOREAN);
    return parseExpiryDateFromText(result.text);
  } catch {
    return null;
  }
}
