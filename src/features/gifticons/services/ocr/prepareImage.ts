import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

// ML Kit's text recogniser needs each character to span roughly 16+ px; below
// this width a gallery thumbnail, a far-away photo, or a tightly-cropped share
// loses small print (the barcode number, the amount, a fine-print date). A
// photo already at least this wide is left untouched.
const OCR_MIN_WIDTH = 1000;
// Enlarge the too-small ones to here. This is interpolation, not new detail,
// but the recogniser still reads enlarged text far better than tiny text.
const OCR_TARGET_WIDTH = 1600;

function getWidth(uri: string): Promise<number> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width) => resolve(width), reject);
  });
}

/**
 * Returns a URI to run OCR on: the original when it's already large enough, or
 * an upscaled copy (a temporary JPEG in the cache dir) when it's too small.
 * Best-effort — any failure falls back to the original URI, so OCR still runs.
 */
export async function prepareImageForOcr(uri: string): Promise<string> {
  try {
    if ((await getWidth(uri)) >= OCR_MIN_WIDTH) return uri;
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: OCR_TARGET_WIDTH } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return uri;
  }
}
