import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Palette } from '../../../shared/theme/colors';
import { useThemedStyles } from '../../../shared/theme/ThemeProvider';

/**
 * A dismissible home-screen nudge for an anonymous user with something to lose:
 * linking an account is what makes the data survive a lost phone or a
 * reinstall (and keeps it out of the 180-day cleanup).
 */
export default function LinkAccountBanner({
  onLink,
  onDismiss,
}: {
  onLink: () => void;
  onDismiss: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        지금은 이 기기에만 저장돼요. 계정을 연결하면 기기를 바꿔도 기프티콘이 유지돼요.
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onLink}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
        >
          <Text style={styles.link}>계정 연결</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="나중에 하기"
        >
          <Text style={styles.dismiss}>나중에</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    banner: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 14,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
    },
    text: { fontSize: 13, color: colors.gray700, lineHeight: 19 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 10 },
    link: { fontSize: 13, fontWeight: '700', color: colors.primary },
    dismiss: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  });
