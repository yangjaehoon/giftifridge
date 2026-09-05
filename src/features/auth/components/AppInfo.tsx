import React from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { PRIVACY_POLICY_URL } from '../../../shared/constants/links';
import { colors } from '../../../shared/theme/colors';

const appVersion = Constants.expoConfig?.version ?? '1.0.0';

/** Version number and the privacy policy link, shown at the bottom of Settings. */
export default function AppInfo() {
  const openPrivacyPolicy = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
      Alert.alert('오류', '페이지를 열지 못했어요.');
    });
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>정보</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>버전</Text>
        <Text style={styles.rowValue}>{appVersion}</Text>
      </View>
      <TouchableOpacity
        style={styles.row}
        onPress={openPrivacyPolicy}
        accessibilityRole="link"
        accessibilityLabel="개인정보처리방침 열기"
      >
        <Text style={styles.rowLabel}>개인정보처리방침</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  title: { fontSize: 15, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { fontSize: 14, color: colors.gray700 },
  rowValue: { fontSize: 14, color: colors.gray500 },
  chevron: { fontSize: 18, color: colors.gray400, fontWeight: '600' },
});
