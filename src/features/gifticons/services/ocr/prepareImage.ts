import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { withTimeout } from '../../../../shared/utils/withTimeout';

// ML Kit's text recogniser needs each character to span roughly 16+ px; below
// this width a gallery thumbnail, a far-away photo, or a tightly-cropped share
// loses small print (the barcode number, the amount, a fine-print date). A
// photo already at least this wide is left untouched.
const OCR_MIN_WIDTH = 1000;
// Enlarge the too-small ones to here. This is interpolation, not new detail,
// but the recogniser still reads enlarged text far better than tiny text.
const OCR_TARGET_WIDTH = 1600;
// Image.getSize is reliable for http(s) and file URIs but can hang (never fire
// either callback) on the content:// / ph:// URIs expo-media-library hands
// back. Cap the wait so a background scan can't stall on one photo.
const SIZE_LOOKUP_TIMEOUT_MS = 3000;

function getWidth(uri: string): Promise<number> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width) => resolve(width), reject);
  });
}

/**
 * Returns a URI to run OCR on: the original when it's already large enough, or
 * an upscaled copy (a temporary PNG in the cache dir — lossless, so the small
 * text we're trying to keep doesn't pick up JPEG artefacts) when it's too
 * small. Best-effort — any failure (or a hung size lookup) falls back to the
 * original URI, so OCR still runs.
 */
export async function prepareImageForOcr(uri: string): Promise<string> {
  try {
    const width = await withTimeout(getWidth(uri), SIZE_LOOKUP_TIMEOUT_MS);
    if (width >= OCR_MIN_WIDTH) return uri;
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: OCR_TARGET_WIDTH } }],
      { compress: 1, format: ImageManipulator.SaveFormat.PNG },
    );
    return result.uri;
  } catch {
    return uri;
  }
}
