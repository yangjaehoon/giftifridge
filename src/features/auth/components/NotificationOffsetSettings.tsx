import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNotificationOffsets } from '../../../shared/hooks/useNotificationOffsets';
import { colors } from '../../../shared/theme/colors';

const OFFSET_PRESETS = [7, 3, 1, 0];
const OFFSET_LABELS: Record<number, string> = { 7: '7일 전', 3: '3일 전', 1: '1일 전', 0: '당일' };

/** The "며칠 전에 알림" chip row on the settings screen. */
export default function NotificationOffsetSettings() {
  const { offsets, toggle } = useNotificationOffsets();

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
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  title: { fontSize: 15, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.gray500, marginBottom: 12, lineHeight: 18 },
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
