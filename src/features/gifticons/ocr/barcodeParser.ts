import { hasNearbyKeyword, pickUnambiguousMatch, type ParseResult } from './nearbyKeyword';

const BARCODE_PREFIX_KEYWORDS = ['바코드'];
// A digit run sitting right after one of these is an order / approval number,
// not the redeemable barcode. Such a run is set aside unless it's the only
// candidate there is.
const BARCODE_NEGATIVE_KEYWORDS = ['주문번호', '주문 번호', '교환번호', '쿠폰번호', '승인번호'];
// A barcode number is a long run of digits, but OCR of a printed gifticon just
// as often reads it in equal 3-6 digit groups split by a single space or
// hyphen ("2226 1288 9031") as in one unbroken run. Both forms are collected;
// a comma-grouped amount ("10,000") and a dot-separated date ("2016.09.11")
// are not, since neither separator is joined. A grouped run needs 3+ groups of
// 3+ digits each: 2-digit groups rule out a Korean-style date read as
// "2024 08 08", and the 3-group floor rules out two unrelated 6-digit numbers
// that happen to sit a space apart. The joined length must still land in the
// 12-20 range below, which keeps out a Korean mobile number written without
// dashes (10-11 digits).
//
// This stays a heuristic: a non-barcode number that is nonetheless printed as
// 3+ equal digit groups totalling 12-20 digits — a spaced order number, a
// three-item price list bled in from a web-search screenshot, a hyphen-grouped
// 0504 relay number — is still returned when it is the *only* such candidate
// in the text. With more than one candidate and no nearby "바코드" label, one
// carrying a valid EAN/UPC check digit is taken; failing that it is left
// unresolved rather than guessed at (same ambiguity rule as the date/amount
// parsers), and either way the user reviews the field before save.
const MIN_BARCODE_DIGITS = 12;
const MAX_BARCODE_DIGITS = 20;

const UNBROKEN_DIGITS_RE = /\d+/g;
const GROUPED_DIGITS_RE = /\d{3,6}(?:[ -]\d{3,6}){2,}/g;
const NEGATIVE_KEYWORD_WINDOW = 12;

interface BarcodeTextMatch {
  index: number;
  length: number;
  digits: string;
}

function collectBarcodeMatches(text: string): BarcodeTextMatch[] {
  const matches: BarcodeTextMatch[] = [];
  const seen = new Set<string>();

  const add = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < MIN_BARCODE_DIGITS || digits.length > MAX_BARCODE_DIGITS) return;
    // The same number printed twice on a card (under the barcode and again in a
    // details row) is one candidate, not an ambiguous pair.
    if (seen.has(digits)) return;
    seen.add(digits);
    // index/length locate the run in the original text for the nearby-keyword
    // check; `digits` is the returned separator-free number.
    matches.push({ index, length: raw.length, digits });
  };

  for (const m of text.matchAll(GROUPED_DIGITS_RE)) add(m.index ?? 0, m[0]);
  for (const m of text.matchAll(UNBROKEN_DIGITS_RE)) add(m.index ?? 0, m[0]);
  return matches;
}

// A label like "주문번호" immediately before the run (only separators between
// it and the first digit) marks it as not-the-barcode.
function isOrderNumber(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - NEGATIVE_KEYWORD_WINDOW), index);
  return BARCODE_NEGATIVE_KEYWORDS.some((keyword) => {
    const at = before.lastIndexOf(keyword);
    return at !== -1 && !/\d/.test(before.slice(at + keyword.length));
  });
}

// EAN-13 / UPC-A check digit. Used only to break a tie between keyword-less
// candidates — a gifticon barcode that isn't an EAN/UPC number (a plain
// CODE-128 payload) simply won't match, and that's fine. (The length-8 arm is
// dead given MIN_BARCODE_DIGITS = 12, kept only so the formula reads
// completely; EAN-8 would need the floor lowered to reach it.)
function hasValidCheckDigit(digits: string): boolean {
  if (digits.length !== 8 && digits.length !== 12 && digits.length !== 13) return false;
  const oddWeight = digits.length === 13 ? 1 : 3;
  const evenWeight = digits.length === 13 ? 3 : 1;
  let sum = 0;
  for (let i = 0; i < digits.length - 1; i += 1) {
    sum += (digits.charCodeAt(i) - 48) * (i % 2 === 0 ? oddWeight : evenWeight);
  }
  return (10 - (sum % 10)) % 10 === digits.charCodeAt(digits.length - 1) - 48;
}

function parse(text: string): ParseResult<string> | null {
  const all = collectBarcodeMatches(text);
  const notOrderNumber = all.filter((m) => !isOrderNumber(text, m.index));
  const pool = notOrderNumber.length > 0 ? notOrderNumber : all;

  const picked = pickUnambiguousMatch(text, pool, BARCODE_PREFIX_KEYWORDS, []);
  if (picked) {
    // A "바코드" label next to it is a confident read; a lone candidate with no
    // label is plausible but unverified.
    const confident = hasNearbyKeyword(
      text,
      picked.index,
      picked.length,
      BARCODE_PREFIX_KEYWORDS,
      [],
    );
    return { value: picked.digits, confident };
  }

  // Tie among keyword-less candidates: a valid EAN/UPC check digit points at
  // the real one, but an ISBN or a product EAN in the fine print can pass too,
  // so it's never a confident read.
  const checksummed = pool.filter((m) => hasValidCheckDigit(m.digits));
  return checksummed.length === 1 ? { value: checksummed[0].digits, confident: false } : null;
}

/**
 * Finds a single, unambiguous barcode-number-looking digit run in OCR text —
 * a fallback for when the barcode graphic itself couldn't be read
 * (recognizeBarcodeFromImage returned null; blur/glare on the photo), since
 * the same number is almost always also printed as text beneath it.
 */
export function parseBarcodeFromText(text: string): string | null {
  return parse(text)?.value ?? null;
}

/** As parseBarcodeFromText, but keeps the confidence flag (see ParseResult). */
export function parseBarcodeResult(text: string): ParseResult<string> | null {
  return parse(text);
}
