import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
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

/** Raw OCR result, or null if recognition failed. Callers derive whatever
 * they need from it (parseExpiryDateFromText, guessGifticonFields) — kept as
 * one recognition pass since running OCR twice per photo would be wasteful. */
export async function recognizeText(imageUri: string): Promise<RecognizedText | null> {
  try {
    const uri = await prepareImageForOcr(imageUri);
    const result = await TextRecognition.recognize(uri, TextRecognitionScript.KOREAN);
    // Degrade to an empty line list (not a thrown/null result) if a native
    // build ever returns text without a matching blocks structure — the raw
    // text and its date/amount parsing are still worth having even without
    // per-line heights.
    const lines = (result.blocks ?? []).flatMap((block) =>
      block.lines.map((line) => ({ text: line.text, height: line.frame?.height ?? 0 })),
    );
    return { text: result.text, lines };
  } catch {
    return null;
  }
}
