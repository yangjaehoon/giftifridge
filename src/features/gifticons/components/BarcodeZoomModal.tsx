import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import GifticonBarcode from './GifticonBarcode';
import { colors } from '../../../shared/theme/colors';

const HORIZONTAL_PADDING = 40;

/**
 * Full-screen, much larger rendering of the same barcode shown on the detail
 * screen — for holding the phone up to a store scanner. The detail screen
 * stays focused underneath (this is a plain Modal, not a navigated screen),
 * so its useMaxBrightnessWhileFocused stays in effect here too.
 */
export default function BarcodeZoomModal({
  visible,
  value,
  onClose,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="바코드 확대 화면 닫기"
      >
        <GifticonBarcode value={value} height={160} maxWidth={width - HORIZONTAL_PADDING} />
        <Text style={styles.number} selectable accessibilityLabel={value}>
          {value.replace(/(.{4})/g, '$1 ').trim()}
        </Text>
        <Text style={styles.hint}>화면을 탭하면 닫혀요</Text>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 20,
  },
  number: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.gray900,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  hint: { fontSize: 13, color: colors.gray500 },
});
