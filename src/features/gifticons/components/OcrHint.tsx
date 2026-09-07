import { StyleSheet, Text } from 'react-native';
import { colors } from '../../../shared/theme/colors';

interface Props {
  /** Render nothing when false — lets the caller inline `<OcrHint show={...} />`
   *  next to its field instead of wrapping each one in `{flag && ...}`. */
  show: boolean;
  /** The field noun *with its object particle*, e.g. "상품명을" / "브랜드를",
   *  dropped into "사진에서 ___ 자동으로 인식했어요. 확인해주세요.". The particle
   *  can't be derived here (을/를 depends on the noun's final letter), so the
   *  caller spells it out. */
  subject?: string;
  /** A full replacement sentence for a hint that doesn't fit that template —
   *  e.g. category, which is inferred from the brand, not read off the photo. */
  message?: string;
}

/**
 * The "we auto-filled this from your photo, double-check it" line shown under a
 * field on the add/edit form once OCR has populated it. One place for the
 * wording and styling so the six fields that use it can't drift apart.
 */
export default function OcrHint({ show, subject, message }: Props) {
  if (!show) return null;
  return (
    <Text style={styles.hint}>
      {message ?? `사진에서 ${subject} 자동으로 인식했어요. 확인해주세요.`}
    </Text>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.primary, marginTop: 6 },
});
