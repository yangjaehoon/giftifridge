import { hasNearbyKeyword, pickUnambiguousMatch, type ParseResult } from './nearbyKeyword';

const AMOUNT_PREFIX_KEYWORDS = ['금액', '정가', '권면가액', '권종', '충전'];
// Plausible face-value bounds for a 금액권. Rejects an OCR misread that
// dropped or added digits ("100000000원") and small stray numbers that aren't
// a price at all (a "500원 할인" line, a "3원" fragment).
const MIN_AMOUNT = 1_000;
const MAX_AMOUNT = 10_000_000;

interface AmountMatch {
  index: number;
  length: number;
  amount: number;
}

// Each entry pulls a face value out of one written form. A trailing 원 (or a
// leading ₩) anchors a plain digit amount; 만 / 천 cover the Korean-numeral
// forms gift cards use ("5만원", "1만 5천원", "5천원") — those must still end in
// 원 so "5만 다운로드" is not read as a price.
const AMOUNT_PATTERNS: { re: RegExp; value: (m: RegExpMatchArray) => number }[] = [
  {
    re: /₩\s*(\d{1,3}(?:,\d{3})+|\d+)|(\d{1,3}(?:,\d{3})+|\d+)\s*원/g,
    value: (m) => Number((m[1] ?? m[2]).replace(/,/g, '')),
  },
  {
    re: /(\d+)\s*만\s*(?:(\d+)\s*천\s*)?원/g,
    value: (m) => Number(m[1]) * 10_000 + (m[2] ? Number(m[2]) * 1_000 : 0),
  },
  {
    re: /(\d+)\s*천\s*원/g,
    value: (m) => Number(m[1]) * 1_000,
  },
];

function collectAmountMatches(text: string): AmountMatch[] {
  const matches: AmountMatch[] = [];
  for (const { re, value } of AMOUNT_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const amount = value(m);
      if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) continue;
      const index = m.index ?? 0;
      const end = index + m[0].length;
      // A later pattern can re-match a fragment an earlier one already covered
      // ("5천원" inside "1만 5천원"); keep only the first, widest reading.
      if (matches.some((p) => index >= p.index && end <= p.index + p.length)) continue;
      matches.push({ index, length: m[0].length, amount });
    }
  }
  return matches;
}

function parse(text: string): ParseResult<number> | null {
  const matches = collectAmountMatches(text);
  const match = pickUnambiguousMatch(text, matches, AMOUNT_PREFIX_KEYWORDS, []);
  if (!match) return null;
  // A lone "N원" with no 금액/정가/충전 label could just as easily be a product
  // price as a stored-value face value, so it's only a confident read when a
  // keyword anchors it.
  const confident = hasNearbyKeyword(text, match.index, match.length, AMOUNT_PREFIX_KEYWORDS, []);
  return { value: match.amount, confident };
}

/**
 * Finds a single, unambiguous face-value-looking amount in OCR text — a
 * comma-grouped or plain "N원", a "₩N", or a Korean-numeral "N만/천원". A
 * gifticon showing more than one amount (e.g. an original price next to a
 * discounted one) is exactly the case a keyword nearby resolves; with neither
 * a single match nor a keyword to pick one, this returns null rather than
 * guess.
 */
export function parseAmountFromText(text: string): number | null {
  return parse(text)?.value ?? null;
}

/** As parseAmountFromText, but keeps the confidence flag (see ParseResult). */
export function parseAmountResult(text: string): ParseResult<number> | null {
  return parse(text);
}
