import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Palette } from '../../../shared/theme/colors';
import { useTheme, useThemedStyles } from '../../../shared/theme/ThemeProvider';
import type { ThemePreference } from '../../../shared/theme/themePreference';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: '시스템 설정' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

/** The 화면 테마 chip row on the settings screen. */
export default function ThemeSettings() {
  const styles = useThemedStyles(makeStyles);
  const { preference, setPreference } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={styles.title}>화면 테마</Text>
      <View style={styles.row}>
        {OPTIONS.map((option) => {
          const active = preference === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setPreference(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    section: { marginBottom: 28 },
    title: { fontSize: 15, fontWeight: '700', color: colors.gray900, marginBottom: 12 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 13, color: colors.gray600, fontWeight: '600' },
    chipTextActive: { color: colors.onPrimary },
  });
