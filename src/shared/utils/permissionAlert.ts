import { Alert, Linking } from 'react-native';

/**
 * Alert for a denied permission that, unlike a plain Alert.alert, offers a way
 * out: "설정으로 이동" jumps straight to this app's OS settings page, instead of
 * a dismiss-only alert that leaves the user to go find Settings from memory.
 */
export function alertPermissionDenied(title: string, message: string): void {
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: '설정으로 이동', onPress: () => Linking.openSettings() },
  ]);
}
