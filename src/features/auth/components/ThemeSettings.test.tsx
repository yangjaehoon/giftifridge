import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ThemeSettings from './ThemeSettings';
import { ThemeProvider } from '../../../shared/theme/ThemeProvider';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('ThemeSettings', () => {
  it('marks the active preference and switches on press', async () => {
    const { getByRole } = await render(
      <ThemeProvider>
        <ThemeSettings />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(getByRole('button', { name: '시스템 설정' }).props.accessibilityState).toMatchObject({
        selected: true,
      }),
    );

    fireEvent.press(getByRole('button', { name: '다크' }));

    await waitFor(() =>
      expect(getByRole('button', { name: '다크' }).props.accessibilityState).toMatchObject({
        selected: true,
      }),
    );
    expect(getByRole('button', { name: '시스템 설정' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(await AsyncStorage.getItem('themePreference')).toBe('dark');
  });
});
