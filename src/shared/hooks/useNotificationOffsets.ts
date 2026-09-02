import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getNotificationOffsets, setNotificationOffsets } from '../utils/notificationPrefs';

/**
 * Loads the saved "days before expiry" reminder offsets and persists edits
 * optimistically: the UI updates immediately and rolls back with an alert if
 * the write fails. `offsets` is null until the initial load resolves.
 */
export function useNotificationOffsets() {
  const [offsets, setOffsets] = useState<number[] | null>(null);

  useEffect(() => {
    getNotificationOffsets().then(setOffsets);
  }, []);

  const toggle = async (offset: number) => {
    if (!offsets) return;
    const previous = offsets;
    const next = offsets.includes(offset)
      ? offsets.filter((o) => o !== offset)
      : [...offsets, offset].sort((a, b) => b - a);
    setOffsets(next);
    try {
      await setNotificationOffsets(next);
    } catch {
      setOffsets(previous);
      Alert.alert('오류', '알림 설정을 저장하지 못했어요. 다시 시도해주세요.');
    }
  };

  return { offsets, toggle };
}
