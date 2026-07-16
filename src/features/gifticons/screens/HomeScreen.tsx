import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/context/AuthContext';
import { useGifticons } from '../hooks/useGifticons';
import { useNearbyGifticons } from '../hooks/useNearbyGifticons';
import GifticonCard from '../components/GifticonCard';
import GifticonStats from '../components/GifticonStats';
import NearbyGifticonBanner from '../components/NearbyGifticonBanner';
import { getGifticonErrorMessage } from '../errors';
import type { GifticonCategory } from '../types';
import { CATEGORY_LABELS } from '../types';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { colors } from '../../../shared/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type FilterTab = 'active' | 'used';
type CategoryFilter = GifticonCategory | 'all';

const CATEGORY_FILTERS: CategoryFilter[] = [
  'all',
  ...(Object.keys(CATEGORY_LABELS) as GifticonCategory[]),
];

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { items, loading, error } = useGifticons(user?.uid);
  const nearbyItems = useNearbyGifticons(items);
  const [tab, setTab] = useState<FilterTab>('active');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settingsLink}>설정</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const filtered = useMemo(
    () =>
      items
        .filter((item) => (tab === 'active' ? !item.isUsed : item.isUsed))
        .filter((item) => categoryFilter === 'all' || item.category === categoryFilter),
    [items, tab, categoryFilter],
  );

  return (
    <View style={styles.container}>
      <GifticonStats items={items.filter((i) => !i.isUsed)} />
      <NearbyGifticonBanner items={nearbyItems} />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            사용가능 ({items.filter((i) => !i.isUsed).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'used' && styles.tabActive]}
          onPress={() => setTab('used')}
        >
          <Text style={[styles.tabText, tab === 'used' && styles.tabTextActive]}>
            사용완료 ({items.filter((i) => i.isUsed).length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORY_FILTERS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.categoryChip, categoryFilter === c && styles.categoryChipActive]}
            onPress={() => setCategoryFilter(c)}
          >
            <Text
              style={[
                styles.categoryChipText,
                categoryFilter === c && styles.categoryChipTextActive,
              ]}
            >
              {c === 'all' ? '전체' : CATEGORY_LABELS[c]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{getGifticonErrorMessage('load')}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <GifticonCard
              gifticon={item}
              onPress={() => navigation.navigate('GifticonDetail', { gifticonId: item.id })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {tab === 'active' ? '등록된 기프티콘이 없어요' : '사용완료된 기프티콘이 없어요'}
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddGifticon')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  settingsLink: { color: colors.primary, fontSize: 13, marginRight: 4 },
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
  categoryScroll: { flexGrow: 0 },
  categoryRow: { paddingHorizontal: 16, paddingTop: 10, gap: 8, alignItems: 'center' },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
  },
  categoryChipActive: { backgroundColor: colors.primary },
  categoryChipText: { fontSize: 13, color: colors.gray600, fontWeight: '600' },
  categoryChipTextActive: { color: colors.surface },
  listContent: { paddingVertical: 8, paddingBottom: 100, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: colors.gray400, fontSize: 14 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: colors.surface, fontSize: 28, fontWeight: '400', marginTop: -2 },
});
