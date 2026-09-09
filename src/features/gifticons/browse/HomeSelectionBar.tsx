import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Palette } from '../../../shared/theme/colors';
import { useThemedStyles } from '../../../shared/theme/ThemeProvider';

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

interface Props {
  count: number;
  /** Hidden on the "used" tab, where marking used is a no-op. */
  showMarkUsed: boolean;
  busy: boolean;
  onCancel: () => void;
  onMarkUsed: () => void;
  onDelete: () => void;
}

/** The floating action bar shown while the home list is in multi-select mode. */
export default function HomeSelectionBar({
  count,
  showMarkUsed,
  busy,
  onCancel,
  onMarkUsed,
  onDelete,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.bar}>
      <TouchableOpacity
        onPress={onCancel}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="선택 취소"
      >
        <Text style={styles.cancel}>취소</Text>
      </TouchableOpacity>
      <Text style={styles.count}>{count}개 선택</Text>
      <View style={styles.actions}>
        {showMarkUsed && (
          <TouchableOpacity
            onPress={onMarkUsed}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="선택 항목 사용완료로 표시"
          >
            <Text style={styles.action}>사용완료</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onDelete}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="선택 항목 삭제"
        >
          <Text style={[styles.action, styles.delete]}>삭제</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    bar: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceStrong,
      borderRadius: 14,
      paddingHorizontal: 18,
      paddingVertical: 14,
      shadowColor: colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 5,
    },
    cancel: { color: colors.surface, fontSize: 14, opacity: 0.8 },
    count: { color: colors.surface, fontSize: 14, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 18 },
    action: { color: colors.primaryBright, fontSize: 14, fontWeight: '700' },
    delete: { color: colors.danger },
  });
