import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Gifticon } from '../types';
import { CATEGORY_LABELS } from '../types';
import { formatRemainingAmount, isAmountBased } from '../usage';
import { daysUntil, formatDate } from '../../../shared/utils/date';
import { colors } from '../../../shared/theme/colors';
import GifticonStatusOverlay from './GifticonStatusOverlay';

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
  const overlayLabel = gifticon.isUsed ? '사용완료' : expired ? '기한만료' : null;
  // Once partially spent, the face value on the card is no longer what's left —
  // show the balance instead so this doesn't read as more valuable than it is.
  const priceText = isAmountBased(gifticon) ? formatRemainingAmount(gifticon) : null;
  const priceLabel = priceText ? `, ${priceText}` : '';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(gifticon)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${gifticon.brand} ${gifticon.name}${priceLabel}, 유효기한 ${formatDate(gifticon.expiresAt)}, ${status}`}
    >
      <View style={styles.thumbnailWrap}>
        <Image
          source={{ uri: gifticon.imageUrl }}
          style={styles.thumbnail}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <GifticonStatusOverlay label={overlayLabel} />
      </View>
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
        {overlayLabel ? null : soon ? (
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
  thumbnailWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
  },
  thumbnail: { width: '100%', height: '100%' },
  info: { flex: 1, marginLeft: 12 },
  brand: { fontSize: 12, color: colors.gray500 },
  name: { fontSize: 15, fontWeight: '600', color: colors.gray900, marginTop: 2 },
  amount: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginTop: 3 },
  // Expiry is the thing users scan for — keep it readable, not de-emphasised.
  expiry: { fontSize: 12, fontWeight: '600', color: colors.gray600, marginTop: 2 },
  badgeArea: { marginLeft: 8, alignItems: 'flex-end' },
  dDay: { fontSize: 13, fontWeight: '700', color: colors.gray700 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeSoon: { backgroundColor: colors.amber },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.surface },
});
