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
export { recognizeText } from './recognize';
export type { RecognizedLine, RecognizedText } from './recognize';
export type { ParseResult } from './nearbyKeyword';
export { parseExpiryDateFromText, parseExpiryDateResult } from './dateParser';
export { parseAmountFromText, parseAmountResult } from './amountParser';
export { parseBarcodeFromText, parseBarcodeResult } from './barcodeParser';
export { guessGifticonFields, countCardFooterLabels } from './fieldGuess';
export type { GuessedGifticonFields } from './fieldGuess';
export { findKnownBrand } from './brands';
export type { KnownBrand } from './brands';
export {
  assessGifticon,
  isItemCouponPrice,
  isRetryWorthwhile,
  resolveImportAmount,
} from './gifticonScore';
export type { GifticonAssessment } from './gifticonScore';
