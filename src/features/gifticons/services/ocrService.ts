// OCR for the add-gifticon flow, split into focused modules under ./ocr:
//   - recognize      run ML Kit, normalise to { text, lines[] }
//   - dateParser     expiry date out of the text
//   - amountParser   face value out of the text
//   - barcodeParser  barcode number out of the text (fallback for an unreadable graphic)
//   - fieldGuess     best-effort brand / name / category
//   - brands         the known-brand + category-keyword data fieldGuess leans on
//   - nearbyKeyword  the "which of several matches is the unambiguous one" helper
//     the three parsers share
// This module is the public surface the app imports; the pieces are tested
// next to their own files.
export { recognizeText } from './ocr/recognize';
export type { RecognizedLine, RecognizedText } from './ocr/recognize';
export type { ParseResult } from './ocr/nearbyKeyword';
export { parseExpiryDateFromText, parseExpiryDateResult } from './ocr/dateParser';
export { parseAmountFromText, parseAmountResult } from './ocr/amountParser';
export { parseBarcodeFromText, parseBarcodeResult } from './ocr/barcodeParser';
export { guessGifticonFields, countCardFooterLabels } from './ocr/fieldGuess';
export type { GuessedGifticonFields } from './ocr/fieldGuess';
export { findKnownBrand } from './ocr/brands';
export type { KnownBrand } from './ocr/brands';
export {
  assessGifticon,
  isItemCouponPrice,
  isRetryWorthwhile,
  resolveImportAmount,
} from './ocr/gifticonScore';
export type { GifticonAssessment } from './ocr/gifticonScore';
