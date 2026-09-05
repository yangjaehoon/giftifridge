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

/** Raw OCR text, or null if recognition failed. Callers derive whatever they
 * need from it (parseExpiryDateFromText, guessBrandAndName) — kept as one
 * recognition pass since running OCR twice per photo would be wasteful. */
export async function recognizeText(imageUri: string): Promise<string | null> {
  try {
    const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.KOREAN);
    return result.text;
  } catch {
    return null;
  }
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
// A line this digit-dense reads as a barcode number or price, not text — but
// require a minimum digit count too, or short real brand names that happen to
// contain a couple of digits (e.g. "GS25", "seven eleven"-style codes) get
// misread as noise merely for being short.
const MIN_NOISE_DIGIT_COUNT = 4;
const MAX_DIGIT_RATIO = 0.4;

function isNoiseLine(line: string): boolean {
  if (line.length < MIN_LINE_LENGTH || line.length > MAX_LINE_LENGTH) return true;
  if (parseExpiryDateFromText(line) != null) return true;
  const digitCount = (line.match(/\d/g) ?? []).length;
  if (digitCount >= MIN_NOISE_DIGIT_COUNT && digitCount / line.length > MAX_DIGIT_RATIO)
    return true;
  return NOISE_KEYWORDS.some((keyword) => line.includes(keyword));
}

// Common Korean gifticon brands, checked before falling back to the
// position-based guess below — a known name pins the brand correctly
// regardless of which line it lands on (and regardless of whether that line
// would otherwise be filtered as noise, e.g. "전국 GS25 매장에서 사용 가능").
// Not exhaustive: a brand missing from this list still works via the
// position fallback, just less reliably.
const KNOWN_BRANDS = [
  // 카페
  '스타벅스',
  '이디야',
  '투썸플레이스',
  '메가커피',
  '컴포즈커피',
  '빽다방',
  '폴바셋',
  '커피빈',
  '할리스',
  '파스쿠찌',
  '엔젤리너스',
  '탐앤탐스',
  '만랩커피',
  '공차',
  '매머드커피',
  '더벤티',
  '요거프레소',
  '스무디킹',
  '잠바주스',
  // 편의점
  'GS25',
  'CU',
  '세븐일레븐',
  '이마트24',
  '미니스톱',
  // 패스트푸드/치킨
  '맥도날드',
  '버거킹',
  '롯데리아',
  'KFC',
  '맘스터치',
  '서브웨이',
  '노브랜드버거',
  '쉐이크쉑',
  '교촌치킨',
  '굽네치킨',
  'bhc',
  'BBQ',
  '네네치킨',
  '처갓집양념치킨',
  '페리카나',
  '호식이두마리치킨',
  '노랑통닭',
  '푸라닭',
  '자담치킨',
  '또래오래',
  // 피자
  '도미노피자',
  '피자헛',
  '미스터피자',
  '파파존스',
  // 베이커리/디저트
  '배스킨라빈스',
  '던킨',
  '파리바게뜨',
  '뚜레쥬르',
  '파리크라상',
  '크리스피크림도넛',
  '설빙',
  '나뚜루',
  '콜드스톤',
  // 문화/기타
  'CGV',
  '롯데시네마',
  '메가박스',
  '올리브영',
  '다이소',
  '시코르',
  '교보문고',
  '영풍문고',
];

function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

const ASCII_ONLY_RE = /^[a-z0-9]+$/;

// A plain substring check is fine for Korean brand names (multi-syllable
// blocks rarely embed inside an unrelated word), but a short Latin/digit
// token like "CU" or "KFC" would otherwise match inside all sorts of
// unrelated English text (e.g. "CU" inside "CUP"). For those, require the
// token to stand alone rather than be embedded in a longer alphanumeric run.
function containsBrandKey(haystack: string, brandKey: string): boolean {
  if (!ASCII_ONLY_RE.test(brandKey)) return haystack.includes(brandKey);
  return new RegExp(`(?:^|[^a-z0-9])${brandKey}(?:[^a-z0-9]|$)`).test(haystack);
}

function findKnownBrand(text: string): string | null {
  const haystack = compact(text);
  return KNOWN_BRANDS.find((brand) => containsBrandKey(haystack, compact(brand))) ?? null;
}

/**
 * Best-effort brand/product-name guess from OCR text — there's no format to
 * anchor on the way a date has one, so this is a heuristic the user is
 * expected to double-check, not a reliable parse. A known brand name (see
 * KNOWN_BRANDS) is matched first since it's unambiguous; otherwise, most
 * gifticon layouts put the brand above the product name, so the first two
 * non-boilerplate lines are read as (brand, name) in that order.
 */
export function guessBrandAndName(text: string): { brand: string | null; name: string | null } {
  const cleanLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isNoiseLine(line));

  const knownBrand = findKnownBrand(text);
  if (knownBrand) {
    const brandKey = compact(knownBrand);
    // A line that's nothing but the brand itself is excluded from being the
    // name too — but only an exact match: some brands' own menu items embed
    // the brand name (e.g. 설빙's "인절미설빙"), and excluding by mere
    // substring would wrongly throw away the real product name there.
    const name = cleanLines.find((line) => compact(line) !== brandKey);
    return { brand: knownBrand, name: name ?? null };
  }

  return { brand: cleanLines[0] ?? null, name: cleanLines[1] ?? null };
}
