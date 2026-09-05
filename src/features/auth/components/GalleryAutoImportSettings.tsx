import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useGalleryAutoImport } from '../../gifticons/hooks/useGalleryAutoImport';
import { colors } from '../../../shared/theme/colors';

/** The "사진첩에서 자동 등록" toggle on the settings screen. */
export default function GalleryAutoImportSettings({ ownerId }: { ownerId: string | undefined }) {
  const { enabled, loading, toggle } = useGalleryAutoImport(ownerId);

  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.title}>사진첩에서 자동 등록</Text>
          <Text style={styles.subtitle}>
            새로 저장되는 사진 중 기프티콘으로 보이는 것을 확인 없이 바로 등록해요. 상품명·브랜드는
            정확히 읽어내지 못할 수 있어 나중에 직접 수정해야 할 수 있어요.
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          disabled={loading}
          accessibilityLabel="사진첩 자동 등록"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textCol: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.gray500, lineHeight: 18 },
});
