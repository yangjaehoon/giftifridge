import { Alert } from 'react-native';

/** Promisified two-button Alert. Resolves true on confirm, false on cancel/dismiss. */
export function confirmAsync(
  title: string,
  message: string,
  confirmLabel = '계속',
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
