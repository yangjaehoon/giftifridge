import React from 'react';
import { StyleSheet, View } from 'react-native';
import Skeleton from '../../../shared/components/Skeleton';

export default function SpaceMembersSkeleton() {
  return (
    <View style={styles.container}>
      <Skeleton style={styles.title} />
      <View style={styles.list}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} style={styles.row} />
        ))}
      </View>
      <Skeleton style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { height: 24, width: '50%', marginBottom: 16 },
  list: { gap: 12, marginBottom: 20 },
  row: { height: 18, width: '40%' },
  button: { height: 48, borderRadius: 10 },
});
