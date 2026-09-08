import React, { useCallback, useEffect } from 'react';
import {
  Alert,
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
import { useCurrentUser } from '../../auth/context/AuthContext';
import { useLinkAccountPrompt } from '../../auth/hooks/useLinkAccountPrompt';
import LinkAccountBanner from '../../auth/components/LinkAccountBanner';
import { useNearbyGifticons } from '../hooks/useNearbyGifticons';
import { useGeofenceSync } from '../hooks/useGeofenceSync';
import { useGifticonListView } from '../hooks/useGifticonListView';
import { useGifticonSelection } from '../hooks/useGifticonSelection';
import { useHomeGifticonContext } from '../hooks/useHomeGifticonContext';
import { markGifticonsUsed, removeGifticons } from '../services/gifticonLifecycle';
import SpaceSwitcher from '../../spaces/components/SpaceSwitcher';
import Button from '../../../shared/components/Button';
import Chip from '../../../shared/components/Chip';
import GifticonCard from '../components/GifticonCard';
import GifticonCardSkeleton from '../components/GifticonCardSkeleton';
import GifticonStats from '../components/GifticonStats';
import NearbyGifticonBanner from '../components/NearbyGifticonBanner';
import StatusTabs from '../components/StatusTabs';
import { useToast } from '../../../shared/components/ToastProvider';
import { useAsyncAction } from '../../../shared/hooks/useAsyncAction';
import { getGifticonErrorMessage, getGifticonWriteErrorMessage } from '../errors';
import { CATEGORY_LABELS } from '../types';
import type { Gifticon } from '../types';
import { CATEGORY_FILTERS, EMPTY_TEXT, SORT_KEYS, SORT_LABELS } from '../gifticonFilters';
import type { RootStackParamList } from '../../../app/RootNavigator';
import type { Palette } from '../../../shared/theme/colors';
import { useColors, useThemedStyles } from '../../../shared/theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const keyExtractor = (item: Gifticon) => item.id;

export default function HomeScreen({ navigation }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { user, isAnonymous } = useCurrentUser();
  const { context, setContext, spaces, list } = useHomeGifticonContext(user?.uid);
  const { items, loading, refreshing, error, refresh } = list;
  const nearbyItems = useNearbyGifticons(items);
  const isPersonal = context.type !== 'space';
  useGeofenceSync(items, isPersonal);
  const linkPrompt = useLinkAccountPrompt(isAnonymous, isPersonal ? items.length : 0);
  const {
    visible,
    counts,
    tab,
    setTab,
    category,
    setCategory,
    query,
    setQuery,
    sortKey,
    setSortKey,
    sortDir,
    toggleSortDir,
    isSearching,
  } = useGifticonListView(items);

  const openAdd = () =>
    navigation.navigate(
      'AddGifticon',
      context.type === 'space' ? { spaceId: context.spaceId } : undefined,
    );

  const showToast = useToast();
  const selection = useGifticonSelection();
  const { busy: batchBusy, run: runBatch } = useAsyncAction(getGifticonWriteErrorMessage);
  const selectedItems = visible.filter((g) => selection.selectedIds.has(g.id));

  const openDetail = useCallback(
    (g: Gifticon) => navigation.navigate('GifticonDetail', { gifticonId: g.id }),
    [navigation],
  );
  const toggleSelect = useCallback((g: Gifticon) => selection.toggle(g.id), [selection]);
  const beginSelect = useCallback((g: Gifticon) => selection.begin(g.id), [selection]);

  const { selecting, selectedIds } = selection;
  const renderItem = useCallback(
    ({ item }: { item: Gifticon }) => (
      <GifticonCard
        gifticon={item}
        onPress={selecting ? toggleSelect : openDetail}
        onLongPress={beginSelect}
        selected={selectedIds.has(item.id)}
      />
    ),
    [selecting, selectedIds, toggleSelect, beginSelect, openDetail],
  );

  const batchMarkUsed = () =>
    runBatch(() => markGifticonsUsed(selectedItems, user?.uid), {
      fallback: 'update',
      onSuccess: ({ succeeded, failed }) => {
        selection.clear();
        showToast(
          failed > 0
            ? `${succeeded}개 완료, ${failed}개는 실패했어요`
            : `${succeeded}개를 사용완료로 표시했어요`,
        );
      },
    });

  const batchDelete = () => {
    Alert.alert('삭제', `선택한 ${selection.count}개를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          runBatch(() => removeGifticons(selectedItems), {
            fallback: 'delete',
            onSuccess: ({ succeeded, failed }) => {
              selection.clear();
              showToast(
                failed > 0
                  ? `${succeeded}개 삭제, ${failed}개는 실패했어요`
                  : `${succeeded}개를 삭제했어요`,
              );
            },
          }),
      },
    ]);
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Calendar')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="만료 달력"
          >
            <Text style={styles.settingsLink}>달력</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="설정"
          >
            <Text style={styles.settingsLink}>설정</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, styles]);

  return (
    <View style={styles.container}>
      <SpaceSwitcher
        spaces={spaces}
        selected={context}
        onSelect={setContext}
        onCreatePress={() => navigation.navigate('CreateSpace')}
      />
      {context.type === 'space' && (
        <TouchableOpacity
          style={styles.membersLink}
          onPress={() => navigation.navigate('SpaceMembers', { spaceId: context.spaceId })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
        >
          <Text style={styles.membersLinkText}>멤버 관리</Text>
        </TouchableOpacity>
      )}
      <GifticonStats
        items={items.filter((i) => !i.isUsed)}
        onPress={isPersonal ? () => navigation.navigate('Report') : undefined}
      />
      {isPersonal && linkPrompt.show && (
        <LinkAccountBanner
          onLink={() => navigation.navigate('Settings')}
          onDismiss={linkPrompt.dismiss}
        />
      )}
      <NearbyGifticonBanner items={nearbyItems} />

      <StatusTabs tab={tab} counts={counts} onChange={setTab} />

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
            onPress={() => setCategory(c)}
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
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
            onPress={() => setSortKey(key)}
          />
        ))}
        <TouchableOpacity
          style={styles.sortDir}
          onPress={toggleSortDir}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`정렬 방향 ${sortDir === 'asc' ? '오름차순' : '내림차순'}, 눌러서 전환`}
        >
          <Text style={styles.sortDirText}>{sortDir === 'asc' ? '↑ 오름차순' : '↓ 내림차순'}</Text>
        </TouchableOpacity>
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
          <Button
            variant="secondary"
            label="다시 시도"
            onPress={refresh}
            style={styles.emptyAction}
          />
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
            data={visible}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            initialNumToRender={8}
            windowSize={11}
            removeClippedSubviews
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={colors.primary}
              />
            }
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {isSearching ? '검색 결과가 없어요' : EMPTY_TEXT[tab]}
                </Text>
                {!isSearching && tab === 'active' && (
                  <Button label="기프티콘 등록" onPress={openAdd} style={styles.emptyAction} />
                )}
              </View>
            }
          />
        </>
      )}

      {selection.selecting ? (
        <View style={styles.selectionBar}>
          <TouchableOpacity
            onPress={selection.clear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="선택 취소"
          >
            <Text style={styles.selectionCancel}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.selectionCount}>{selection.count}개 선택</Text>
          <View style={styles.selectionActions}>
            {tab !== 'used' && (
              <TouchableOpacity
                onPress={batchMarkUsed}
                disabled={batchBusy}
                accessibilityRole="button"
                accessibilityLabel="선택 항목 사용완료로 표시"
              >
                <Text style={styles.selectionAction}>사용완료</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={batchDelete}
              disabled={batchBusy}
              accessibilityRole="button"
              accessibilityLabel="선택 항목 삭제"
            >
              <Text style={[styles.selectionAction, styles.selectionDelete]}>삭제</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.fab}
          onPress={openAdd}
          accessibilityRole="button"
          accessibilityLabel="기프티콘 등록"
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerActions: { flexDirection: 'row', gap: 16, marginRight: 4 },
    settingsLink: { color: colors.primary, fontSize: 13 },
    membersLink: { alignSelf: 'flex-end', marginRight: 16, marginTop: 6 },
    membersLinkText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
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
    listContent: { paddingVertical: 8, paddingBottom: 100, flexGrow: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 4 },
    emptyText: { color: colors.gray500, fontSize: 14 },
    emptyAction: { marginTop: 12, minWidth: 160 },
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
    selectionBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceStrong,
      borderRadius: 14,
      paddingHorizontal: 18,
      paddingVertical: 14,
      shadowColor: colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 5,
    },
    selectionCancel: { color: colors.surface, fontSize: 14, opacity: 0.8 },
    selectionCount: { color: colors.surface, fontSize: 14, fontWeight: '700' },
    selectionActions: { flexDirection: 'row', gap: 18 },
    selectionAction: { color: colors.primaryBright, fontSize: 14, fontWeight: '700' },
    selectionDelete: { color: colors.danger },
  });
