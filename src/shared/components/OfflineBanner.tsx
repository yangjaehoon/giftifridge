import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors } from '../theme/colors';

export default function OfflineBanner() {
  const isConnected = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>오프라인 상태예요</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surfaceStrong,
    paddingVertical: 6,
    alignItems: 'center',
  },
  text: { color: colors.surface, fontSize: 12, fontWeight: '600' },
});
