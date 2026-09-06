import React from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../../../shared/theme/colors';

/**
 * Full-screen view of the gifticon's own photo, opened by tapping its
 * thumbnail on the detail screen. Plain Modal (not a navigated screen) so the
 * detail screen stays mounted underneath; tap anywhere to close.
 */
export default function ImageZoomModal({
  visible,
  uri,
  onClose,
}: {
  visible: boolean;
  uri: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="이미지 확대 화면 닫기"
      >
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel="기프티콘 이미지 확대"
        />
        <Text style={styles.hint}>화면을 탭하면 닫혀요</Text>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 16,
  },
  image: { width: '100%', flex: 1 },
  hint: { fontSize: 13, color: colors.surface, opacity: 0.8 },
});
