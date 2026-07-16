import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notificationOffsets';
const DEFAULT_OFFSETS = [3];

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
