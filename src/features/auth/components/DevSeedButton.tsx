import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { seedDummyGifticons } from '../../gifticons/services/devSeed';
import { colors } from '../../../shared/theme/colors';

/**
 * Dev-only button that fills the current account with dummy gifticons.
 * Renders nothing outside __DEV__, so the settings screen can place it
 * unconditionally.
 */
export default function DevSeedButton({ uid }: { uid: string }) {
  const [seeding, setSeeding] = useState(false);

  if (!__DEV__) return null;

  const seed = async () => {
    setSeeding(true);
    try {
      const { succeeded, failed } = await seedDummyGifticons(uid);
      if (failed > 0) {
        Alert.alert(
          '일부만 완료',
          `더미 기프티콘 ${succeeded}개를 추가했어요. ${failed}개는 실패했어요.`,
        );
      } else {
        Alert.alert('완료', `더미 기프티콘 ${succeeded}개를 추가했어요.`);
      }
    } catch {
      Alert.alert('오류', '더미 데이터 추가에 실패했어요.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={seed} disabled={seeding}>
      {seeding ? (
        <ActivityIndicator color={colors.surface} />
      ) : (
        <Text style={styles.buttonText}>더미 기프티콘 추가</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.gray400,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: colors.surface, fontWeight: '700', fontSize: 15 },
});
