import React from 'react';
import { StyleSheet, View } from 'react-native';
import Skeleton from '../../../shared/components/Skeleton';

export default function GifticonDetailSkeleton() {
  return (
    <View style={styles.container}>
      <Skeleton style={styles.image} />
      <View style={styles.section}>
        <Skeleton style={styles.lineShort} />
        <Skeleton style={styles.lineLong} />
        <Skeleton style={styles.lineMedium} />
      </View>
      <Skeleton style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  image: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  section: { marginTop: 20, gap: 10 },
  lineShort: { height: 12, width: '30%' },
  lineLong: { height: 22, width: '70%' },
  lineMedium: { height: 14, width: '45%' },
  button: { height: 52, borderRadius: 10, marginTop: 32 },
});
