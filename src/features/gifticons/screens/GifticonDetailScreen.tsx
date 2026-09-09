import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUser } from '../../../shared/auth/AuthContext';
import { removeGifticon, setGifticonUsed } from '../services/gifticonLifecycle';
import { useGifticon } from '../hooks/useGifticon';
import { useGifticonUsage } from '../hooks/useGifticonUsage';
import Button from '../../../shared/components/Button';
import { useToast } from '../../../shared/components/ToastProvider';
import { useAsyncAction } from '../../../shared/hooks/useAsyncAction';
import { useMaxBrightnessWhileFocused } from '../../../shared/hooks/useMaxBrightnessWhileFocused';
import GifticonDetailSkeleton from '../components/GifticonDetailSkeleton';
import GifticonBarcode from '../components/GifticonBarcode';
import BarcodeZoomModal from '../components/BarcodeZoomModal';
import ImageZoomModal from '../components/ImageZoomModal';
import ExpiredRefundNotice from '../components/ExpiredRefundNotice';
import GifticonUsagePanel from '../components/GifticonUsagePanel';
import GifticonStatusOverlay from '../components/GifticonStatusOverlay';
import { CATEGORY_LABELS } from '../types';
import { formatRemainingAmount, isAmountBased } from '../usage';
import { lookupEstimatedPrice } from '../menuPrices';
import { formatCurrency } from '../../../shared/utils/currency';
import { daysUntil, formatDate } from '../../../shared/utils/date';
import { haptics } from '../../../shared/utils/haptics';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { getGifticonErrorMessage, getGifticonWriteErrorMessage } from '../errors';
import type { Palette } from '../../../shared/theme/colors';
import { useThemedStyles } from '../../../shared/theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'GifticonDetail'>;

export default function GifticonDetailScreen({ route, navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { gifticonId } = route.params;
  const { user } = useCurrentUser();
  const showToast = useToast();
  const { gifticon, loading, error, refresh } = useGifticon(gifticonId);
  useMaxBrightnessWhileFocused(Boolean(gifticon?.barcode));
  const usage = useGifticonUsage(gifticon, user?.uid);
  const { busy, run } = useAsyncAction(getGifticonWriteErrorMessage);
  const [copied, setCopied] = useState(false);
  const [barcodeZoomed, setBarcodeZoomed] = useState(false);
  const [imageZoomed, setImageZoomed] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ask "did you use it?" at most once per visit, when the barcode zoom closes.
  const askedUsedRef = useRef(false);

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
  }, [navigation, gifticon, styles.editLink]);

  const toggleUsed = () => {
    if (!gifticon) return;
    const nextUsed = !gifticon.isUsed;
    return run(() => setGifticonUsed(gifticon, nextUsed, user?.uid), {
      fallback: 'update',
      onSuccess: () => {
        // Stay on the screen — the realtime doc flips isUsed and the user can
        // see the new state (and undo it) without navigating.
        haptics.success();
        showToast(nextUsed ? '사용완료로 표시했어요' : '다시 사용가능으로 바꿨어요');
      },
    });
  };

  // Closing the enlarged barcode usually means it was just scanned. Nudge once
  // to mark it used so the used/unused state stays honest without discipline.
  const closeBarcodeZoom = () => {
    setBarcodeZoomed(false);
    if (!gifticon || gifticon.isUsed || askedUsedRef.current) return;
    askedUsedRef.current = true;
    Alert.alert('사용하셨나요?', '방금 바코드를 사용했다면 사용완료로 표시할게요.', [
      { text: '아니요', style: 'cancel' },
      { text: '네, 사용완료', onPress: () => void toggleUsed() },
    ]);
  };

  const remove = () => {
    if (!gifticon) return;
    Alert.alert('삭제', '이 기프티콘을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          run(() => removeGifticon(gifticon), {
            fallback: 'delete',
            onSuccess: () => navigation.goBack(),
          });
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
  // A rough retail estimate for a product voucher (no printed price); shown
  // only when there's no real amount, framed as approximate with its as-of.
  const estimate = isAmountBased(gifticon)
    ? null
    : lookupEstimatedPrice(gifticon.brand, gifticon.name);

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
          onClose={closeBarcodeZoom}
        />
      ) : null}

      <TouchableOpacity
        style={styles.imageWrap}
        onPress={() => setImageZoomed(true)}
        accessibilityRole="button"
        accessibilityLabel="기프티콘 이미지 크게 보기"
      >
        <Image
          source={{ uri: gifticon.imageUrl }}
          style={styles.image}
          accessibilityLabel="기프티콘 이미지"
        />
        <GifticonStatusOverlay label={overlayLabel} textStyle={styles.overlayText} />
      </TouchableOpacity>
      <Text style={styles.imageHint}>탭하면 크게 볼 수 있어요</Text>

      <ImageZoomModal
        visible={imageZoomed}
        uri={gifticon.imageUrl}
        onClose={() => setImageZoomed(false)}
      />

      <View style={styles.section}>
        <Text style={styles.brand}>
          {gifticon.brand} · {CATEGORY_LABELS[gifticon.category]}
        </Text>
        <Text style={styles.name}>{gifticon.name}</Text>
        {isAmountBased(gifticon) ? (
          <Text style={styles.amount}>{formatRemainingAmount(gifticon)}</Text>
        ) : estimate ? (
          <Text style={styles.estimate}>
            예상 금액 약 {formatCurrency(estimate.price)} · {estimate.asOf} 기준
          </Text>
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

      {gifticon.memo ? (
        <View style={styles.memoCard}>
          <Text style={styles.memoLabel}>메모</Text>
          <Text style={styles.memoText} selectable>
            {gifticon.memo}
          </Text>
        </View>
      ) : null}

      {expired && !gifticon.isUsed ? <ExpiredRefundNotice /> : null}

      {isAmountBased(gifticon) && (
        <GifticonUsagePanel
          gifticon={gifticon}
          onRecordUsage={usage.recordUsage}
          onDeleteRecord={usage.deleteRecord}
          busy={usage.busy}
        />
      )}

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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
      width: 132,
      aspectRatio: 3 / 4,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surfaceSubtle,
      alignSelf: 'center',
      marginTop: 24,
    },
    image: { width: '100%', height: '100%' },
    overlayText: { fontSize: 13 },
    imageHint: { fontSize: 12, color: colors.gray500, textAlign: 'center', marginTop: 6 },
    section: { marginTop: 20, gap: 4 },
    brand: { fontSize: 13, color: colors.gray500 },
    name: { fontSize: 20, fontWeight: '700', color: colors.gray900 },
    amount: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 2 },
    estimate: { fontSize: 13, color: colors.gray500, marginTop: 4 },
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
    memoCard: {
      marginTop: 20,
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      gap: 6,
    },
    memoLabel: { fontSize: 12, fontWeight: '700', color: colors.gray500 },
    memoText: { fontSize: 14, color: colors.gray900, lineHeight: 20 },
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
