import { StyleSheet, Text } from 'react-native';
import { colors } from '../../../shared/theme/colors';

interface Props {
  /** Render nothing when false — lets the caller inline `<OcrHint show={...} />`
   *  next to its field instead of wrapping each one in `{flag && ...}`. */
  show: boolean;
  /** The field noun *with its object particle*, e.g. "상품명을" / "브랜드를",
   *  dropped into the templates below. The particle can't be derived here
   *  (을/를 depends on the noun's final letter), so the caller spells it out. */
  subject?: string;
  /** A full replacement sentence for a hint that doesn't fit the template —
   *  e.g. category, which is inferred from the brand, not read off the photo.
   *  Used for the confident case. */
  message?: string;
  /** Full replacement sentence for the soft-guess case (confident === false).
   *  Falls back to `message`, then to the guess template. */
  guessMessage?: string;
  /** Confident read (known brand, keyword-anchored value) vs a soft guess the
   *  user really should check. Changes the wording and the colour. */
  confident?: boolean;
}

/**
 * The "we auto-filled this from your photo" line shown under a field on the
 * add/edit form once OCR has populated it. One place for the wording and
 * styling so the fields that use it can't drift apart; a low-confidence guess
 * gets softer wording and an amber tint.
 */
export default function OcrHint({ show, subject, message, guessMessage, confident = true }: Props) {
  if (!show) return null;
  const text = confident
    ? (message ?? `사진에서 ${subject} 자동으로 인식했어요. 확인해주세요.`)
    : (guessMessage ?? message ?? `${subject} 추측해서 넣었어요. 꼭 확인해주세요.`);
  return <Text style={[styles.hint, !confident && styles.hintGuess]}>{text}</Text>;
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.primary, marginTop: 6 },
  hintGuess: { color: colors.amber },
});
