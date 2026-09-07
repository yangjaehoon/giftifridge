import { pickUnambiguousMatch } from './nearbyKeyword';

const BARCODE_PREFIX_KEYWORDS = ['바코드'];
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
// in the text. With more than one candidate and no nearby "바코드" label it is
// left unresolved rather than guessed at (same ambiguity rule as the
// date/amount parsers), and either way the user reviews the field before save.
const MIN_BARCODE_DIGITS = 12;
const MAX_BARCODE_DIGITS = 20;

const UNBROKEN_DIGITS_RE = /\d+/g;
const GROUPED_DIGITS_RE = /\d{3,6}(?:[ -]\d{3,6}){2,}/g;

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
