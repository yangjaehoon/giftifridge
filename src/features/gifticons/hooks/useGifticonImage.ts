import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { recognizeExpiryDate } from '../services/ocrService';
import { parseDate } from '../../../shared/utils/date';

interface Options {
  /** Store the chosen local uri (form.setImage). */
  onImageChosen: (uri: string) => void;
  /** Apply an OCR-detected expiry date (form.setExpiresAt). */
  onExpiryDetected: (date: Date) => void;
}

/**
 * Owns picking a gifticon photo (library or camera) and the expiry-date OCR that
 * follows it, including the run token that stops a slow OCR for an earlier image
 * from overwriting a newer one, and the "user edited the date by hand" guard.
 */
export function useGifticonImage({ onImageChosen, onExpiryDetected }: Options) {
  const [recognizingDate, setRecognizingDate] = useState(false);
  const [dateAutoDetected, setDateAutoDetected] = useState(false);
  // Refs, not state: detectExpiryDate reads them after an await and must see the
  // current values, not the ones captured when the image was picked.
  const dateManuallyEditedRef = useRef(false);
  const ocrRunRef = useRef(0);

  const detectExpiryDate = async (uri: string) => {
    const run = ++ocrRunRef.current;
    setDateAutoDetected(false);
    setRecognizingDate(true);
    try {
      const detected = await recognizeExpiryDate(uri);
      if (run !== ocrRunRef.current) return; // a newer image was picked meanwhile
      if (detected && !dateManuallyEditedRef.current) {
        onExpiryDetected(parseDate(detected));
        setDateAutoDetected(true);
      }
    } finally {
      if (run === ocrRunRef.current) setRecognizingDate(false);
    }
  };

  const handlePicked = (uri: string) => {
    onImageChosen(uri);
    dateManuallyEditedRef.current = false;
    detectExpiryDate(uri);
  };

  const pickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled) handlePicked(result.assets[0].uri);
    } catch {
      Alert.alert('오류', '사진첩에 접근하지 못했어요. 권한을 확인해주세요.');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled) handlePicked(result.assets[0].uri);
    } catch {
      Alert.alert('오류', '카메라를 사용하지 못했어요. 권한을 확인해주세요.');
    }
  };

  const markDateManuallyEdited = () => {
    dateManuallyEditedRef.current = true;
    setDateAutoDetected(false);
  };

  return { recognizingDate, dateAutoDetected, pickFromLibrary, takePhoto, markDateManuallyEdited };
}
