import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'themePreference';
const DEFAULT: ThemePreference = 'system';
const VALID: ThemePreference[] = ['system', 'light', 'dark'];

export async function getThemePreference(): Promise<ThemePreference> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw && (VALID as string[]).includes(raw) ? (raw as ThemePreference) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, preference);
}
