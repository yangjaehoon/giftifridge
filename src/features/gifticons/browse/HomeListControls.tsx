import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Chip from '../../../shared/components/Chip';
import type { Palette } from '../../../shared/theme/colors';
import { useColors, useThemedStyles } from '../../../shared/theme/ThemeProvider';
import { CATEGORY_LABELS } from '../domain/types';
import {
  CATEGORY_FILTERS,
  SORT_KEYS,
  SORT_LABELS,
  type CategoryFilter,
  type SortDir,
  type SortKey,
} from '../domain/gifticonFilters';

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };
const HIT_SLOP_SM = { top: 8, bottom: 8, left: 8, right: 8 };

interface Props {
  category: CategoryFilter;
  onCategory: (c: CategoryFilter) => void;
  query: string;
  onChangeQuery: (q: string) => void;
  sortKey: SortKey;
  onSortKey: (k: SortKey) => void;
  sortDir: SortDir;
  onToggleSortDir: () => void;
}

/** The category / search / sort controls above the home gifticon list. */
export default function HomeListControls({
  category,
  onCategory,
  query,
  onChangeQuery,
  sortKey,
  onSortKey,
  sortDir,
  onToggleSortDir,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORY_FILTERS.map((c) => (
          <Chip
            key={c}
            label={c === 'all' ? '전체' : CATEGORY_LABELS[c]}
            active={category === c}
            onPress={() => onCategory(c)}
          />
        ))}
      </ScrollView>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onChangeQuery}
          placeholder="상품명, 브랜드 검색"
          placeholderTextColor={colors.gray400}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity
            style={styles.searchClear}
            onPress={() => onChangeQuery('')}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
          >
            <Text style={styles.searchClearText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>정렬</Text>
        {SORT_KEYS.map((key) => (
          <Chip
            key={key}
            label={SORT_LABELS[key]}
            active={sortKey === key}
            onPress={() => onSortKey(key)}
          />
        ))}
        <TouchableOpacity
          style={styles.sortDir}
          onPress={onToggleSortDir}
          hitSlop={HIT_SLOP_SM}
          accessibilityRole="button"
          accessibilityLabel={`정렬 방향 ${sortDir === 'asc' ? '오름차순' : '내림차순'}, 눌러서 전환`}
        >
          <Text style={styles.sortDirText}>{sortDir === 'asc' ? '↑ 오름차순' : '↓ 내림차순'}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    categoryScroll: { flexGrow: 0, flexShrink: 0 },
    categoryRow: { paddingHorizontal: 16, paddingTop: 10, gap: 8, alignItems: 'center' },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.gray900 },
    searchClear: { paddingLeft: 8, paddingVertical: 4 },
    searchClearText: { fontSize: 18, color: colors.gray400, fontWeight: '700' },
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 10,
    },
    sortLabel: { fontSize: 12, fontWeight: '600', color: colors.gray500 },
    sortDir: {
      marginLeft: 'auto',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sortDirText: { fontSize: 12, fontWeight: '600', color: colors.gray700 },
  });
