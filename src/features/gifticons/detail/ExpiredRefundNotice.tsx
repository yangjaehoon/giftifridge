import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../../../shared/theme/colors';
import { useThemedStyles } from '../../../shared/theme/ThemeProvider';

/**
 * Shown on an expired, still-unused gifticon: a lapsed item voucher can still
 * be refunded for most of its value under the 신유형 상품권 표준약관, and few
 * users know it — so surfacing it here is real money back.
 */
export default function ExpiredRefundNotice() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.card} accessibilityRole="text">
      <Text style={styles.title}>기한이 지났어도 환급받을 수 있어요</Text>
      <Text style={styles.body}>
        유효기간이 지난 상품권·교환권도 만료일로부터 5년 안에는 구매 금액의 90%까지 현금 환급을
        요청할 수 있어요. 카카오톡 선물하기 등 구매처 고객센터에 문의하세요.
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      marginTop: 20,
      padding: 14,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
    },
    title: { fontSize: 13, fontWeight: '700', color: colors.gray900 },
    body: { fontSize: 12, color: colors.gray700, lineHeight: 18, marginTop: 6 },
  });
