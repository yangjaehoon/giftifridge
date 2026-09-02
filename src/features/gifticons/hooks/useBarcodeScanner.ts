import { useState } from 'react';
import { Alert } from 'react-native';
import { useCameraPermissions } from 'expo-camera';

/**
 * Camera-permission gate + visibility for the barcode scanner modal. The modal
 * itself is presentation-only (BarcodeScannerModal).
 */
export function useBarcodeScanner(onScanned: (code: string) => void) {
  const [visible, setVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const open = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('알림', '바코드 스캔을 위해 카메라 권한이 필요해요.');
        return;
      }
    }
    setVisible(true);
  };

  const close = () => setVisible(false);

  const handleScanned = (result: { data: string }) => {
    onScanned(result.data);
    setVisible(false);
  };

  return { visible, open, close, handleScanned };
}
