import React, { useState } from 'react';
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
import { cancelNotification } from '../services/notificationService';
import { CATEGORY_LABELS } from '../types';
import { daysUntil, formatDate } from '../../../shared/utils/date';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { getGifticonErrorMessage } from '../errors';
import { colors } from '../../../shared/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'GifticonDetail'>;

export default function GifticonDetailScreen({ route, navigation }: Props) {
  const { gifticon } = route.params;
  const [busy, setBusy] = useState(false);
  const days = daysUntil(gifticon.expiresAt);

  const toggleUsed = async () => {
    setBusy(true);
    try {
      const nextUsed = !gifticon.isUsed;
      await markGifticonUsed(gifticon.id, nextUsed);
      if (nextUsed) {
        await cancelNotification(gifticon.notificationId);
      }
      navigation.goBack();
    } catch {
      Alert.alert('오류', getGifticonErrorMessage('update'));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert('삭제', '이 기프티콘을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await cancelNotification(gifticon.notificationId);
            await deleteGifticon(gifticon);
            navigation.goBack();
          } catch {
            Alert.alert('오류', getGifticonErrorMessage('delete'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={{ uri: gifticon.imageUrl }} style={styles.image} />

      <View style={styles.section}>
        <Text style={styles.brand}>
          {gifticon.brand} · {CATEGORY_LABELS[gifticon.category]}
        </Text>
        <Text style={styles.name}>{gifticon.name}</Text>
        <Text style={styles.expiry}>
          유효기한 {formatDate(gifticon.expiresAt)} ({days >= 0 ? `D-${days}` : '기한만료'})
        </Text>
        {gifticon.barcode ? <Text style={styles.barcode}>바코드 {gifticon.barcode}</Text> : null}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={toggleUsed} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
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
  image: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.surfaceSubtle },
  section: { marginTop: 20, gap: 4 },
  brand: { fontSize: 13, color: colors.gray450 },
  name: { fontSize: 20, fontWeight: '700', color: colors.gray900 },
  expiry: { fontSize: 14, color: colors.gray700, marginTop: 6 },
  barcode: { fontSize: 13, color: colors.gray400, marginTop: 4 },
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
