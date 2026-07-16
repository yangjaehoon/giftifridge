import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Gifticon } from '../types/gifticon';
import { CATEGORY_LABELS } from '../types/gifticon';
import { daysUntil, formatDate } from '../utils/date';

export default function GifticonCard({
  gifticon,
  onPress,
}: {
  gifticon: Gifticon;
  onPress: () => void;
}) {
  const days = daysUntil(gifticon.expiresAt);
  const expired = days < 0;
  const soon = !expired && days <= 3;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <Image source={{ uri: gifticon.imageUrl }} style={styles.thumbnail} />
      <View style={styles.info}>
        <Text style={styles.brand} numberOfLines={1}>
          {gifticon.brand} · {CATEGORY_LABELS[gifticon.category]}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {gifticon.name}
        </Text>
        <Text style={styles.expiry}>~{formatDate(gifticon.expiresAt)}</Text>
      </View>
      <View style={styles.badgeArea}>
        {gifticon.isUsed ? (
          <View style={[styles.badge, styles.badgeUsed]}>
            <Text style={styles.badgeTextMuted}>사용완료</Text>
          </View>
        ) : expired ? (
          <View style={[styles.badge, styles.badgeExpired]}>
            <Text style={styles.badgeTextMuted}>기한만료</Text>
          </View>
        ) : soon ? (
          <View style={[styles.badge, styles.badgeSoon]}>
            <Text style={styles.badgeText}>D-{days}</Text>
          </View>
        ) : (
          <Text style={styles.dDay}>D-{days}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumbnail: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#f0f0f0' },
  info: { flex: 1, marginLeft: 12 },
  brand: { fontSize: 12, color: '#888' },
  name: { fontSize: 15, fontWeight: '600', color: '#222', marginTop: 2 },
  expiry: { fontSize: 12, color: '#aaa', marginTop: 2 },
  badgeArea: { marginLeft: 8, alignItems: 'flex-end' },
  dDay: { fontSize: 13, fontWeight: '700', color: '#555' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeUsed: { backgroundColor: '#eee' },
  badgeExpired: { backgroundColor: '#ddd' },
  badgeSoon: { backgroundColor: '#FF6B6B' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  badgeTextMuted: { fontSize: 11, fontWeight: '700', color: '#777' },
});
