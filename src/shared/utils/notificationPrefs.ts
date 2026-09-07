import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notificationOffsets';
const DEFAULT_OFFSETS = [3];

const HOUR_STORAGE_KEY = 'notificationHour';
/** 9am — the time reminders fired at before this was configurable. */
export const DEFAULT_NOTIFICATION_HOUR = 9;

export async function getNotificationOffsets(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OFFSETS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')
      ? parsed
      : DEFAULT_OFFSETS;
  } catch {
    return DEFAULT_OFFSETS;
  }
}

export async function setNotificationOffsets(offsets: number[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(offsets));
}

/**
 * The hour of day (0–23, local) reminders are scheduled for. Anything stored
 * that isn't a whole hour in range is treated as unset — a corrupt value
 * shouldn't push every reminder to midnight.
 */
export async function getNotificationHour(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(HOUR_STORAGE_KEY);
    if (raw == null) return DEFAULT_NOTIFICATION_HOUR;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'number' && Number.isInteger(parsed) && parsed >= 0 && parsed <= 23
      ? parsed
      : DEFAULT_NOTIFICATION_HOUR;
  } catch {
    return DEFAULT_NOTIFICATION_HOUR;
  }
}

export async function setNotificationHour(hour: number): Promise<void> {
  await AsyncStorage.setItem(HOUR_STORAGE_KEY, JSON.stringify(hour));
}
