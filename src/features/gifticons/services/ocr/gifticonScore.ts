import { findKnownBrand } from './brands';
import { parseAmountFromText } from './amountParser';
import { parseBarcodeFromText } from './barcodeParser';
import { parseExpiryDateResult } from './dateParser';
import { countCardFooterLabels } from './fieldGuess';

// Words that only appear on a real gifticon (or its issuing platform).
const GIFTICON_KEYWORDS = ['기프티콘', '교환권', '모바일교환권', '쿠폰'];
const PLATFORM_KEYWORDS = ['선물하기', 'kakaotalk', '카카오톡', '기프티쇼', 'giftishow', 'syrup'];
// Words that mean this is a purchase receipt, not a gifticon — a receipt can
// otherwise carry a date and a known brand name and score like a gifticon.
const RECEIPT_KEYWORDS = [
  '영수증',
  '합계',
  '받으실금액',
  '받을금액',
  '거스름돈',
  '카드승인',
  '가맹점명',
];

// A no-review auto-import needs BOTH a confident expiry date and enough
// corroborating signal that this really is a gifticon card — not a dated
// receipt that names a brand, not a blog post about gifticons. The weights and
// threshold are a starting point; tune them against ocr/gifticonCorpus.test.ts,
// which reports precision/recall as the corpus grows.
const AUTO_IMPORT_THRESHOLD = 6;
const PROSE_MIN_LINES = 12;
const PROSE_MIN_AVG_LINE_LENGTH = 22;

export interface GifticonAssessment {
  /** Confident expiry ("YYYY-MM-DD"), or null. Auto-import is impossible
   *  without one — this flow never guesses the date. */
  expiresAt: string | null;
  /** Parsed once here and handed back so runScan doesn't parse them again. */
  textBarcode: string | null;
  amount: number | null;
  /** Weighted "how gifticon-like is this text" score. */
  score: number;
  /** Per-signal contributions, for the debug log and the corpus report. */
  signals: Record<string, number>;
  /** score ≥ threshold AND a confident date. */
  create: boolean;
}

function footerPoints(count: number): number {
  if (count >= 3) return 4;
  if (count === 2) return 3;
  if (count === 1) return 2;
  return 0;
}

/**
 * Scores a photo's OCR text for gallery auto-import and parses the fields the
 * caller will reuse. Pure and side-effect-free so the corpus harness can drive
 * it directly.
 */
export function assessGifticon(text: string): GifticonAssessment {
  const expiry = parseExpiryDateResult(text);
  const textBarcode = parseBarcodeFromText(text);
  const amount = parseAmountFromText(text);
  const footerLabels = countCardFooterLabels(text);
  const lower = text.toLowerCase();
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  const avgLineLength = lines.length > 0 ? text.length / lines.length : 0;

  const signals: Record<string, number> = {};
  const add = (name: string, points: number) => {
    if (points !== 0) signals[name] = (signals[name] ?? 0) + points;
  };

  if (expiry?.confident) add('confidentDate', 3);
  add('footerLabels', footerPoints(footerLabels));
  if (textBarcode != null) add('textBarcode', 2);
  if (findKnownBrand(text) != null) add('knownBrand', 2);
  if (GIFTICON_KEYWORDS.some((keyword) => text.includes(keyword))) add('gifticonKeyword', 2);
  if (PLATFORM_KEYWORDS.some((keyword) => lower.includes(keyword))) add('platform', 1);
  if (amount != null) add('amount', 1);
  if (RECEIPT_KEYWORDS.some((keyword) => text.includes(keyword))) add('receipt', -3);
  // A web article about gifticons rather than one: many long wrapped lines and
  // none of the card's key/value labels.
  if (
    footerLabels === 0 &&
    lines.length >= PROSE_MIN_LINES &&
    avgLineLength > PROSE_MIN_AVG_LINE_LENGTH
  ) {
    add('prose', -3);
  }

  const score = Object.values(signals).reduce((sum, points) => sum + points, 0);
  const expiresAt = expiry?.confident ? expiry.value : null;
  return {
    expiresAt,
    textBarcode,
    amount,
    score,
    signals,
    create: expiresAt != null && score >= AUTO_IMPORT_THRESHOLD,
  };
}
