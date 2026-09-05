import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { toDateString } from '../../../shared/utils/date';
import type { GifticonCategory } from '../types';

const KEYWORD_WINDOW = 15;

// A prefix/suffix keyword nearby is what disambiguates which number in the
// text is the one we want (an expiry date among an issue date, a face value
// among a discounted one) — shared by parseExpiryDateFromText and
// parseAmountFromText so the two don't drift on how "nearby" is decided.
function hasNearbyKeyword(
  text: string,
  index: number,
  length: number,
  prefixKeywords: string[],
  suffixKeywords: string[],
): boolean {
  const before = text.slice(Math.max(0, index - KEYWORD_WINDOW), index);
  const after = text.slice(index + length, Math.min(text.length, index + length + KEYWORD_WINDOW));
  return (
    prefixKeywords.some((keyword) => before.includes(keyword)) ||
    suffixKeywords.some((keyword) => after.includes(keyword))
  );
}

// Shared by every "find the one match in this text that isn't ambiguous"
// parser below (date/amount/barcode): a keyword nearby resolves which match
// is the one we want (an expiry date among an issue date, a face value among
// a discounted one); with neither a single match nor a keyword to pick one,
// null is returned rather than guessing.
function pickUnambiguousMatch<T extends { index: number; length: number }>(
  text: string,
  matches: T[],
  prefixKeywords: string[],
  suffixKeywords: string[],
): T | null {
  if (matches.length === 0) return null;
  const withKeyword = matches.filter((match) =>
    hasNearbyKeyword(text, match.index, match.length, prefixKeywords, suffixKeywords),
  );
  const candidates = withKeyword.length > 0 ? withKeyword : matches;
  return candidates.length === 1 ? candidates[0] : null;
}

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

const AMOUNT_PREFIX_KEYWORDS = ['금액', '정가', '권면가액', '충전'];
// A face value is always immediately followed by "원" ("₩" is rare in OCR
// text), so that's the anchor — unlike a date, there's no separate suffix
// keyword to lean on.
const AMOUNT_RE = /(\d{1,3}(?:,\d{3})+|\d+)\s*원/g;

interface AmountMatch {
  index: number;
  length: number;
  amount: number;
}

function collectAmountMatches(text: string): AmountMatch[] {
  const matches: AmountMatch[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const amount = Number(m[1].replace(/,/g, ''));
    if (amount <= 0) continue;
    matches.push({ index: m.index ?? 0, length: m[0].length, amount });
  }
  return matches;
}

/**
 * Finds a single, unambiguous face-value-looking amount ("10,000원") in OCR
 * text. A gifticon showing more than one "N원" (e.g. an original price next
 * to a discounted one) is exactly the case a keyword nearby resolves; with
 * neither a single match nor a keyword to pick one, this returns null rather
 * than guess.
 */
export function parseAmountFromText(text: string): number | null {
  const matches = collectAmountMatches(text);
  const match = pickUnambiguousMatch(text, matches, AMOUNT_PREFIX_KEYWORDS, []);
  return match?.amount ?? null;
}

export interface RecognizedLine {
  text: string;
  /** Line height in pixels — a proxy for font size, used to tell headline
   * text (brand/product name) apart from the fine-print footer text real
   * gifticon layouts consistently render smaller (see guessGifticonFields).
   * 0 when this build/platform doesn't report a frame for the line. */
  height: number;
}

export interface RecognizedText {
  text: string;
  lines: RecognizedLine[];
}

/** Raw OCR result, or null if recognition failed. Callers derive whatever
 * they need from it (parseExpiryDateFromText, guessGifticonFields) — kept as
 * one recognition pass since running OCR twice per photo would be wasteful. */
export async function recognizeText(imageUri: string): Promise<RecognizedText | null> {
  try {
    const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.KOREAN);
    // Degrade to an empty line list (not a thrown/null result) if a native
    // build ever returns text without a matching blocks structure — the raw
    // text and its date/amount parsing are still worth having even without
    // per-line heights.
    const lines = (result.blocks ?? []).flatMap((block) =>
      block.lines.map((line) => ({ text: line.text, height: line.frame?.height ?? 0 })),
    );
    return { text: result.text, lines };
  } catch {
    return null;
  }
}

const BARCODE_PREFIX_KEYWORDS = ['바코드'];
// A barcode number is printed as one unbroken run of digits — unlike a
// comma-grouped amount ("10,000") or a dash-separated phone number
// ("1544-1650"), both of which break into shorter runs once split on any
// non-digit character. The minimum is set above a Korean mobile number
// written without dashes (10-11 digits) since gifticon barcodes are
// realistically EAN-13 or longer; a run in range that isn't actually a
// barcode either needs a nearby "바코드" label to be picked, or, lacking
// one, is left unresolved rather than guessed at (same ambiguity rule as
// the date/amount parsers above).
const MIN_BARCODE_DIGITS = 12;
const MAX_BARCODE_DIGITS = 20;

interface BarcodeTextMatch {
  index: number;
  length: number;
  digits: string;
}

function collectBarcodeMatches(text: string): BarcodeTextMatch[] {
  const matches: BarcodeTextMatch[] = [];
  for (const m of text.matchAll(/\d+/g)) {
    const digits = m[0];
    if (digits.length < MIN_BARCODE_DIGITS || digits.length > MAX_BARCODE_DIGITS) continue;
    matches.push({ index: m.index ?? 0, length: digits.length, digits });
  }
  return matches;
}

/**
 * Finds a single, unambiguous barcode-number-looking digit run in OCR text —
 * a fallback for when the barcode graphic itself couldn't be read
 * (recognizeBarcodeFromImage returned null; blur/glare on the photo), since
 * the same number is almost always also printed as text beneath it.
 */
export function parseBarcodeFromText(text: string): string | null {
  const matches = collectBarcodeMatches(text);
  const match = pickUnambiguousMatch(text, matches, BARCODE_PREFIX_KEYWORDS, []);
  return match?.digits ?? null;
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

interface KnownBrand {
  name: string;
  category: GifticonCategory;
}

// Common Korean gifticon brands, checked before falling back to the
// position-based guess below — a known name pins the brand (and its
// category) correctly regardless of which line it lands on (and regardless
// of whether that line would otherwise be filtered as noise, e.g. "전국
// GS25 매장에서 사용 가능"). Not exhaustive: a brand missing from this list
// still gets a brand/name guess via the position fallback, just no category.
const KNOWN_BRANDS: KnownBrand[] = [
  // 카페/디저트음료
  { name: '스타벅스', category: 'cafe' },
  { name: '이디야', category: 'cafe' },
  { name: '투썸플레이스', category: 'cafe' },
  { name: '메가커피', category: 'cafe' },
  { name: '컴포즈커피', category: 'cafe' },
  { name: '빽다방', category: 'cafe' },
  { name: '폴바셋', category: 'cafe' },
  { name: '커피빈', category: 'cafe' },
  { name: '할리스', category: 'cafe' },
  { name: '파스쿠찌', category: 'cafe' },
  { name: '엔젤리너스', category: 'cafe' },
  { name: '탐앤탐스', category: 'cafe' },
  { name: '만랩커피', category: 'cafe' },
  { name: '공차', category: 'cafe' },
  { name: '매머드커피', category: 'cafe' },
  { name: '더벤티', category: 'cafe' },
  { name: '요거프레소', category: 'cafe' },
  { name: '스무디킹', category: 'cafe' },
  { name: '잠바주스', category: 'cafe' },
  // 편의점
  { name: 'GS25', category: 'convenience' },
  { name: 'CU', category: 'convenience' },
  { name: '세븐일레븐', category: 'convenience' },
  { name: '이마트24', category: 'convenience' },
  { name: '미니스톱', category: 'convenience' },
  // 패스트푸드/치킨/피자
  { name: '맥도날드', category: 'restaurant' },
  { name: '버거킹', category: 'restaurant' },
  { name: '롯데리아', category: 'restaurant' },
  { name: 'KFC', category: 'restaurant' },
  { name: '맘스터치', category: 'restaurant' },
  { name: '서브웨이', category: 'restaurant' },
  { name: '노브랜드버거', category: 'restaurant' },
  { name: '쉐이크쉑', category: 'restaurant' },
  { name: '교촌치킨', category: 'restaurant' },
  { name: '굽네치킨', category: 'restaurant' },
  { name: 'bhc', category: 'restaurant' },
  { name: 'BBQ', category: 'restaurant' },
  { name: '네네치킨', category: 'restaurant' },
  { name: '처갓집양념치킨', category: 'restaurant' },
  { name: '페리카나', category: 'restaurant' },
  { name: '호식이두마리치킨', category: 'restaurant' },
  { name: '노랑통닭', category: 'restaurant' },
  { name: '푸라닭', category: 'restaurant' },
  { name: '자담치킨', category: 'restaurant' },
  { name: '또래오래', category: 'restaurant' },
  { name: '도미노피자', category: 'restaurant' },
  { name: '피자헛', category: 'restaurant' },
  { name: '미스터피자', category: 'restaurant' },
  { name: '파파존스', category: 'restaurant' },
  // 베이커리/디저트
  { name: '배스킨라빈스', category: 'cafe' },
  { name: '던킨', category: 'cafe' },
  { name: '파리바게뜨', category: 'cafe' },
  { name: '뚜레쥬르', category: 'cafe' },
  { name: '파리크라상', category: 'cafe' },
  { name: '크리스피크림도넛', category: 'cafe' },
  { name: '설빙', category: 'cafe' },
  { name: '나뚜루', category: 'cafe' },
  { name: '콜드스톤', category: 'cafe' },
  // 문화
  { name: 'CGV', category: 'culture' },
  { name: '롯데시네마', category: 'culture' },
  { name: '메가박스', category: 'culture' },
  { name: '교보문고', category: 'culture' },
  { name: '영풍문고', category: 'culture' },
  // 기타
  { name: '올리브영', category: 'etc' },
  { name: '다이소', category: 'etc' },
  { name: '시코르', category: 'etc' },
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

function findKnownBrand(text: string): KnownBrand | null {
  const haystack = compact(text);
  return KNOWN_BRANDS.find((brand) => containsBrandKey(haystack, compact(brand.name))) ?? null;
}

export interface GuessedGifticonFields {
  brand: string | null;
  name: string | null;
  /** Only set when the brand matched KNOWN_BRANDS — there's no positional
   * fallback for category the way there is for brand/name. */
  category: GifticonCategory | null;
}

// Real gifticon layouts consistently render the brand/product-name headline
// noticeably larger than footer fine print (usage terms, refund notice,
// "전국 매장에서 사용 가능" disclaimers) — a more reliable "is this noise"
// signal than trying to keyword-list every possible disclaimer phrasing. A
// line under this fraction of the tallest remaining candidate's height reads
// as fine print rather than headline text.
const MIN_HEADLINE_HEIGHT_RATIO = 0.5;

function keepHeadlineSizedLines(lines: RecognizedLine[]): RecognizedLine[] {
  const heights = lines.map((line) => line.height).filter((h) => h > 0);
  // No line in this whole recognition pass has height data — this platform/
  // build never reports a frame, so there's nothing to compare against and
  // every line is kept as before this feature existed. A single OTHER line
  // missing just its own frame while its siblings have real heights is
  // deliberately not given the same pass here — height=0 there just means
  // "unverified", and this feature's whole point is not to trust unverified
  // lines as headline text.
  if (heights.length === 0) return lines;
  const maxHeight = Math.max(...heights);
  return lines.filter((line) => line.height >= maxHeight * MIN_HEADLINE_HEIGHT_RATIO);
}

/**
 * Best-effort brand/name/category guess from OCR text — there's no format to
 * anchor on the way a date has one, so this is a heuristic the user is
 * expected to double-check, not a reliable parse. A known brand name (see
 * KNOWN_BRANDS) is matched first since it's unambiguous and also gives a
 * category; otherwise, most gifticon layouts put the brand above the product
 * name, so the first two non-boilerplate, headline-sized lines are read as
 * (brand, name) in that order, with no category guess.
 */
export function guessGifticonFields(recognized: RecognizedText): GuessedGifticonFields {
  const candidateLines = recognized.lines
    .map((line) => ({ text: line.text.trim(), height: line.height }))
    .filter((line) => line.text.length > 0 && !isNoiseLine(line.text));
  const headlineLines = keepHeadlineSizedLines(candidateLines).map((line) => line.text);

  const known = findKnownBrand(recognized.text);
  if (known) {
    const brandKey = compact(known.name);
    // A line that's nothing but the brand itself is excluded from being the
    // name too — but only an exact match: some brands' own menu items embed
    // the brand name (e.g. 설빙's "인절미설빙"), and excluding by mere
    // substring would wrongly throw away the real product name there.
    const name = headlineLines.find((line) => compact(line) !== brandKey);
    return { brand: known.name, name: name ?? null, category: known.category };
  }

  return { brand: headlineLines[0] ?? null, name: headlineLines[1] ?? null, category: null };
}
