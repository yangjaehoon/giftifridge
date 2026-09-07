import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNotificationOffsets } from '../../../shared/hooks/useNotificationOffsets';
import { useNotificationHour } from '../../../shared/hooks/useNotificationHour';
import type { Palette } from '../../../shared/theme/colors';
import { useThemedStyles } from '../../../shared/theme/ThemeProvider';

const OFFSET_PRESETS = [7, 3, 1, 0];
const OFFSET_LABELS: Record<number, string> = { 7: '7일 전', 3: '3일 전', 1: '1일 전', 0: '당일' };

const HOUR_PRESETS = [9, 12, 18, 21];
const HOUR_LABELS: Record<number, string> = {
  9: '오전 9시',
  12: '정오',
  18: '오후 6시',
  21: '오후 9시',
};

/** The "며칠 전에 / 몇 시에 알림" chip rows on the settings screen. */
export default function NotificationOffsetSettings() {
  const styles = useThemedStyles(makeStyles);
  const { offsets, toggle } = useNotificationOffsets();
  const { hour, select } = useNotificationHour();

  if (!offsets) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>알림</Text>
      <Text style={styles.subtitle}>
        유효기한 며칠 전에 알림을 받을지 선택하세요. 여러 개 선택할 수 있어요.
      </Text>
      <View style={styles.chipRow}>
        {OFFSET_PRESETS.map((offset) => (
          <TouchableOpacity
            key={offset}
            style={[styles.chip, offsets.includes(offset) && styles.chipActive]}
            onPress={() => toggle(offset)}
          >
            <Text style={[styles.chipText, offsets.includes(offset) && styles.chipTextActive]}>
              {OFFSET_LABELS[offset]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {hour !== null && (
        <>
          <Text style={styles.rowLabel}>알림 시각</Text>
          <View style={styles.chipRow}>
            {HOUR_PRESETS.map((h) => (
              <TouchableOpacity
                key={h}
                style={[styles.chip, hour === h && styles.chipActive]}
                onPress={() => select(h)}
                accessibilityRole="button"
                accessibilityState={{ selected: hour === h }}
              >
                <Text style={[styles.chipText, hour === h && styles.chipTextActive]}>
                  {HOUR_LABELS[h]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    section: { marginBottom: 28 },
    title: { fontSize: 15, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
    subtitle: { fontSize: 13, color: colors.gray500, marginBottom: 12, lineHeight: 18 },
    rowLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.gray700,
      marginTop: 16,
      marginBottom: 8,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 13, color: colors.gray600, fontWeight: '600' },
    chipTextActive: { color: colors.surface },
  });
