import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Gifticon } from '../types';
import { colors } from '../../../shared/theme/colors';

export default function NearbyGifticonBanner({ items }: { items: Gifticon[] }) {
  if (items.length === 0) return null;

  const brands = [...new Set(items.map((item) => item.brand))].join(', ');

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>근처에 사용 안 한 기프티콘이 있어요: {brands}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.amber,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
  },
  text: { color: colors.surface, fontSize: 12, fontWeight: '700' },
});
