import { useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  guessGifticonFields,
  parseAmountFromText,
  parseExpiryDateFromText,
  recognizeText,
} from '../services/ocrService';
import { recognizeBarcodeFromImage } from '../services/barcodeRecognition';
import { parseDate } from '../../../shared/utils/date';
import { alertPermissionDenied } from '../../../shared/utils/permissionAlert';
import type { GifticonCategory } from '../types';

interface Options {
  /** Store the chosen local uri (form.setImage). */
  onImageChosen: (uri: string) => void;
  /** Apply an OCR-detected expiry date (form.setExpiresAt). */
  onExpiryDetected: (date: Date) => void;
  /** Apply an OCR-guessed product name (form.setName). */
  onNameDetected: (name: string) => void;
  /** Apply an OCR-guessed brand (form.setBrand). */
  onBrandDetected: (brand: string) => void;
  /** Apply a barcode read from the photo itself (form.setBarcode). */
  onBarcodeDetected: (barcode: string) => void;
  /** Apply a category inferred from a recognized known brand (form.setCategory). */
  onCategoryDetected: (category: GifticonCategory) => void;
  /** Apply an OCR-detected face value (form.setAmount). */
  onAmountDetected: (amount: number) => void;
}

// One auto-fillable field's "was it just auto-filled" flag and "did the user
// override it by hand" guard, reused for each of the six fields
// recognizeFields can fill in — so adding another detected field later is one
// line here instead of a hand-copied state/ref/setter trio.
function useDetectedField<T>(apply: (value: T) => void) {
  const [autoDetected, setAutoDetected] = useState(false);
  const manuallyEditedRef = useRef(false);

  const detect = (value: T) => {
    if (manuallyEditedRef.current) return;
    apply(value);
    setAutoDetected(true);
  };
  const reset = () => setAutoDetected(false);
  const markManuallyEdited = () => {
    manuallyEditedRef.current = true;
    setAutoDetected(false);
  };

  return { autoDetected, detect, reset, markManuallyEdited };
}

/**
 * Owns picking a gifticon photo (library or camera) and everything that gets
 * read from it afterward: expiry date, a best-effort brand/name/category
 * guess (OCR), a face-value amount, and any barcode already visible in the
 * photo. Each field has its own run token guard (a slow recognition pass for
 * an earlier image can't overwrite a newer one) and "user edited this by
 * hand" guard (an auto-fill never clobbers something the user already
 * typed/scanned/picked themselves, and picking a different photo afterward
 * can't silently undo that — see useDetectedField).
 */
export function useGifticonImage({
  onImageChosen,
  onExpiryDetected,
  onNameDetected,
  onBrandDetected,
  onBarcodeDetected,
  onCategoryDetected,
  onAmountDetected,
}: Options) {
  const [recognizing, setRecognizing] = useState(false);
  const date = useDetectedField(onExpiryDetected);
  const name = useDetectedField(onNameDetected);
  const brand = useDetectedField(onBrandDetected);
  const barcode = useDetectedField(onBarcodeDetected);
  const category = useDetectedField(onCategoryDetected);
  const amount = useDetectedField(onAmountDetected);
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
      const [text, scannedBarcode] = await Promise.all([
        recognizeText(uri),
        recognizeBarcodeFromImage(uri),
      ]);
      if (run !== runRef.current) return; // a newer image was picked meanwhile

      if (text != null) {
        const detectedDate = parseExpiryDateFromText(text);
        if (detectedDate) date.detect(parseDate(detectedDate));

        const guessed = guessGifticonFields(text);
        if (guessed.name) name.detect(guessed.name);
        if (guessed.brand) brand.detect(guessed.brand);
        if (guessed.category) category.detect(guessed.category);

        const detectedAmount = parseAmountFromText(text);
        if (detectedAmount != null) amount.detect(detectedAmount);
      }
      if (scannedBarcode) barcode.detect(scannedBarcode);
    } finally {
      if (run === runRef.current) setRecognizing(false);
    }
  };

  // Deliberately does NOT reset the manually-edited guards: once a field holds
  // real content — typed by the user, hydrated from an existing gifticon (see
  // AddGifticonScreen's edit-mode effect), or a still-standing OCR guess from
  // an earlier photo the user chose to keep — picking a different photo must
  // not silently clobber it. A field only becomes overwritable again by the
  // user clearing/editing it (which flips its guard) or if it was never set.
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
    pickFromLibrary,
    takePhoto,
    markDateManuallyEdited: date.markManuallyEdited,
    markNameManuallyEdited: name.markManuallyEdited,
    markBrandManuallyEdited: brand.markManuallyEdited,
    markBarcodeManuallyEdited: barcode.markManuallyEdited,
    markCategoryManuallyEdited: category.markManuallyEdited,
    markAmountManuallyEdited: amount.markManuallyEdited,
  };
}
