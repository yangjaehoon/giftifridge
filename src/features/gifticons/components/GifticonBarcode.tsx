import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Barcode from '@kichiyaki/react-native-barcode-generator';
import { colors } from '../../../shared/theme/colors';

/**
 * A scannable CODE128 rendering of the stored barcode number. CODE128 encodes
 * any digit string and every POS scanner reads it, so we don't try to detect
 * the original symbology — a scan still resolves to the same digits, and the
 * register looks the product up by those. If the value can't be encoded at all
 * we render nothing and let the caller's number text stand on its own.
 */
export default function GifticonBarcode({ value }: { value: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || value.trim() === '') return null;

  return (
    <View
      style={styles.wrap}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Barcode
        value={value}
        format="CODE128"
        height={72}
        maxWidth={280}
        lineColor={colors.gray900}
        background={colors.surface}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 4 },
});
