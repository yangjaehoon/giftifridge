import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Brightness from 'expo-brightness';

/**
 * While the screen is focused, ramp app brightness to full so an on-screen
 * barcode still scans in a dark store, and restore the previous level on blur.
 * Best-effort: a platform without brightness control, or a denied read, is a
 * silent no-op. `enabled` lets a screen wait until it actually has a barcode.
 */
export function useMaxBrightnessWhileFocused(enabled = true): void {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      let previous: number | null = null;
      let cancelled = false;

      (async () => {
        try {
          previous = await Brightness.getBrightnessAsync();
          if (!cancelled) await Brightness.setBrightnessAsync(1);
        } catch {
          previous = null;
        }
      })();

      return () => {
        cancelled = true;
        if (previous !== null) {
          Brightness.setBrightnessAsync(previous).catch(() => {});
        }
      };
    }, [enabled]),
  );
}
