import { useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { guessBrandAndName, parseExpiryDateFromText, recognizeText } from '../services/ocrService';
import { recognizeBarcodeFromImage } from '../services/barcodeRecognition';
import { parseDate } from '../../../shared/utils/date';
import { alertPermissionDenied } from '../../../shared/utils/permissionAlert';

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
}

/**
 * Owns picking a gifticon photo (library or camera) and everything that gets
 * read from it afterward: expiry date, a best-effort brand/name guess (OCR),
 * and any barcode already visible in the photo. Each field has its own run
 * token guard (a slow recognition pass for an earlier image can't overwrite a
 * newer one) and "user edited this by hand" guard (an auto-fill never clobbers
 * something the user already typed/scanned/picked themselves).
 */
export function useGifticonImage({
  onImageChosen,
  onExpiryDetected,
  onNameDetected,
  onBrandDetected,
  onBarcodeDetected,
}: Options) {
  const [recognizing, setRecognizing] = useState(false);
  const [dateAutoDetected, setDateAutoDetected] = useState(false);
  const [nameAutoDetected, setNameAutoDetected] = useState(false);
  const [brandAutoDetected, setBrandAutoDetected] = useState(false);
  const [barcodeAutoDetected, setBarcodeAutoDetected] = useState(false);
  // Refs, not state: the recognition pass reads them after an await and must
  // see the current values, not the ones captured when the image was picked.
  const dateManuallyEditedRef = useRef(false);
  const nameManuallyEditedRef = useRef(false);
  const brandManuallyEditedRef = useRef(false);
  const barcodeManuallyEditedRef = useRef(false);
  const runRef = useRef(0);

  const recognizeFields = async (uri: string) => {
    const run = ++runRef.current;
    setDateAutoDetected(false);
    setNameAutoDetected(false);
    setBrandAutoDetected(false);
    setBarcodeAutoDetected(false);
    setRecognizing(true);
    try {
      const [text, barcode] = await Promise.all([
        recognizeText(uri),
        recognizeBarcodeFromImage(uri),
      ]);
      if (run !== runRef.current) return; // a newer image was picked meanwhile

      if (text != null) {
        const detectedDate = parseExpiryDateFromText(text);
        if (detectedDate && !dateManuallyEditedRef.current) {
          onExpiryDetected(parseDate(detectedDate));
          setDateAutoDetected(true);
        }
        const { brand, name } = guessBrandAndName(text);
        if (name && !nameManuallyEditedRef.current) {
          onNameDetected(name);
          setNameAutoDetected(true);
        }
        if (brand && !brandManuallyEditedRef.current) {
          onBrandDetected(brand);
          setBrandAutoDetected(true);
        }
      }
      if (barcode && !barcodeManuallyEditedRef.current) {
        onBarcodeDetected(barcode);
        setBarcodeAutoDetected(true);
      }
    } finally {
      if (run === runRef.current) setRecognizing(false);
    }
  };

  // Deliberately does NOT reset the manually-edited refs: once a field holds
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

  const markDateManuallyEdited = () => {
    dateManuallyEditedRef.current = true;
    setDateAutoDetected(false);
  };
  const markNameManuallyEdited = () => {
    nameManuallyEditedRef.current = true;
    setNameAutoDetected(false);
  };
  const markBrandManuallyEdited = () => {
    brandManuallyEditedRef.current = true;
    setBrandAutoDetected(false);
  };
  const markBarcodeManuallyEdited = () => {
    barcodeManuallyEditedRef.current = true;
    setBarcodeAutoDetected(false);
  };

  return {
    recognizing,
    dateAutoDetected,
    nameAutoDetected,
    brandAutoDetected,
    barcodeAutoDetected,
    pickFromLibrary,
    takePhoto,
    markDateManuallyEdited,
    markNameManuallyEdited,
    markBrandManuallyEdited,
    markBarcodeManuallyEdited,
  };
}
