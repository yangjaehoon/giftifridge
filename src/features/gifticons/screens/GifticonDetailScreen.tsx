import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { deleteGifticon, markGifticonUsed } from '../services/gifticonService';
import { cancelNotifications } from '../services/notificationService';
import { useGifticon } from '../hooks/useGifticon';
import GifticonDetailSkeleton from '../components/GifticonDetailSkeleton';
import { CATEGORY_LABELS } from '../types';
import { daysUntil, formatDate } from '../../../shared/utils/date';
import { formatCurrency } from '../../../shared/utils/currency';
import { withTimeout, TimeoutError } from '../../../shared/utils/withTimeout';
import { isPermissionDenied } from '../../../shared/utils/firebaseError';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { getGifticonErrorMessage } from '../errors';
import { colors } from '../../../shared/theme/colors';

const WRITE_TIMEOUT_MS = 15000;

type Props = NativeStackScreenProps<RootStackParamList, 'GifticonDetail'>;

export default function GifticonDetailScreen({ route, navigation }: Props) {
  const { gifticonId } = route.params;
  const { gifticon, loading, error, refresh } = useGifticon(gifticonId);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!gifticon) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('AddGifticon', { gifticonId: gifticon.id })}
          accessibilityRole="button"
          accessibilityLabel="기프티콘 수정"
        >
          <Text style={styles.editLink}>수정</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, gifticon]);

  const toggleUsed = async () => {
    if (!gifticon) return;
    setBusy(true);
    try {
      const nextUsed = !gifticon.isUsed;
      await withTimeout(markGifticonUsed(gifticon.id, nextUsed), WRITE_TIMEOUT_MS);
      if (nextUsed) {
        try {
          await withTimeout(cancelNotifications(gifticon.notificationIds), WRITE_TIMEOUT_MS);
        } catch {
          // usage state already saved; a stuck/failed notification cancel shouldn't block this
        }
      }
      navigation.goBack();
    } catch (err) {
      const action =
        err instanceof TimeoutError ? 'network' : isPermissionDenied(err) ? 'permission' : 'update';
      Alert.alert('오류', getGifticonErrorMessage(action));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!gifticon) return;
    Alert.alert('삭제', '이 기프티콘을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            try {
              await withTimeout(cancelNotifications(gifticon.notificationIds), WRITE_TIMEOUT_MS);
            } catch {
              // best-effort cleanup; don't block the delete the user just confirmed
            }
            await withTimeout(deleteGifticon(gifticon), WRITE_TIMEOUT_MS);
            navigation.goBack();
          } catch (err) {
            const action =
              err instanceof TimeoutError
                ? 'network'
                : isPermissionDenied(err)
                  ? 'permission'
                  : 'delete';
            Alert.alert('오류', getGifticonErrorMessage(action));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <GifticonDetailSkeleton />;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{getGifticonErrorMessage('load')}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={refresh}
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!gifticon) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{getGifticonErrorMessage('notFound')}</Text>
      </View>
    );
  }

  const days = daysUntil(gifticon.expiresAt);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={{ uri: gifticon.imageUrl }} style={styles.image} />

      <View style={styles.section}>
        <Text style={styles.brand}>
          {gifticon.brand} · {CATEGORY_LABELS[gifticon.category]}
        </Text>
        <Text style={styles.name}>{gifticon.name}</Text>
        {gifticon.amount ? (
          <Text style={styles.amount}>{formatCurrency(gifticon.amount)}</Text>
        ) : null}
        <Text style={styles.expiry}>
          유효기한 {formatDate(gifticon.expiresAt)} ({days >= 0 ? `D-${days}` : '기한만료'})
        </Text>
        {gifticon.barcode ? <Text style={styles.barcode}>바코드 {gifticon.barcode}</Text> : null}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={toggleUsed} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.primaryButtonText}>
            {gifticon.isUsed ? '사용가능으로 되돌리기' : '사용완료로 표시'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={remove} disabled={busy}>
        <Text style={styles.deleteButtonText}>삭제하기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 },
  retryButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonText: { color: colors.gray700, fontWeight: '700', fontSize: 14 },
  editLink: { color: colors.primary, fontSize: 13, marginRight: 4, fontWeight: '600' },
  image: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.surfaceSubtle },
  section: { marginTop: 20, gap: 4 },
  brand: { fontSize: 13, color: colors.gray450 },
  name: { fontSize: 20, fontWeight: '700', color: colors.gray900 },
  amount: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 2 },
  expiry: { fontSize: 14, color: colors.gray700, marginTop: 6 },
  barcode: { fontSize: 13, color: colors.gray400, marginTop: 4 },
  emptyText: { color: colors.gray400, fontSize: 14, textAlign: 'center' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  primaryButtonText: { color: colors.surface, fontWeight: '700', fontSize: 15 },
  deleteButton: { alignItems: 'center', paddingVertical: 16 },
  deleteButtonText: { color: colors.gray400, fontSize: 14 },
});
