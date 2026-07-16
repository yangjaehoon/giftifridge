import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Gifticon } from '../types';
import { daysUntil } from '../../../shared/utils/date';
import { formatCurrency } from '../../../shared/utils/currency';
import { colors } from '../../../shared/theme/colors';

const EXPIRING_SOON_WITHIN_DAYS = 7;

export default function GifticonStats({ items }: { items: Gifticon[] }) {
  const { totalAmount, expiringSoonCount, totalCount } = useMemo(() => {
    let totalAmount = 0;
    let expiringSoonCount = 0;
    for (const item of items) {
      if (item.amount) totalAmount += item.amount;
      const days = daysUntil(item.expiresAt);
      if (days >= 0 && days <= EXPIRING_SOON_WITHIN_DAYS) expiringSoonCount += 1;
    }
    return { totalAmount, expiringSoonCount, totalCount: items.length };
  }, [items]);

  return (
    <View style={styles.row}>
      <View style={styles.stat}>
        <Text style={styles.value}>{formatCurrency(totalAmount)}</Text>
        <Text style={styles.label}>보유 금액</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.value}>{expiringSoonCount}개</Text>
        <Text style={styles.label}>7일 내 만료</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.value}>{totalCount}개</Text>
        <Text style={styles.label}>보유 기프티콘</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  value: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  label: { fontSize: 11, color: colors.gray450 },
});
