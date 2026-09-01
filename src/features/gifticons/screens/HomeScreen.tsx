import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/context/AuthContext';
import { useGifticons } from '../hooks/useGifticons';
import { useSpaceGifticons } from '../hooks/useSpaceGifticons';
import { useNearbyGifticons } from '../hooks/useNearbyGifticons';
import { useMySpaces } from '../../spaces/hooks/useMySpaces';
import SpaceSwitcher, { type HomeContext } from '../../spaces/components/SpaceSwitcher';
import Chip from '../../../shared/components/Chip';
import GifticonCard from '../components/GifticonCard';
import GifticonCardSkeleton from '../components/GifticonCardSkeleton';
import GifticonStats from '../components/GifticonStats';
import NearbyGifticonBanner from '../components/NearbyGifticonBanner';
import { getGifticonErrorMessage } from '../errors';
import type { Gifticon, GifticonCategory } from '../types';
import { CATEGORY_LABELS } from '../types';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { colors } from '../../../shared/theme/colors';
import { daysUntil } from '../../../shared/utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type FilterTab = 'active' | 'expired' | 'used';
type CategoryFilter = GifticonCategory | 'all';

const EMPTY_TEXT: Record<FilterTab, string> = {
  active: '등록된 기프티콘이 없어요',
  expired: '만료된 기프티콘이 없어요',
  used: '사용완료된 기프티콘이 없어요',
};

function isExpired(item: Gifticon): boolean {
  return daysUntil(item.expiresAt) < 0;
}

const CATEGORY_FILTERS: CategoryFilter[] = [
  'all',
  ...(Object.keys(CATEGORY_LABELS) as GifticonCategory[]),
];

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [selectedContext, setSelectedContext] = useState<HomeContext>({ type: 'personal' });
  const { spaces, loading: spacesLoading } = useMySpaces(user?.uid);

  // A space the user just left or an owner deleted disappears from `spaces`.
  // Derive the context so it falls back to personal in that case — otherwise it
  // stays pointed at the space and useSpaceGifticons retries a permission-denied
  // subscription on a backoff loop forever.
  const context: HomeContext =
    selectedContext.type === 'space' &&
    !spacesLoading &&
    !spaces.some((s) => s.id === selectedContext.spaceId)
      ? { type: 'personal' }
      : selectedContext;
  const personal = useGifticons(context.type === 'personal' ? user?.uid : undefined);
  const spaceGifticons = useSpaceGifticons(context.type === 'space' ? context.spaceId : undefined);
  const { items, loading, refreshing, error, refresh } =
    context.type === 'personal' ? personal : spaceGifticons;
  const nearbyItems = useNearbyGifticons(items);
  const [tab, setTab] = useState<FilterTab>('active');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settingsLink}>설정</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const counts = useMemo(
    () => ({
      active: items.filter((item) => !item.isUsed && !isExpired(item)).length,
      expired: items.filter((item) => !item.isUsed && isExpired(item)).length,
      used: items.filter((item) => item.isUsed).length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => {
        if (tab === 'used') return item.isUsed;
        return !item.isUsed && isExpired(item) === (tab === 'expired');
      })
      .filter((item) => categoryFilter === 'all' || item.category === categoryFilter)
      .filter(
        (item) =>
          trimmedQuery === '' ||
          item.name.toLowerCase().includes(trimmedQuery) ||
          item.brand.toLowerCase().includes(trimmedQuery),
      );
  }, [items, tab, categoryFilter, query]);

  return (
    <View style={styles.container}>
      <SpaceSwitcher
        spaces={spaces}
        selected={context}
        onSelect={setSelectedContext}
        onCreatePress={() => navigation.navigate('CreateSpace')}
      />
      {context.type === 'space' && (
        <TouchableOpacity
          style={styles.membersLink}
          onPress={() => navigation.navigate('SpaceMembers', { spaceId: context.spaceId })}
        >
          <Text style={styles.membersLinkText}>멤버 관리</Text>
        </TouchableOpacity>
      )}
      <GifticonStats items={items.filter((i) => !i.isUsed)} />
      <NearbyGifticonBanner items={nearbyItems} />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            사용가능 ({counts.active})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'expired' && styles.tabActive]}
          onPress={() => setTab('expired')}
        >
          <Text style={[styles.tabText, tab === 'expired' && styles.tabTextActive]}>
            기한만료 ({counts.expired})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'used' && styles.tabActive]}
          onPress={() => setTab('used')}
        >
          <Text style={[styles.tabText, tab === 'used' && styles.tabTextActive]}>
            사용완료 ({counts.used})
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
          <Chip
            key={c}
            label={c === 'all' ? '전체' : CATEGORY_LABELS[c]}
            active={categoryFilter === c}
            onPress={() => setCategoryFilter(c)}
          />
        ))}
      </ScrollView>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="상품명, 브랜드 검색"
          placeholderTextColor={colors.gray400}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity
            style={styles.searchClear}
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
          >
            <Text style={styles.searchClearText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {Array.from({ length: 5 }).map((_, i) => (
            <GifticonCardSkeleton key={i} />
          ))}
        </View>
      ) : error && items.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.empty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
        >
          <Text style={styles.emptyText}>{getGifticonErrorMessage('load')}</Text>
        </ScrollView>
      ) : (
        <>
          {error && (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>
                최신 정보를 불러오지 못했어요. 화면을 당겨서 다시 시도해주세요.
              </Text>
            </View>
          )}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={colors.primary}
              />
            }
            renderItem={({ item }) => (
              <GifticonCard
                gifticon={item}
                onPress={() => navigation.navigate('GifticonDetail', { gifticonId: item.id })}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {query.trim() ? '검색 결과가 없어요' : EMPTY_TEXT[tab]}
                </Text>
              </View>
            }
          />
        </>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          navigation.navigate(
            'AddGifticon',
            context.type === 'space' ? { spaceId: context.spaceId } : undefined,
          )
        }
        accessibilityRole="button"
        accessibilityLabel="기프티콘 등록"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  settingsLink: { color: colors.primary, fontSize: 13, marginRight: 4 },
  membersLink: { alignSelf: 'flex-end', marginRight: 16, marginTop: 6 },
  membersLinkText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
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
  listContent: { paddingVertical: 8, paddingBottom: 100, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: colors.gray400, fontSize: 14 },
  inlineError: {
    backgroundColor: colors.amber,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  inlineErrorText: { color: colors.surface, fontSize: 12, fontWeight: '700' },
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
