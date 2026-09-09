import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUser } from '../../../shared/auth/AuthContext';
import { useGifticons } from '../hooks/useGifticons';
import GifticonCard from '../components/GifticonCard';
import GifticonCardSkeleton from '../components/GifticonCardSkeleton';
import { gifticonsByExpiryDate, monthMatrix, shiftMonth } from './expiryCalendar';
import { todayDateString } from '../../../shared/utils/date';
import type { Gifticon } from '../types';
import type { RootStackParamList } from '../../../app/navigationTypes';
import type { Palette } from '../../../shared/theme/colors';
import { useThemedStyles } from '../../../shared/theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Calendar'>;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * A month grid marking the days the user's personal gifticons expire. Tapping a
 * marked day lists what expires then. Space gifticons aren't included (same
 * boundary as the report and CSV export).
 */
export default function ExpiryCalendarScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { user } = useCurrentUser();
  const { items, loading } = useGifticons(user?.uid);

  const today = todayDateString();
  const [{ year, month }, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(today);

  const byDate = useMemo(() => gifticonsByExpiryDate(items), [items]);
  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const selectedItems: Gifticon[] = (selected && byDate[selected]) || [];

  const go = (delta: 1 | -1) => {
    setMonth(({ year: y, month: m }) => shiftMonth(y, m, delta));
    setSelected(null);
  };

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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => go(-1)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="이전 달"
        >
          <Text style={styles.nav}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {year}년 {month + 1}월
        </Text>
        <TouchableOpacity
          onPress={() => go(1)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="다음 달"
        >
          <Text style={styles.nav}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((date, di) => {
            if (!date) return <View key={di} style={styles.cell} />;
            const count = byDate[date]?.length ?? 0;
            const isToday = date === today;
            const isSelected = date === selected;
            return (
              <TouchableOpacity
                key={di}
                style={[styles.cell, isSelected && styles.cellSelected]}
                onPress={() => setSelected(date)}
                accessibilityRole="button"
                accessibilityLabel={`${Number(date.slice(8, 10))}일${count > 0 ? `, 만료 ${count}건` : ''}`}
              >
                <Text style={[styles.day, isToday && styles.today]}>
                  {Number(date.slice(8, 10))}
                </Text>
                {count > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={styles.list}>
        {selected && selectedItems.length === 0 && (
          <Text style={styles.empty}>이 날 만료되는 기프티콘이 없어요</Text>
        )}
        {selectedItems.map((g) => (
          <GifticonCard
            key={g.id}
            gifticon={g}
            onPress={() => navigation.navigate('GifticonDetail', { gifticonId: g.id })}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 40 },
    loading: { flex: 1, backgroundColor: colors.background, paddingTop: 24 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      marginBottom: 12,
    },
    nav: { fontSize: 26, color: colors.primary, paddingHorizontal: 12, fontWeight: '700' },
    monthLabel: { fontSize: 16, fontWeight: '800', color: colors.gray900 },
    weekdayRow: { flexDirection: 'row' },
    weekday: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      color: colors.gray500,
      paddingBottom: 6,
    },
    week: { flexDirection: 'row' },
    cell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      gap: 2,
    },
    cellSelected: { backgroundColor: colors.surfaceMuted },
    day: { fontSize: 13, color: colors.gray700 },
    today: { color: colors.primary, fontWeight: '800' },
    badge: {
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.amber,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { fontSize: 10, color: colors.surface, fontWeight: '700' },
    list: { marginTop: 16, gap: 0 },
    empty: { textAlign: 'center', color: colors.gray500, fontSize: 13, paddingVertical: 24 },
  });
