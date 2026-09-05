import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Gifticon } from '../types';
import { CATEGORY_LABELS } from '../types';
import { remainingAmount } from '../usage';
import { daysUntil, formatDate } from '../../../shared/utils/date';
import { formatCurrency } from '../../../shared/utils/currency';
import { colors } from '../../../shared/theme/colors';

function GifticonCard({
  gifticon,
  onPress,
}: {
  gifticon: Gifticon;
  // Takes the gifticon so the list can pass one stable handler and let React.memo
  // actually skip unchanged rows.
  onPress: (gifticon: Gifticon) => void;
}) {
  const days = daysUntil(gifticon.expiresAt);
  const expired = days < 0;
  const soon = !expired && days <= 3;

  const status = gifticon.isUsed ? '사용완료' : expired ? '기한만료' : `${days}일 남음`;
  const remaining = remainingAmount(gifticon);
  // Once partially spent, the face value on the card is no longer what's left —
  // show the balance instead so this doesn't read as more valuable than it is.
  const priceText =
    remaining !== null && gifticon.amount !== undefined
      ? remaining < gifticon.amount
        ? `${formatCurrency(remaining)} 남음`
        : formatCurrency(gifticon.amount)
      : null;
  const priceLabel = priceText ? `, ${priceText}` : '';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(gifticon)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${gifticon.brand} ${gifticon.name}${priceLabel}, 유효기한 ${formatDate(gifticon.expiresAt)}, ${status}`}
    >
      <Image
        source={{ uri: gifticon.imageUrl }}
        style={styles.thumbnail}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={styles.info}>
        <Text style={styles.brand} numberOfLines={1}>
          {gifticon.brand} · {CATEGORY_LABELS[gifticon.category]}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {gifticon.name}
        </Text>
        {priceText ? <Text style={styles.amount}>{priceText}</Text> : null}
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

export default React.memo(GifticonCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumbnail: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.surfaceSubtle },
  info: { flex: 1, marginLeft: 12 },
  brand: { fontSize: 12, color: colors.gray500 },
  name: { fontSize: 15, fontWeight: '600', color: colors.gray900, marginTop: 2 },
  amount: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginTop: 3 },
  // Expiry is the thing users scan for — keep it readable, not de-emphasised.
  expiry: { fontSize: 12, fontWeight: '600', color: colors.gray600, marginTop: 2 },
  badgeArea: { marginLeft: 8, alignItems: 'flex-end' },
  dDay: { fontSize: 13, fontWeight: '700', color: colors.gray700 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeUsed: { backgroundColor: colors.surfaceMuted },
  badgeExpired: { backgroundColor: colors.border },
  badgeSoon: { backgroundColor: colors.amber },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.surface },
  badgeTextMuted: { fontSize: 11, fontWeight: '700', color: colors.gray500 },
});
