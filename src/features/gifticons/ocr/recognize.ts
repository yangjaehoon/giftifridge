import TextRecognition, {
  TextRecognitionScript,
  type TextRecognitionResult,
} from '@react-native-ml-kit/text-recognition';
import { prepareImageForOcr } from './prepareImage';

export interface RecognizedLine {
  text: string;
  /** Line height in pixels — a proxy for font size, used to tell headline
   * text (brand/product name) apart from the fine-print footer text real
   * gifticon layouts consistently render smaller (see guessGifticonFields).
   * 0 when this build/platform doesn't report a frame for the line. */
  height: number;
}

export interface RecognizedText {
  text: string;
  lines: RecognizedLine[];
}

// Below this much text, the Korean pass barely found anything — a logo-heavy
// or low-contrast photo. A Latin pass can then pull out an ASCII brand/product
// line the Korean model dropped; a rich Korean result skips the extra call.
const DUAL_SCRIPT_MIN_CHARS = 40;

function toRecognizedText(result: TextRecognitionResult): RecognizedText {
  // Degrade to an empty line list (not a thrown/null result) if a native build
  // ever returns text without a matching blocks structure — the raw text and
  // its date/amount parsing are still worth having even without per-line
  // heights.
  const lines = (result.blocks ?? []).flatMap((block) =>
    block.lines.map((line) => ({ text: line.text, height: line.frame?.height ?? 0 })),
  );
  return { text: result.text, lines };
}

function mergeRecognized(primary: RecognizedText, secondary: RecognizedText): RecognizedText {
  const seen = new Set(primary.lines.map((line) => line.text.trim()));
  const extra = secondary.lines.filter(
    (line) => line.text.trim().length > 0 && !seen.has(line.text.trim()),
  );
  if (extra.length === 0) return primary;
  return {
    text: [primary.text, ...extra.map((line) => line.text)].filter(Boolean).join('\n'),
    lines: [...primary.lines, ...extra],
  };
}

/** Raw OCR result, or null if recognition failed. Callers derive whatever they
 * need from it (parseExpiryDateFromText, guessGifticonFields). One Korean pass
 * normally; a Latin pass is added and merged only when the Korean text came
 * back sparse. */
export async function recognizeText(imageUri: string): Promise<RecognizedText | null> {
  try {
    const uri = await prepareImageForOcr(imageUri);
    const korean = toRecognizedText(
      await TextRecognition.recognize(uri, TextRecognitionScript.KOREAN),
    );
    if (korean.text.trim().length >= DUAL_SCRIPT_MIN_CHARS) return korean;
    try {
      const latin = toRecognizedText(
        await TextRecognition.recognize(uri, TextRecognitionScript.LATIN),
      );
      return mergeRecognized(korean, latin);
    } catch {
      return korean;
    }
  } catch {
    return null;
  }
}
