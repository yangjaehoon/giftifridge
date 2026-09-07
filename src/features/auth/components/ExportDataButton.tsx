import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGifticons } from '../../gifticons/hooks/useGifticons';
import { exportGifticons } from '../../gifticons/services/gifticonExport';
import type { Palette } from '../../../shared/theme/colors';
import { useColors, useThemedStyles } from '../../../shared/theme/ThemeProvider';

/**
 * Settings entry that shares the account's personal gifticons as a CSV via the
 * OS share sheet — a copy the user can keep outside the app. Space gifticons
 * belong to their space and aren't included.
 */
export default function ExportDataButton({ uid }: { uid: string | undefined }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { items } = useGifticons(uid);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const result = await exportGifticons(items);
      if (result === 'empty') {
        Alert.alert('내보낼 기프티콘이 없어요', '기프티콘을 등록한 뒤 다시 시도해주세요.');
      }
    } catch {
      Alert.alert('오류', '내보내기에 실패했어요. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.button}
        onPress={run}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="기프티콘 CSV로 내보내기"
      >
        {busy ? (
          <ActivityIndicator color={colors.gray700} />
        ) : (
          <Text style={styles.buttonText}>기프티콘 내보내기 (CSV)</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>
        보유한 기프티콘 목록을 CSV 파일로 공유해요. 엑셀·구글 시트에서 열 수 있어요.
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { marginTop: 12 },
    button: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    buttonText: { color: colors.gray700, fontWeight: '700', fontSize: 15 },
    hint: { fontSize: 12, color: colors.gray500, marginTop: 8, lineHeight: 17 },
  });
