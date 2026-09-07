import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { deleteAccount } from '../services/accountDeletion';
import { confirmAsync } from '../../../shared/utils/confirmAsync';
import type { Palette } from '../../../shared/theme/colors';
import { useColors, useThemedStyles } from '../../../shared/theme/ThemeProvider';

/**
 * Irreversible "delete my account" action for the Settings screen — required by
 * the app stores for any app that creates accounts (this one auto-creates an
 * anonymous account on first launch). Shown for anonymous and signed-in users
 * alike. On success the account's session is already gone, so AuthContext signs
 * the device back in anonymously and the screen re-renders itself.
 */
export default function DeleteAccountButton() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [deleting, setDeleting] = useState(false);

  const onPress = async () => {
    const confirmed = await confirmAsync(
      '계정을 삭제할까요?',
      '등록한 기프티콘과 사진, 내가 만든 스페이스가 모두 영구 삭제돼요. 이 작업은 되돌릴 수 없어요.',
      '삭제',
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteAccount();
      Alert.alert('완료', '계정과 데이터가 삭제되었어요.');
    } catch {
      Alert.alert('오류', '계정 삭제에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      disabled={deleting}
      accessibilityRole="button"
      accessibilityLabel="계정 삭제"
    >
      {deleting ? (
        <ActivityIndicator color={colors.danger} />
      ) : (
        <Text style={styles.buttonText}>계정 삭제</Text>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    button: {
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
    },
    buttonText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  });
