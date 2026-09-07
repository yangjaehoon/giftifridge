import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { Palette } from '../theme/colors';
import { useThemedStyles } from '../theme/ThemeProvider';

export default function Chip({
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      minHeight: 36,
      justifyContent: 'center',
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.gray600 },
    chipTextActive: { color: colors.surface },
  });
