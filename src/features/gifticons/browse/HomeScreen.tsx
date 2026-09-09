import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUser } from '../../../shared/auth/AuthContext';
import { useLinkAccountPrompt } from '../../auth/hooks/useLinkAccountPrompt';
import LinkAccountBanner from '../../auth/components/LinkAccountBanner';
import { useNearbyGifticons } from '../geofence/useNearbyGifticons';
import { useGeofenceSync } from '../geofence/useGeofenceSync';
import { useGifticonListView } from './useGifticonListView';
import { useGifticonSelection } from './useGifticonSelection';
import { useHomeGifticonContext } from './useHomeGifticonContext';
import { useGifticonBatchActions } from './useGifticonBatchActions';
import { useHomeHeaderButtons } from './useHomeHeaderButtons';
import { useMySpaces } from '../../spaces/hooks/useMySpaces';
import SpaceSwitcher from '../../spaces/components/SpaceSwitcher';
import Button from '../../../shared/components/Button';
import GifticonCard from '../domain/components/GifticonCard';
import GifticonCardSkeleton from '../domain/components/GifticonCardSkeleton';
import GifticonStats from './GifticonStats';
import NearbyGifticonBanner from '../geofence/NearbyGifticonBanner';
import StatusTabs from './StatusTabs';
import HomeListControls from './HomeListControls';
import HomeSelectionBar from './HomeSelectionBar';
import { getGifticonErrorMessage } from '../domain/errors';
import { EMPTY_TEXT } from '../domain/gifticonFilters';
import type { Gifticon } from '../domain/types';
import type { RootStackParamList } from '../../../app/navigationTypes';
import type { Palette } from '../../../shared/theme/colors';
import { useColors, useThemedStyles } from '../../../shared/theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const keyExtractor = (item: Gifticon) => item.id;

export default function HomeScreen({ navigation }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { user, isAnonymous } = useCurrentUser();
  const { spaces, loading: spacesLoading } = useMySpaces(user?.uid);
  const spaceIds = useMemo(() => spaces.map((s) => s.id), [spaces]);
  const { context, setContext, list } = useHomeGifticonContext(user?.uid, spaceIds, spacesLoading);
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

  useHomeHeaderButtons(navigation);

  const openAdd = () =>
    navigation.navigate(
      'AddGifticon',
      context.type === 'space' ? { spaceId: context.spaceId } : undefined,
    );

  const selection = useGifticonSelection();
  const selectedItems = visible.filter((g) => selection.selectedIds.has(g.id));
  const batch = useGifticonBatchActions({
    selectedItems,
    uid: user?.uid,
    onDone: selection.clear,
  });

  const openDetail = useCallback(
    (g: Gifticon) => navigation.navigate('GifticonDetail', { gifticonId: g.id }),
    [navigation],
  );
  const { selecting, selectedIds, toggle, begin } = selection;
  const toggleSelect = useCallback((g: Gifticon) => toggle(g.id), [toggle]);
  const beginSelect = useCallback((g: Gifticon) => begin(g.id), [begin]);

  const renderItem = useCallback(
    ({ item }: { item: Gifticon }) => (
      <GifticonCard
        gifticon={item}
        onPress={selecting ? toggleSelect : openDetail}
        onLongPress={beginSelect}
        selecting={selecting}
        selected={selectedIds.has(item.id)}
      />
    ),
    [selecting, selectedIds, toggleSelect, beginSelect, openDetail],
  );

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

      <HomeListControls
        category={category}
        onCategory={setCategory}
        query={query}
        onChangeQuery={setQuery}
        sortKey={sortKey}
        onSortKey={setSortKey}
        sortDir={sortDir}
        onToggleSortDir={toggleSortDir}
      />

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
        <HomeSelectionBar
          count={selection.count}
          showMarkUsed={tab !== 'used'}
          busy={batch.busy}
          onCancel={selection.clear}
          onMarkUsed={batch.markUsed}
          onDelete={batch.remove}
        />
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
    membersLink: { alignSelf: 'flex-end', marginRight: 16, marginTop: 6 },
    membersLinkText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
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
  });
