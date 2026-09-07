import { useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  findKnownBrand,
  guessGifticonFields,
  parseAmountFromText,
  parseBarcodeFromText,
  parseExpiryDateFromText,
  recognizeText,
} from '../services/ocrService';
import { recognizeBarcodeFromImage } from '../services/barcodeRecognition';
import { ocrDebugLog } from '../services/ocr/debugLog';
import { parseDate } from '../../../shared/utils/date';
import { alertPermissionDenied } from '../../../shared/utils/permissionAlert';
import type { AutofillField } from './useGifticonForm';
import type { GifticonCategory } from '../types';

interface Options {
  /** Store the chosen local uri (form.setImage). */
  onImageChosen: (uri: string) => void;
  /** Apply an OCR-detected expiry date (form.detectExpiresAt). */
  onExpiryDetected: (date: Date) => void;
  /** Apply an OCR-guessed product name (form.detectName). */
  onNameDetected: (name: string) => void;
  /** Apply an OCR-guessed brand (form.detectBrand). */
  onBrandDetected: (brand: string) => void;
  /** Apply a barcode read from the photo itself (form.detectBarcode). */
  onBarcodeDetected: (barcode: string) => void;
  /** Apply a category inferred from a recognized known brand (form.detectCategory). */
  onCategoryDetected: (category: GifticonCategory) => void;
  /** Apply an OCR-detected face value (form.detectAmount). */
  onAmountDetected: (amount: number) => void;
  /** Whether the user has already committed a value to this field by hand
   *  (typed/scanned it, or it was hydrated from an existing gifticon) — an
   *  auto-fill never overwrites such a field. Owned by useGifticonForm and
   *  read here at detect time, i.e. after a slow recognition pass resolves, so
   *  it must reflect edits made while that pass was still running. */
  isFieldEdited: (field: AutofillField) => boolean;
}

// One auto-fillable field's "was it just auto-filled" flag, plus whether that
// fill was a confident read or a soft guess (drives the hint's wording/colour).
// The "did the user override it by hand" guard lives in useGifticonForm
// (isFieldEdited) so the screen doesn't have to keep two copies in sync;
// adding another detected field here is still one line.
function useDetectedField<T>(
  key: AutofillField,
  apply: (value: T) => void,
  isFieldEdited: (field: AutofillField) => boolean,
) {
  const [autoDetected, setAutoDetected] = useState(false);
  const [confident, setConfident] = useState(true);

  const detect = (value: T, isConfident = true) => {
    if (isFieldEdited(key)) return;
    apply(value);
    setConfident(isConfident);
    setAutoDetected(true);
  };
  const reset = () => setAutoDetected(false);

  // Once the user edits the field, the "we guessed this, check it" hint no
  // longer applies — they've just checked it. Derived rather than cleared on
  // edit so the two hooks don't have to talk (the edit re-renders the screen,
  // which recomputes this).
  return { autoDetected: autoDetected && !isFieldEdited(key), confident, detect, reset };
}

/**
 * Owns picking a gifticon photo (library or camera) and everything that gets
 * read from it afterward: expiry date, a best-effort brand/name/category
 * guess (OCR), a face-value amount, and any barcode already visible in the
 * photo. A single run token guards every field (a slow recognition pass for an
 * earlier image can't overwrite a newer one); the "user edited this by hand"
 * guard — an auto-fill never clobbers something the user typed/scanned/picked
 * themselves, and picking a different photo afterward can't undo that — is
 * `isFieldEdited`, owned by useGifticonForm.
 */
export function useGifticonImage({
  onImageChosen,
  onExpiryDetected,
  onNameDetected,
  onBrandDetected,
  onBarcodeDetected,
  onCategoryDetected,
  onAmountDetected,
  isFieldEdited,
}: Options) {
  const [recognizing, setRecognizing] = useState(false);
  const date = useDetectedField('expiresAt', onExpiryDetected, isFieldEdited);
  const name = useDetectedField('name', onNameDetected, isFieldEdited);
  const brand = useDetectedField('brand', onBrandDetected, isFieldEdited);
  const barcode = useDetectedField('barcode', onBarcodeDetected, isFieldEdited);
  const category = useDetectedField('category', onCategoryDetected, isFieldEdited);
  const amount = useDetectedField('amount', onAmountDetected, isFieldEdited);
  const runRef = useRef(0);

  const recognizeFields = async (uri: string) => {
    const run = ++runRef.current;
    date.reset();
    name.reset();
    brand.reset();
    barcode.reset();
    category.reset();
    amount.reset();
    setRecognizing(true);
    try {
      const [recognized, scannedBarcode] = await Promise.all([
        recognizeText(uri),
        recognizeBarcodeFromImage(uri),
      ]);
      if (run !== runRef.current) return; // a newer image was picked meanwhile

      const guessed = recognized ? guessGifticonFields(recognized) : null;
      // A brand/name/category anchored on a known brand is a confident read;
      // the position-based fallback (and a category merely inferred from
      // product-name keywords) is a soft guess the hint should flag as such.
      const brandKnown = recognized != null && findKnownBrand(recognized.text) != null;
      const detectedDate = recognized ? parseExpiryDateFromText(recognized.text) : null;
      const detectedAmount = recognized ? parseAmountFromText(recognized.text) : null;
      // The photo's barcode graphic is the primary source; the same number
      // printed as text beneath it is a fallback for when the graphic itself
      // couldn't be read (blur, glare).
      const detectedBarcode =
        scannedBarcode ?? (recognized ? parseBarcodeFromText(recognized.text) : null);

      if (detectedDate) date.detect(parseDate(detectedDate));
      if (guessed?.name) name.detect(guessed.name, brandKnown);
      if (guessed?.brand) brand.detect(guessed.brand, brandKnown);
      if (guessed?.category) category.detect(guessed.category, brandKnown);
      if (detectedAmount != null) amount.detect(detectedAmount);
      if (detectedBarcode) barcode.detect(detectedBarcode);

      ocrDebugLog('add-form recognized', {
        textRead: recognized != null,
        brand: guessed?.brand ?? null,
        name: guessed?.name ?? null,
        category: guessed?.category ?? null,
        brandKnown,
        expiresAt: detectedDate,
        amount: detectedAmount,
        barcode: detectedBarcode,
        barcodeFrom: scannedBarcode ? 'graphic' : detectedBarcode ? 'text' : null,
      });
    } finally {
      if (run === runRef.current) setRecognizing(false);
    }
  };

  // recognizeFields only resets the "just auto-filled" flags, never the
  // edited-by-hand guards (those live in useGifticonForm): once a field holds
  // real content — typed by the user, hydrated from an existing gifticon, or a
  // still-standing OCR guess from an earlier photo the user chose to keep —
  // picking a different photo must not silently clobber it. A field becomes
  // overwritable again only if it was never claimed.
  const handlePicked = (uri: string) => {
    onImageChosen(uri);
    recognizeFields(uri);
  };

  const pickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled) handlePicked(result.assets[0].uri);
    } catch {
      alertPermissionDenied('오류', '사진첩에 접근하지 못했어요. 권한을 확인해주세요.');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled) handlePicked(result.assets[0].uri);
    } catch {
      alertPermissionDenied('오류', '카메라를 사용하지 못했어요. 권한을 확인해주세요.');
    }
  };

  return {
    recognizing,
    dateAutoDetected: date.autoDetected,
    nameAutoDetected: name.autoDetected,
    brandAutoDetected: brand.autoDetected,
    barcodeAutoDetected: barcode.autoDetected,
    categoryAutoDetected: category.autoDetected,
    amountAutoDetected: amount.autoDetected,
    // Only the OCR-guessed text fields have a soft-guess mode; the format-
    // anchored reads (date/amount/barcode) are always shown as confident.
    nameConfident: name.confident,
    brandConfident: brand.confident,
    categoryConfident: category.confident,
    pickFromLibrary,
    takePhoto,
  };
}
