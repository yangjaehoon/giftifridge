import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUser } from '../../auth/context/AuthContext';
import { removeGifticon, setGifticonUsed } from '../services/gifticonLifecycle';
import { useGifticon } from '../hooks/useGifticon';
import { useGifticonUsage } from '../hooks/useGifticonUsage';
import Button from '../../../shared/components/Button';
import { useToast } from '../../../shared/components/ToastProvider';
import { useMaxBrightnessWhileFocused } from '../../../shared/hooks/useMaxBrightnessWhileFocused';
import GifticonDetailSkeleton from '../components/GifticonDetailSkeleton';
import GifticonBarcode from '../components/GifticonBarcode';
import BarcodeZoomModal from '../components/BarcodeZoomModal';
import GifticonUsagePanel from '../components/GifticonUsagePanel';
import GifticonStatusOverlay from '../components/GifticonStatusOverlay';
import { CATEGORY_LABELS } from '../types';
import { formatRemainingAmount, isAmountBased } from '../usage';
import { daysUntil, formatDate } from '../../../shared/utils/date';
import { haptics } from '../../../shared/utils/haptics';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { getGifticonErrorMessage, getGifticonWriteErrorMessage } from '../errors';
import { colors } from '../../../shared/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'GifticonDetail'>;

export default function GifticonDetailScreen({ route, navigation }: Props) {
  const { gifticonId } = route.params;
  const { user } = useCurrentUser();
  const showToast = useToast();
  const { gifticon, loading, error, refresh } = useGifticon(gifticonId);
  useMaxBrightnessWhileFocused(Boolean(gifticon?.barcode));
  const usage = useGifticonUsage(gifticon, user?.uid);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [barcodeZoomed, setBarcodeZoomed] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const copyBarcode = async () => {
    if (!gifticon?.barcode) return;
    await Clipboard.setStringAsync(gifticon.barcode);
    haptics.selection();
    setCopied(true);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500);
  };

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
    const nextUsed = !gifticon.isUsed;
    setBusy(true);
    try {
      await setGifticonUsed(gifticon, nextUsed, user?.uid);
      // Stay on the screen — the realtime doc flips isUsed and the user can
      // see the new state (and undo it) without navigating.
      haptics.success();
      showToast(nextUsed ? '사용완료로 표시했어요' : '다시 사용가능으로 바꿨어요');
    } catch (err) {
      Alert.alert('오류', getGifticonWriteErrorMessage(err, 'update'));
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
            await removeGifticon(gifticon);
            navigation.goBack();
          } catch (err) {
            Alert.alert('오류', getGifticonWriteErrorMessage(err, 'delete'));
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
  const expired = days < 0;
  const soon = !expired && days <= 7;
  const overlayLabel = gifticon.isUsed ? '사용완료' : expired ? '기한만료' : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: gifticon.imageUrl }}
          style={styles.image}
          accessibilityLabel="기프티콘 이미지"
        />
        <GifticonStatusOverlay label={overlayLabel} textStyle={styles.overlayText} />
      </View>

      <View style={styles.section}>
        <Text style={styles.brand}>
          {gifticon.brand} · {CATEGORY_LABELS[gifticon.category]}
        </Text>
        <Text style={styles.name}>{gifticon.name}</Text>
        {isAmountBased(gifticon) ? (
          <Text style={styles.amount}>{formatRemainingAmount(gifticon)}</Text>
        ) : null}

        <View style={styles.expiryRow}>
          <View
            style={[
              styles.ddayPill,
              expired ? styles.ddayExpired : soon ? styles.ddaySoon : styles.ddayOk,
            ]}
          >
            <Text style={[styles.ddayText, soon && !expired && styles.ddayTextOnColor]}>
              {expired ? '기한만료' : `D-${days}`}
            </Text>
          </View>
          <Text style={styles.expiry}>유효기한 {formatDate(gifticon.expiresAt)}</Text>
        </View>

        <Text style={styles.meta}>등록일 {formatDate(gifticon.createdAt)}</Text>
        {gifticon.isUsed && gifticon.usedAt ? (
          <Text style={styles.meta}>사용일 {formatDate(gifticon.usedAt)}</Text>
        ) : null}
      </View>

      {isAmountBased(gifticon) && (
        <GifticonUsagePanel
          gifticon={gifticon}
          onRecordUsage={usage.recordUsage}
          onDeleteRecord={usage.deleteRecord}
          busy={usage.busy}
        />
      )}

      {gifticon.barcode ? (
        <View style={styles.barcodeCard}>
          <TouchableOpacity
            onPress={() => setBarcodeZoomed(true)}
            accessibilityRole="button"
            accessibilityLabel="바코드 크게 보기"
          >
            <GifticonBarcode value={gifticon.barcode} />
          </TouchableOpacity>
          <Text style={styles.barcodeNumber} selectable accessibilityLabel={gifticon.barcode}>
            {gifticon.barcode.replace(/(.{4})/g, '$1 ').trim()}
          </Text>
          <Text style={styles.barcodeHint}>탭하면 크게 볼 수 있어요</Text>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={copyBarcode}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="바코드 번호 복사"
          >
            <Text style={styles.copyButtonText}>{copied ? '복사됨 ✓' : '번호 복사'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {gifticon.barcode ? (
        <BarcodeZoomModal
          visible={barcodeZoomed}
          value={gifticon.barcode}
          onClose={() => setBarcodeZoomed(false)}
        />
      ) : null}

      <Button
        label={gifticon.isUsed ? '사용가능으로 되돌리기' : '사용완료로 표시'}
        onPress={toggleUsed}
        loading={busy}
        style={styles.primaryAction}
      />

      <Button variant="ghostDanger" label="삭제하기" onPress={remove} disabled={busy} />
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
  imageWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
  },
  image: { width: '100%', height: '100%' },
  overlayText: { fontSize: 28 },
  section: { marginTop: 20, gap: 4 },
  brand: { fontSize: 13, color: colors.gray500 },
  name: { fontSize: 20, fontWeight: '700', color: colors.gray900 },
  amount: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 2 },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  ddayPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  ddayOk: { backgroundColor: colors.surfaceMuted },
  ddaySoon: { backgroundColor: colors.amber },
  ddayExpired: { backgroundColor: colors.border },
  ddayText: { fontSize: 14, fontWeight: '800', color: colors.gray900 },
  ddayTextOnColor: { color: colors.surface },
  expiry: { fontSize: 14, color: colors.gray700 },
  meta: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  barcodeCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 10,
  },
  barcodeNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  barcodeHint: { fontSize: 12, color: colors.gray500, marginTop: -6 },
  copyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  copyButtonText: { fontSize: 13, color: colors.gray700, fontWeight: '700' },
  emptyText: { color: colors.gray500, fontSize: 14, textAlign: 'center' },
  primaryAction: { marginTop: 32 },
});
