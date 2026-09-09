import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUser } from '../../../shared/auth/AuthContext';
import { removeGifticon, setGifticonUsed } from '../domain/services/gifticonLifecycle';
import { useGifticon } from '../domain/hooks/useGifticon';
import { useGifticonUsage } from './useGifticonUsage';
import Button from '../../../shared/components/Button';
import { useToast } from '../../../shared/components/ToastProvider';
import { useAsyncAction } from '../../../shared/hooks/useAsyncAction';
import { useMaxBrightnessWhileFocused } from '../../../shared/hooks/useMaxBrightnessWhileFocused';
import GifticonDetailSkeleton from '../domain/components/GifticonDetailSkeleton';
import BarcodeCard from './BarcodeCard';
import BarcodeZoomModal from './BarcodeZoomModal';
import ImageZoomModal from './ImageZoomModal';
import ExpiredRefundNotice from './ExpiredRefundNotice';
import GifticonInfoSection from './GifticonInfoSection';
import GifticonUsagePanel from './GifticonUsagePanel';
import GifticonStatusOverlay from '../domain/components/GifticonStatusOverlay';
import { isAmountBased } from '../domain/usage';
import { daysUntil } from '../../../shared/utils/date';
import { haptics } from '../../../shared/utils/haptics';
import type { RootStackParamList } from '../../../app/navigationTypes';
import { getGifticonErrorMessage, getGifticonWriteErrorMessage } from '../domain/errors';
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
  const [barcodeZoomed, setBarcodeZoomed] = useState(false);
  const [imageZoomed, setImageZoomed] = useState(false);
  // Ask "did you use it?" at most once per visit, when the barcode zoom closes.
  const askedUsedRef = useRef(false);

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

  const expired = daysUntil(gifticon.expiresAt) < 0;
  const overlayLabel = gifticon.isUsed ? '사용완료' : expired ? '기한만료' : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {gifticon.barcode ? (
        <>
          <BarcodeCard value={gifticon.barcode} onZoom={() => setBarcodeZoomed(true)} />
          <BarcodeZoomModal
            visible={barcodeZoomed}
            value={gifticon.barcode}
            onClose={closeBarcodeZoom}
          />
        </>
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

      <GifticonInfoSection gifticon={gifticon} />

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
    memoCard: {
      marginTop: 20,
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      gap: 6,
    },
    memoLabel: { fontSize: 12, fontWeight: '700', color: colors.gray500 },
    memoText: { fontSize: 14, color: colors.gray900, lineHeight: 20 },
    emptyText: { color: colors.gray500, fontSize: 14, textAlign: 'center' },
    primaryAction: { marginTop: 32 },
  });
