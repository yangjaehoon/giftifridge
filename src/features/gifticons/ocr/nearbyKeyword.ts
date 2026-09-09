const KEYWORD_WINDOW = 15;

/**
 * A parsed value plus whether the pick was *anchored* — a nearby keyword, an
 * exact-format sole match, a scanned graphic — rather than a heuristic
 * tie-break among look-alikes (the latest of several undated dates, a lone
 * "N원" that might be a product price, a checksum guess). Drives the add-form
 * hint's confident-vs-soft-guess wording, and gates gallery auto-import (which
 * has no review step) to anchored reads only.
 */
export interface ParseResult<T> {
  value: T;
  confident: boolean;
}

// A prefix/suffix keyword nearby is what disambiguates which number in the
// text is the one we want (an expiry date among an issue date, a face value
// among a discounted one) — shared by the date/amount/barcode parsers so they
// don't drift on how "nearby" is decided.
export function hasNearbyKeyword(
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

/**
 * Shared by every "find the one match in this text that isn't ambiguous"
 * parser (date/amount/barcode): a keyword nearby resolves which match is the
 * one we want (an expiry date among an issue date, a face value among a
 * discounted one); with neither a single match nor a keyword to pick one, null
 * is returned rather than guessing.
 */
export function pickUnambiguousMatch<T extends { index: number; length: number }>(
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
