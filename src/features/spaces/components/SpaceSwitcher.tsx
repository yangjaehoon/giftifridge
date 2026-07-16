import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { Space } from '../types';
import { colors } from '../../../shared/theme/colors';

export type HomeContext = { type: 'personal' } | { type: 'space'; spaceId: string };

export default function SpaceSwitcher({
  spaces,
  selected,
  onSelect,
  onCreatePress,
}: {
  spaces: Space[];
  selected: HomeContext;
  onSelect: (context: HomeContext) => void;
  onCreatePress: () => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Pill
        label="내 기프티콘"
        active={selected.type === 'personal'}
        onPress={() => onSelect({ type: 'personal' })}
      />
      {spaces.map((space) => (
        <Pill
          key={space.id}
          label={space.name}
          active={selected.type === 'space' && selected.spaceId === space.id}
          onPress={() => onSelect({ type: 'space', spaceId: space.id })}
        />
      ))}
      <Pill label="+" active={false} onPress={onCreatePress} />
    </ScrollView>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
  },
  pillActive: { backgroundColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.gray600 },
  pillTextActive: { color: colors.surface },
});
