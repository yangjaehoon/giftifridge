import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../shared/components/Button';
import { colors } from '../shared/theme/colors';

export default function AuthErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>문제가 발생했어요</Text>
      <Text style={styles.body}>{message}</Text>
      <Button label="다시 시도" onPress={onRetry} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: colors.gray900 },
  body: { fontSize: 14, lineHeight: 20, color: colors.gray600, textAlign: 'center' },
  button: { marginTop: 8 },
});
