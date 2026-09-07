import type { GifticonCategory } from '../../types';
import { parseExpiryDateFromText } from './dateParser';
import { compact, findKnownBrand, inferCategoryFromKeywords } from './brands';
import type { RecognizedLine, RecognizedText } from './recognize';

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

// The gifticon platform / wrapper the coupon was issued through — a logo band
// ("syrup gifticon"), an app-name caption ("kakaotalk 선물하기"), a stray
// "gifticon" watermark. Never a product name, but the Latin spellings slip
// past NOISE_KEYWORDS (which is Hangul and matched case-sensitively), and the
// Korean 기프티콘 there won't catch "gifticon"/"Gifticon"/"GIFTICON". Kept
// lowercase and tested against line.toLowerCase() so OCR casing doesn't matter.
const PLATFORM_NAMES = ['gifticon', 'giftishow', 'syrup', 'kakaotalk', '카카오톡', '선물하기'];
const MIN_LINE_LENGTH = 2;
const MAX_LINE_LENGTH = 30;
// A line this digit-dense reads as a barcode number or price, not text — but
// require a minimum digit count too, or short real brand names that happen to
// contain a couple of digits (e.g. "GS25", "seven eleven"-style codes) get
// misread as noise merely for being short.
const MIN_NOISE_DIGIT_COUNT = 4;
const MAX_DIGIT_RATIO = 0.4;

// A brand or product name always carries at least one letter (Hangul or
// Latin). A line made only of digits, punctuation and symbols — a screenshot's
// status-bar clock ("2:55"), a battery reading ("85%"), a phone number
// ("1544-1650") — is never the name, and the digit-density check above misses
// the short ones (too few digits to trip MIN_NOISE_DIGIT_COUNT).
const LETTER_RE = /[a-zA-Z가-힣]/;

function isNoiseLine(line: string): boolean {
  if (line.length < MIN_LINE_LENGTH || line.length > MAX_LINE_LENGTH) return true;
  if (!LETTER_RE.test(line)) return true;
  if (parseExpiryDateFromText(line) != null) return true;
  const digitCount = (line.match(/\d/g) ?? []).length;
  if (digitCount >= MIN_NOISE_DIGIT_COUNT && digitCount / line.length > MAX_DIGIT_RATIO)
    return true;
  if (NOISE_KEYWORDS.some((keyword) => line.includes(keyword))) return true;
  const lower = line.toLowerCase();
  return PLATFORM_NAMES.some((keyword) => lower.includes(keyword));
}

export interface GuessedGifticonFields {
  brand: string | null;
  name: string | null;
  /** From the matched KNOWN_BRANDS entry, or — when the brand is unlisted —
   * inferred from product-name keywords (see inferCategoryFromKeywords);
   * null when neither yields one. */
  category: GifticonCategory | null;
}

// Real gifticon layouts consistently render the brand/product-name headline
// noticeably larger than footer fine print (usage terms, refund notice,
// "전국 매장에서 사용 가능" disclaimers) — a more reliable "is this noise"
// signal than trying to keyword-list every possible disclaimer phrasing. A
// line under this fraction of the tallest remaining candidate's height reads
// as fine print rather than headline text.
const MIN_HEADLINE_HEIGHT_RATIO = 0.5;

// A logo or watermark (e.g. a "syrup gifticon" banner) can be drawn far bigger
// than the real brand/name headline; as the reference height it would drop the
// actual headline as "too small". When the tallest line towers over the
// next-tallest like that, use the next-tallest as the reference instead.
const HEIGHT_OUTLIER_RATIO = 1.7;

// The fixed key/value block every gifticon card carries below its headline:
// 교환처/사용처, 유효기간/유효기한, 주문번호/교환수량, plus the 바코드 label.
// The brand and product name are the lines just above it, so once this block
// starts nothing below it (a page's result title, share buttons, footer text
// OCR also picks up) is a name candidate.
const CARD_FOOTER_LABELS = [
  '교환처',
  '사용처',
  '유효기간',
  '유효기한',
  '사용기한',
  '주문번호',
  '교환수량',
  '바코드',
];

function cardFooterIndex(lines: RecognizedLine[]): number {
  const index = lines.findIndex((line) =>
    CARD_FOOTER_LABELS.some((label) => line.text.includes(label)),
  );
  return index === -1 ? lines.length : index;
}

/**
 * How many distinct labels from the fixed key/value block every gifticon card
 * carries (교환처 / 유효기간 / 주문번호 / 바코드 …) appear in the text. Two or
 * more is a strong "this is a gifticon card layout" signal — see
 * ocr/gifticonScore.
 */
export function countCardFooterLabels(text: string): number {
  return CARD_FOOTER_LABELS.filter((label) => text.includes(label)).length;
}

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
  heights.sort((a, b) => b - a);
  const reference =
    heights.length > 1 && heights[0] > heights[1] * HEIGHT_OUTLIER_RATIO ? heights[1] : heights[0];
  return lines.filter((line) => line.height >= reference * MIN_HEADLINE_HEIGHT_RATIO);
}

// A headline-sized line that reads as a sentence fragment bled in from a web
// page's result title ("있을까?", "…가격 알 수") rather than a product name:
// a lone character, or ending in sentence punctuation. Used only to skip over
// such a line when it lands between the brand and the real name — so it stays
// permissive (real names like "빙수"/"라떼" are two chars).
function looksLikeFragment(line: string): boolean {
  return line.length < 2 || /[?!]$/.test(line);
}

// OCR frays the ends of a line — a stray bracket from an adjacent logo
// ("syrup gifticon)"), a leading bullet, a trailing comma from a wrapped
// sentence, doubled inner spaces. Trims those before the value goes into the
// form, but leaves meaningful trailing marks alone ("라떼 2잔+", "R/L").
function tidy(value: string | null): string | null {
  if (value == null) return null;
  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—·•*|/\\]+/, '')
    .replace(/[\s\-–—·|/\\.,;:)\]}>]+$/, '')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Best-effort brand/name/category guess from OCR text — there's no format to
 * anchor on the way a date has one, so this is a heuristic the user is
 * expected to double-check, not a reliable parse. A known brand name (see
 * KNOWN_BRANDS) is matched first since it's unambiguous and also gives a
 * category; otherwise, most gifticon layouts put the brand above the product
 * name, so the first two non-boilerplate, headline-sized lines are read as
 * (brand, name) in that order, with no category guess.
 *
 * Candidate lines are limited to those above the card's key/value footer block
 * (see CARD_FOOTER_LABELS), which drops the page chrome OCR also captures when
 * the photo is a screenshot of a web/app page rather than the gifticon itself.
 */
export function guessGifticonFields(recognized: RecognizedText): GuessedGifticonFields {
  const headlineCandidates = recognized.lines.slice(0, cardFooterIndex(recognized.lines));
  const candidateLines = headlineCandidates
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
    const notJustBrand = (line: string) => compact(line) !== brandKey;
    const nameOf = (line: string) => notJustBrand(line) && !looksLikeFragment(line);
    // The product name sits right under the brand on a real gifticon, so anchor
    // on the line carrying the brand and take the *first* real headline after
    // it (skipping a result-title fragment like "있을까?" a web screenshot can
    // wedge in — see looksLikeFragment). When the brand only appears in the
    // footer table (an old "사용처 | 스타벅스" layout with no standalone brand
    // line) there's nothing to anchor to; the name is then the last headline
    // before that table, not the first, which would be the site/app name.
    const brandLineIndex = headlineLines.findIndex((line) => compact(line).includes(brandKey));
    const afterBrand = brandLineIndex === -1 ? [] : headlineLines.slice(brandLineIndex + 1);
    const nameAfterBrand = afterBrand.find(nameOf) ?? null;
    const lastBeforeFooter =
      [...headlineLines].reverse().find(nameOf) ??
      [...headlineLines].reverse().find(notJustBrand) ??
      null;
    return {
      brand: known.name,
      name: tidy(nameAfterBrand ?? lastBeforeFooter),
      category: known.category,
    };
  }

  const brand = tidy(headlineLines[0] ?? null);
  const name = tidy(headlineLines[1] ?? null);
  return { brand, name, category: inferCategoryFromKeywords(`${brand ?? ''} ${name ?? ''}`) };
}
