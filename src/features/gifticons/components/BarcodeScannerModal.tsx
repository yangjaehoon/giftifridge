import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { colors } from '../../../shared/theme/colors';

const BARCODE_TYPES = ['code128', 'code39', 'ean13', 'ean8', 'qr', 'upc_a', 'upc_e'] as const;

export default function BarcodeScannerModal({
  visible,
  onScanned,
  onClose,
}: {
  visible: boolean;
  onScanned: (result: { data: string }) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={visible ? onScanned : undefined}
        />
        <TouchableOpacity style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>닫기</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.shadow },
  close: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  closeText: { fontWeight: '700', color: colors.gray900 },
});
