import { pickUnambiguousMatch } from './nearbyKeyword';

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
