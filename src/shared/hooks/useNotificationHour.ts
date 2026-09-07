import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getNotificationHour, setNotificationHour } from '../utils/notificationPrefs';

/**
 * Loads the saved "what time of day reminders fire" hour and persists an edit
 * optimistically: the UI updates immediately and rolls back with an alert if
 * the write fails. `hour` is null until the initial load resolves. Mirrors
 * useNotificationOffsets.
 */
export function useNotificationHour() {
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    getNotificationHour().then(setHour);
  }, []);

  const select = async (next: number) => {
    if (hour === null || next === hour) return;
    const previous = hour;
    setHour(next);
    try {
      await setNotificationHour(next);
    } catch {
      setHour(previous);
      Alert.alert('오류', '알림 설정을 저장하지 못했어요. 다시 시도해주세요.');
    }
  };

  return { hour, select };
}
