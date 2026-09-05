import BarcodeScanning, { BarcodeFormat } from '@react-native-ml-kit/barcode-scanning';

// A gifticon's actual redeemable code is a linear (1D) barcode; a QR/2D code
// on the same image more often encodes a URL or other payload than a plain
// number, so a linear match wins if the photo has both. Falls back to
// whatever was found (even a QR/2D one) rather than nothing, consistent with
// this feature's best-effort, user-reviews-it design.
const LINEAR_FORMATS = new Set([
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.CODABAR,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.ITF,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
]);

/**
 * Reads any barcode already present in a photo — for auto-filling the
 * barcode field from a picked/taken gifticon image. Distinct from
 * useBarcodeScanner, which decodes a live camera feed instead of a photo.
 * Returns null if none is found or recognition fails (e.g. no barcode in
 * frame, blurry photo).
 */
export async function recognizeBarcodeFromImage(imageUri: string): Promise<string | null> {
  try {
    const results = await BarcodeScanning.scan(imageUri);
    if (results.length === 0) return null;
    const linear = results.find((result) => LINEAR_FORMATS.has(result.format));
    return (linear ?? results[0]).value;
  } catch {
    return null;
  }
}
