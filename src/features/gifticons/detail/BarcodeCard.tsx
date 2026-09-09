import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { haptics } from '../../../shared/utils/haptics';
import type { Palette } from '../../../shared/theme/colors';
import { useThemedStyles } from '../../../shared/theme/ThemeProvider';
import GifticonBarcode from './GifticonBarcode';

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

interface Props {
  value: string;
  /** Open the full-screen barcode. */
  onZoom: () => void;
}

/** The scannable barcode block on the detail screen: the barcode graphic
 *  (tap to enlarge), the spaced-out number, and a copy-to-clipboard button
 *  (its "복사됨" confirmation is local state). */
export default function BarcodeCard({ value, onZoom }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [copied, setCopied] = useState(false);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetRef.current) clearTimeout(resetRef.current);
    };
  }, []);

  const copy = async () => {
    await Clipboard.setStringAsync(value);
    haptics.selection();
    setCopied(true);
    if (resetRef.current) clearTimeout(resetRef.current);
    resetRef.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={onZoom}
        accessibilityRole="button"
        accessibilityLabel="바코드 크게 보기"
      >
        <GifticonBarcode value={value} />
      </TouchableOpacity>
      <Text style={styles.number} selectable accessibilityLabel={value}>
        {value.replace(/(.{4})/g, '$1 ').trim()}
      </Text>
      <Text style={styles.hint}>탭하면 크게 볼 수 있어요</Text>
      <TouchableOpacity
        style={styles.copyButton}
        onPress={copy}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="바코드 번호 복사"
      >
        <Text style={styles.copyButtonText}>{copied ? '복사됨 ✓' : '번호 복사'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      padding: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      gap: 10,
    },
    number: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.gray900,
      letterSpacing: 2,
      fontVariant: ['tabular-nums'],
    },
    hint: { fontSize: 12, color: colors.gray500, marginTop: -6 },
    copyButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
    },
    copyButtonText: { fontSize: 13, color: colors.gray700, fontWeight: '700' },
  });
