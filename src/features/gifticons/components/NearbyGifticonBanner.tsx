import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Gifticon } from '../types';
import { colors } from '../../../shared/theme/colors';

export default function NearbyGifticonBanner({ items }: { items: Gifticon[] }) {
  const brands = [...new Set(items.map((item) => item.brand))];
  const signature = brands.join('|');
  // Remember which nearby set was dismissed; a different signature (the user
  // moved to another store) re-arms the banner without an effect.
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null);

  if (items.length === 0 || dismissedSignature === signature) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>근처에 사용 안 한 기프티콘이 있어요: {brands.join(', ')}</Text>
      <TouchableOpacity
        onPress={() => setDismissedSignature(signature)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="알림 닫기"
      >
        <Text style={styles.close}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.amber,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
  },
  text: { flex: 1, color: colors.surface, fontSize: 12, fontWeight: '700' },
  close: { color: colors.surface, fontSize: 18, fontWeight: '700' },
});
