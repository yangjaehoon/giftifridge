import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type Palette } from './colors';
import {
  getThemePreference,
  setThemePreference as persistPreference,
  type ThemePreference,
} from './themePreference';

interface ThemeContextValue {
  /** What the user chose: follow the OS, or a fixed theme. */
  preference: ThemePreference;
  /** What that resolves to right now, given the OS setting. */
  scheme: 'light' | 'dark';
  colors: Palette;
  setPreference: (preference: ThemePreference) => void;
}

const FALLBACK: ThemeContextValue = {
  preference: 'system',
  scheme: 'light',
  colors: lightColors,
  setPreference: () => {},
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Resolves the active palette from the user's stored preference and the OS
 * colour scheme, and persists changes. Wrap the app once, near the root.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    getThemePreference().then(setPreferenceState);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    // Fire-and-forget: the in-memory value is the source of truth for this
    // session; a failed write just means it isn't remembered next launch.
    void persistPreference(next).catch(() => {});
  }, []);

  const scheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      setPreference,
    }),
    [preference, scheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active theme metadata + setter. Outside a ThemeProvider it reports the
 *  light theme and a no-op setter, so components render fine in isolation. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK;
}

/** The active palette. */
export function useColors(): Palette {
  return useTheme().colors;
}

/**
 * Memoised themed styles: pass a factory that turns a palette into a
 * StyleSheet, get back the sheet for the active theme. Replaces a module-level
 * `StyleSheet.create` that closed over a fixed palette.
 */
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
