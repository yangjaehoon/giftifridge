import BarcodeScanning from '@react-native-ml-kit/barcode-scanning';

/**
 * Reads any barcode already present in a photo — for auto-filling the
 * barcode field from a picked/taken gifticon image. Distinct from
 * useBarcodeScanner, which decodes a live camera feed instead of a photo.
 * Returns the first match's value, or null if none is found or recognition
 * fails (e.g. no barcode in frame, blurry photo).
 */
export async function recognizeBarcodeFromImage(imageUri: string): Promise<string | null> {
  try {
    const results = await BarcodeScanning.scan(imageUri);
    return results[0]?.value ?? null;
  } catch {
    return null;
  }
}
