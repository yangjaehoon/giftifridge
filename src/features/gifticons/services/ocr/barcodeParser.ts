import { pickUnambiguousMatch } from './nearbyKeyword';

const BARCODE_PREFIX_KEYWORDS = ['바코드'];
// A barcode number is printed as one unbroken run of digits — unlike a
// comma-grouped amount ("10,000") or a dash-separated phone number
// ("1544-1650"), both of which break into shorter runs once split on any
// non-digit character. The minimum is set above a Korean mobile number
// written without dashes (10-11 digits) since gifticon barcodes are
// realistically EAN-13 or longer; a run in range that isn't actually a
// barcode either needs a nearby "바코드" label to be picked, or, lacking
// one, is left unresolved rather than guessed at (same ambiguity rule as
// the date/amount parsers).
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
