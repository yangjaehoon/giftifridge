import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { Palette } from '../../../shared/theme/colors';
import { useColors, useThemedStyles } from '../../../shared/theme/ThemeProvider';
import { useFormStyles } from '../../../shared/theme/forms';

interface Props {
  hasLocation: boolean;
  saving: boolean;
  onSaveCurrent: () => void;
  onSearchPress: () => void;
}

/** The optional "store location" row: save-here button, address-search link,
 *  and the geofence explainer once a location is set. */
export default function StoreLocationField({
  hasLocation,
  saving,
  onSaveCurrent,
  onSearchPress,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const formStyles = useFormStyles();

  return (
    <>
      <Text style={formStyles.label}>매장 위치 (선택)</Text>
      <TouchableOpacity style={styles.locationButton} onPress={onSaveCurrent} disabled={saving}>
        {saving ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.locationButtonText}>
            {hasLocation ? '매장 위치가 저장됨 ✓' : '지금 여기를 매장 위치로 저장'}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.locationSearchLink} onPress={onSearchPress}>
        <Text style={styles.locationSearchLinkText}>주소로 검색해서 선택</Text>
      </TouchableOpacity>
      {hasLocation && (
        <Text style={styles.hint}>근처에 다시 왔을 때 이 기프티콘을 알려드려요.</Text>
      )}
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    locationButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    locationButtonText: { color: colors.gray700, fontSize: 14, fontWeight: '600' },
    locationSearchLink: { alignSelf: 'center', paddingVertical: 8 },
    locationSearchLinkText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
    hint: { fontSize: 12, color: colors.primary, marginTop: 6 },
  });
