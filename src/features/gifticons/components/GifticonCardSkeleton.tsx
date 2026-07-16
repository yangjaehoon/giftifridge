import React from 'react';
import { StyleSheet, View } from 'react-native';
import Skeleton from '../../../shared/components/Skeleton';
import { colors } from '../../../shared/theme/colors';

export default function GifticonCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton style={styles.thumbnail} />
      <View style={styles.info}>
        <Skeleton style={styles.lineShort} />
        <Skeleton style={styles.lineLong} />
        <Skeleton style={styles.lineMedium} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  thumbnail: { width: 56, height: 56, borderRadius: 8 },
  info: { flex: 1, marginLeft: 12, gap: 6 },
  lineShort: { height: 10, width: '35%' },
  lineLong: { height: 14, width: '75%' },
  lineMedium: { height: 10, width: '25%' },
});
