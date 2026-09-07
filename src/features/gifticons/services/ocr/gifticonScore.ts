import { daysUntil } from '../../../../shared/utils/date';
import type { GifticonCategory } from '../../types';
import { findKnownBrand } from './brands';
import { parseAmountResult } from './amountParser';
import { parseBarcodeFromText } from './barcodeParser';
import { parseExpiryDateResult } from './dateParser';
import { countCardFooterLabels } from './fieldGuess';

// Words that only appear on a real gifticon (or its issuing platform).
const GIFTICON_KEYWORDS = ['기프티콘', '교환권', '모바일교환권', '쿠폰'];
const PLATFORM_KEYWORDS = ['선물하기', 'kakaotalk', '카카오톡', '기프티쇼', 'giftishow', 'syrup'];
// Words that mean this is a purchase receipt, not a gifticon — a receipt can
// otherwise carry a date and a known brand name and score like a gifticon.
// All receipt-specific; "합계" was dropped as too generic (a multi-item gift
// set can carry it).
const RECEIPT_KEYWORDS = ['영수증', '받으실금액', '받을금액', '거스름돈', '카드승인', '가맹점명'];

// A no-review auto-import needs BOTH a confident expiry date and enough
// corroborating signal that this really is a gifticon card — not a dated
// receipt that names a brand, not a blog post about gifticons. The weights and
// threshold are a starting point; tune them against ocr/gifticonCorpus.test.ts,
// which reports precision/recall as the corpus grows.
const AUTO_IMPORT_THRESHOLD = 6;
const PROSE_MIN_LINES = 12;
const PROSE_MIN_AVG_LINE_LENGTH = 22;
// A confident expiry more than this many days in the past is more likely an OCR
// year-misread (2026 → 2021) on a just-photographed gifticon than a genuinely
// long-expired one — so a no-review import won't run on it. The add form keeps
// such a date (the user sees and corrects it).
const STALE_EXPIRY_DAYS = 14;

export interface GifticonAssessment {
  /** Confident, non-stale expiry ("YYYY-MM-DD"), or null. Auto-import is
   *  impossible without one — this flow never guesses or trusts a stale date. */
  expiresAt: string | null;
  /** Parsed once here and handed back so runScan doesn't parse them again. */
  textBarcode: string | null;
  amount: number | null;
  /** Whether `amount` came from a 금액/₩/만원-style anchor rather than a bare
   *  "N원" that might be a printed product price. */
  amountConfident: boolean;
  /** Weighted "how gifticon-like is this text" score. */
  score: number;
  /** Per-signal contributions, for the debug log and the corpus report. */
  signals: Record<string, number>;
  /** score ≥ threshold AND a confident, non-stale date. */
  create: boolean;
}

function footerPoints(count: number): number {
  if (count >= 3) return 4;
  if (count === 2) return 3;
  if (count === 1) return 2;
  return 0;
}

/**
 * A parsed amount with no 금액/₩/만원-style anchor, on a category whose
 * gifticons are fixed-item coupons rather than stored-value cards, is almost
 * certainly a printed product price — not a face value. The no-review import
 * drops it; the add form keeps it as a soft guess for the user to confirm.
 *
 * `culture` is deliberately not covered: 영화관람권 with a printed price would
 * slip through, but 문화상품권 / 도서상품권 (same category) are genuine
 * stored-value vouchers and must keep their amount.
 */
export function isItemCouponPrice(
  amount: { confident: boolean } | null,
  category: GifticonCategory | null,
): boolean {
  return amount != null && !amount.confident && (category === 'cafe' || category === 'restaurant');
}

/** The amount to actually save: the parsed value, unless it reads as a printed
 *  item price (see isItemCouponPrice). Shared by runScan and the corpus harness
 *  so "what amount gets imported" is defined once. */
export function resolveImportAmount(
  assessment: Pick<GifticonAssessment, 'amount' | 'amountConfident'>,
  category: GifticonCategory | null,
): number | null {
  const parsed = assessment.amount != null ? { confident: assessment.amountConfident } : null;
  return isItemCouponPrice(parsed, category) ? null : assessment.amount;
}

/**
 * Scores a photo's OCR text for gallery auto-import and parses the fields the
 * caller will reuse. Side-effect-free, but *not* a pure function of `text`
 * alone: the staleness check below reads the current date.
 */
export function assessGifticon(text: string): GifticonAssessment {
  const expiry = parseExpiryDateResult(text);
  const textBarcode = parseBarcodeFromText(text);
  const amountResult = parseAmountResult(text);
  const footerLabels = countCardFooterLabels(text);
  const lower = text.toLowerCase();
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  const avgLineLength = lines.length > 0 ? text.length / lines.length : 0;

  const signals: Record<string, number> = {};
  const add = (name: string, points: number) => {
    if (points !== 0) signals[name] = (signals[name] ?? 0) + points;
  };

  const dateIsStale = expiry?.confident === true && daysUntil(expiry.value) < -STALE_EXPIRY_DAYS;

  if (expiry?.confident) add('confidentDate', 3);
  // A stale date already blocks the import via `expiresAt == null` below; this
  // -3 only keeps the logged/reported score honest about why.
  if (dateIsStale) add('staleExpiry', -3);
  add('footerLabels', footerPoints(footerLabels));
  if (textBarcode != null) add('textBarcode', 2);
  if (findKnownBrand(text) != null) add('knownBrand', 2);
  if (GIFTICON_KEYWORDS.some((keyword) => text.includes(keyword))) add('gifticonKeyword', 2);
  if (PLATFORM_KEYWORDS.some((keyword) => lower.includes(keyword))) add('platform', 1);
  if (amountResult != null) add('amount', 1);
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
  const expiresAt = expiry?.confident && !dateIsStale ? expiry.value : null;
  return {
    expiresAt,
    textBarcode,
    amount: amountResult?.value ?? null,
    amountConfident: amountResult?.confident ?? false,
    score,
    signals,
    create: expiresAt != null && score >= AUTO_IMPORT_THRESHOLD,
  };
}
