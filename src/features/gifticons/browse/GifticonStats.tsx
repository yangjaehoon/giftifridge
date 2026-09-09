import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Gifticon } from '../domain/types';
import { spendableValue } from '../domain/gifticonValue';
import { daysUntil } from '../../../shared/utils/date';
import { formatCurrency } from '../../../shared/utils/currency';
import type { Palette } from '../../../shared/theme/colors';
import { useThemedStyles } from '../../../shared/theme/ThemeProvider';

const EXPIRING_SOON_WITHIN_DAYS = 7;

/** `onPress` turns the row into a link to the spending report; omitted (e.g. in
 *  a space context, where there's no per-space report yet) it's plain. */
export default function GifticonStats({
  items,
  onPress,
}: {
  items: Gifticon[];
  onPress?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { totalAmount, expiringSoonCount, totalCount } = useMemo(() => {
    let totalAmount = 0;
    let expiringSoonCount = 0;
    for (const item of items) {
      const days = daysUntil(item.expiresAt);
      // An expired gifticon can't be spent, so it doesn't count toward the
      // total.
      if (days >= 0) totalAmount += spendableValue(item);
      if (days >= 0 && days <= EXPIRING_SOON_WITHIN_DAYS) expiringSoonCount += 1;
    }
    return { totalAmount, expiringSoonCount, totalCount: items.length };
  }, [items]);

  const Container = onPress ? TouchableOpacity : View;
  // A pressable container is one a11y node, so spell the three values into its
  // label — otherwise a screen reader announces only "소비 리포트 보기" and the
  // numbers a sighted user sees are lost.
  const summary =
    `예상 보유액 ${formatCurrency(totalAmount)}, ` +
    `7일 내 만료 ${expiringSoonCount}개, 보유 기프티콘 ${totalCount}개`;

  return (
    <Container
      style={styles.row}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${summary}. 소비 리포트 보기` : undefined}
    >
      <View style={styles.stat}>
        <Text style={styles.value}>{formatCurrency(totalAmount)}</Text>
        <Text style={styles.label}>예상 보유액</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.value}>{expiringSoonCount}개</Text>
        <Text style={styles.label}>7일 내 만료</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.value}>{totalCount}개</Text>
        <Text style={styles.label}>보유 기프티콘</Text>
      </View>
    </Container>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
    label: { fontSize: 12, color: colors.gray500 },
  });
