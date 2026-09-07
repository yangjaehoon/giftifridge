import AsyncStorage from '@react-native-async-storage/async-storage';
import { getThemePreference, setThemePreference } from './themePreference';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('themePreference', () => {
  it("defaults to 'system' when nothing is saved", async () => {
    expect(await getThemePreference()).toBe('system');
  });

  it('round-trips a saved preference', async () => {
    await setThemePreference('dark');
    expect(await getThemePreference()).toBe('dark');
  });

  it('falls back to system for an unrecognised stored value', async () => {
    await AsyncStorage.setItem('themePreference', 'sepia');
    expect(await getThemePreference()).toBe('system');
  });
});
