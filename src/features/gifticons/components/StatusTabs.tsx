import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { FilterTab } from '../gifticonFilters';
import { colors } from '../../../shared/theme/colors';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'active', label: '사용가능' },
  { key: 'expired', label: '기한만료' },
  { key: 'used', label: '사용완료' },
];

/** The active / expired / used segmented control on the home screen. */
export default function StatusTabs({
  tab,
  counts,
  onChange,
}: {
  tab: FilterTab;
  counts: Record<FilterTab, number>;
  onChange: (tab: FilterTab) => void;
}) {
  return (
    <View style={styles.tabs}>
      {TABS.map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={[styles.tab, tab === key && styles.tabActive]}
          onPress={() => onChange(key)}
        >
          <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
            {label} ({counts[key]})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  tabTextActive: { color: colors.surface },
});
