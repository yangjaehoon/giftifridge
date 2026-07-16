import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { Space } from '../types';
import Chip from '../../../shared/components/Chip';

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
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      <Chip
        label="내 기프티콘"
        active={selected.type === 'personal'}
        onPress={() => onSelect({ type: 'personal' })}
      />
      {spaces.map((space) => (
        <Chip
          key={space.id}
          label={space.name}
          active={selected.type === 'space' && selected.spaceId === space.id}
          onPress={() => onSelect({ type: 'space', spaceId: space.id })}
        />
      ))}
      <Chip
        label="+"
        active={false}
        onPress={onCreatePress}
        accessibilityLabel="새 스페이스 만들기"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
});
