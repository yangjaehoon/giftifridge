import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUser } from '../../../shared/auth/AuthContext';
import { useGifticons } from '../domain/hooks/useGifticons';
import GifticonCardSkeleton from '../domain/components/GifticonCardSkeleton';
import { buildSpendingReport } from './gifticonReport';
import { CATEGORY_LABELS } from '../domain/types';
import { formatCurrency } from '../../../shared/utils/currency';
import type { RootStackParamList } from '../../../app/navigationTypes';
import type { Palette } from '../../../shared/theme/colors';
import { useThemedStyles } from '../../../shared/theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Report'>;

/**
 * A look-back over the user's personal gifticons: what's on hand, what's been
 * used, and — the point of the screen — what expired unused. Space gifticons
 * aren't included (same boundary as CSV export).
 */
export default function SpendingReportScreen(_props: Props) {
  const styles = useThemedStyles(makeStyles);
  const { user } = useCurrentUser();
  const { items, loading } = useGifticons(user?.uid);
  const report = useMemo(() => buildSpendingReport(items), [items]);

  if (loading) {
    return (
      <View style={styles.loading}>
        {Array.from({ length: 4 }).map((_, i) => (
          <GifticonCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tiles}>
        <Tile
          label="보유 중"
          value={formatCurrency(report.holdingValue)}
          sub={`${report.holdingCount}개`}
        />
        <Tile
          label="사용 완료"
          value={formatCurrency(report.usedValue)}
          sub={`${report.usedCount}개`}
        />
      </View>

      <View style={[styles.lostCard, report.lostCount > 0 && styles.lostCardActive]}>
        <Text style={styles.lostLabel}>만료로 놓친 금액</Text>
        <Text style={[styles.lostValue, report.lostCount > 0 && styles.lostValueActive]}>
          {formatCurrency(report.lostValue)}
        </Text>
        <Text style={styles.lostSub}>
          {report.lostCount > 0
            ? `${report.lostCount}개를 쓰지 못하고 만료시켰어요`
            : '만료된 기프티콘이 없어요. 잘하고 있어요!'}
        </Text>
      </View>

      {report.usedByCategory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>카테고리별 사용</Text>
          {report.usedByCategory.map((row) => (
            <View key={row.category} style={styles.catRow}>
              <Text style={styles.catName}>{CATEGORY_LABELS[row.category]}</Text>
              <Text style={styles.catCount}>{row.count}개</Text>
              <Text style={styles.catValue}>{formatCurrency(row.value)}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.disclaimer}>
        금액이 없는 상품 기프티콘은 대략적인 시세로 추정한 값이라 실제와 다를 수 있어요.
      </Text>
    </ScrollView>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 40, gap: 14 },
    loading: { flex: 1, backgroundColor: colors.background, paddingTop: 24 },
    tiles: { flexDirection: 'row', gap: 12 },
    tile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      gap: 4,
      shadowColor: colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    tileLabel: { fontSize: 12, color: colors.gray500 },
    tileValue: { fontSize: 18, fontWeight: '800', color: colors.gray900 },
    tileSub: { fontSize: 12, color: colors.gray500 },
    lostCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 18,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    lostCardActive: { borderColor: colors.amber, backgroundColor: colors.surface },
    lostLabel: { fontSize: 13, fontWeight: '700', color: colors.gray600 },
    lostValue: { fontSize: 24, fontWeight: '800', color: colors.gray700 },
    lostValueActive: { color: colors.amberText },
    lostSub: { fontSize: 13, color: colors.gray500 },
    section: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      gap: 4,
      shadowColor: colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.gray900, marginBottom: 8 },
    catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    catName: { flex: 1, fontSize: 14, color: colors.gray900 },
    catCount: { fontSize: 13, color: colors.gray500, marginRight: 14 },
    catValue: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
    disclaimer: { fontSize: 12, color: colors.gray450, lineHeight: 17, marginTop: 4 },
  });
