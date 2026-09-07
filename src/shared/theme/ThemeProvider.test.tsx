import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useColors, useTheme } from './ThemeProvider';
import { darkColors, lightColors } from './colors';

// react-native's useColorScheme is driven by Appearance; jest-expo defaults it
// to 'light'. Override per test where the OS scheme matters.
const mockColorScheme = jest.fn(() => 'light' as 'light' | 'dark' | null);
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme(),
}));

function Probe() {
  const { preference, scheme, setPreference } = useTheme();
  const colors = useColors();
  return (
    <>
      <Text testID="pref">{preference}</Text>
      <Text testID="scheme">{scheme}</Text>
      <Text testID="bg">{colors.background}</Text>
      <Text testID="set-dark" onPress={() => setPreference('dark')}>
        set dark
      </Text>
      <Text testID="set-system" onPress={() => setPreference('system')}>
        set system
      </Text>
    </>
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockColorScheme.mockReturnValue('light');
});

describe('ThemeProvider', () => {
  it('starts on the system preference and the light palette', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByTestId('pref').props.children).toBe('system'));
    expect(getByTestId('scheme').props.children).toBe('light');
    expect(getByTestId('bg').props.children).toBe(lightColors.background);
  });

  it('follows the OS scheme while on the system preference', async () => {
    mockColorScheme.mockReturnValue('dark');
    const { getByTestId } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByTestId('scheme').props.children).toBe('dark'));
    expect(getByTestId('bg').props.children).toBe(darkColors.background);
  });

  it('an explicit choice overrides the OS scheme and is persisted', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(getByTestId('pref').props.children).toBe('system'));

    await act(async () => getByTestId('set-dark').props.onPress());

    expect(getByTestId('scheme').props.children).toBe('dark');
    expect(getByTestId('bg').props.children).toBe(darkColors.background);
    await waitFor(async () => expect(await AsyncStorage.getItem('themePreference')).toBe('dark'));
  });

  it('restores a persisted preference on mount', async () => {
    await AsyncStorage.setItem('themePreference', 'dark');
    const { getByTestId } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByTestId('pref').props.children).toBe('dark'));
    expect(getByTestId('scheme').props.children).toBe('dark');
  });
});

describe('useColors without a provider', () => {
  it('falls back to the light palette', async () => {
    const { getByTestId } = await render(<Probe />);
    expect(getByTestId('bg').props.children).toBe(lightColors.background);
  });
});
