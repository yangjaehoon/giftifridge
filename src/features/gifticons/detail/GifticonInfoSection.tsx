import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '../../../shared/utils/currency';
import { daysUntil, formatDate } from '../../../shared/utils/date';
import type { Palette } from '../../../shared/theme/colors';
import { useThemedStyles } from '../../../shared/theme/ThemeProvider';
import type { Gifticon } from '../domain/types';
import { CATEGORY_LABELS } from '../domain/types';
import { formatRemainingAmount, isAmountBased } from '../domain/usage';
import { lookupEstimatedPrice } from '../domain/menuPrices';

interface Props {
  gifticon: Gifticon;
}

/** The text block under the image: brand · category, name, the amount (or a
 *  rough retail estimate for a product voucher), the D-day pill, and the
 *  registered / used dates. */
export default function GifticonInfoSection({ gifticon }: Props) {
  const styles = useThemedStyles(makeStyles);
  const days = daysUntil(gifticon.expiresAt);
  const expired = days < 0;
  const soon = !expired && days <= 7;
  // A rough retail estimate for a product voucher (no printed price); shown
  // only when there's no real amount, framed as approximate with its as-of.
  const estimate = isAmountBased(gifticon)
    ? null
    : lookupEstimatedPrice(gifticon.brand, gifticon.name);

  return (
    <View style={styles.section}>
      <Text style={styles.brand}>
        {gifticon.brand} · {CATEGORY_LABELS[gifticon.category]}
      </Text>
      <Text style={styles.name}>{gifticon.name}</Text>
      {isAmountBased(gifticon) ? (
        <Text style={styles.amount}>{formatRemainingAmount(gifticon)}</Text>
      ) : estimate ? (
        <Text style={styles.estimate}>
          예상 금액 약 {formatCurrency(estimate.price)} · {estimate.asOf} 기준
        </Text>
      ) : null}

      <View style={styles.expiryRow}>
        <View
          style={[
            styles.ddayPill,
            expired ? styles.ddayExpired : soon ? styles.ddaySoon : styles.ddayOk,
          ]}
        >
          <Text style={[styles.ddayText, soon && !expired && styles.ddayTextOnColor]}>
            {expired ? '기한만료' : `D-${days}`}
          </Text>
        </View>
        <Text style={styles.expiry}>유효기한 {formatDate(gifticon.expiresAt)}</Text>
      </View>

      <Text style={styles.meta}>등록일 {formatDate(gifticon.createdAt)}</Text>
      {gifticon.isUsed && gifticon.usedAt ? (
        <Text style={styles.meta}>사용일 {formatDate(gifticon.usedAt)}</Text>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    section: { marginTop: 20, gap: 4 },
    brand: { fontSize: 13, color: colors.gray500 },
    name: { fontSize: 20, fontWeight: '700', color: colors.gray900 },
    amount: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 2 },
    estimate: { fontSize: 13, color: colors.gray500, marginTop: 4 },
    expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    ddayPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    ddayOk: { backgroundColor: colors.surfaceMuted },
    ddaySoon: { backgroundColor: colors.amber },
    ddayExpired: { backgroundColor: colors.border },
    ddayText: { fontSize: 14, fontWeight: '800', color: colors.gray900 },
    ddayTextOnColor: { color: colors.surface },
    expiry: { fontSize: 14, color: colors.gray700 },
    meta: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  });
