import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { colors } from '../../../shared/theme/colors';

/**
 * Dims a gifticon's image and stamps its status ('사용완료' / '기한만료')
 * across it, so a glance at the thumbnail is enough without reading nearby
 * text. Renders nothing while the gifticon is still active. The status is
 * already exposed accessibly elsewhere (the card's own accessibilityLabel,
 * the detail screen's D-day pill/사용일 text), so this is hidden from
 * screen readers to avoid an isolated, out-of-context announcement.
 *
 * The parent must give this a `position: relative` (or default, since it's
 * absolutely filled) wrapper with `overflow: hidden` around the image so it
 * clips to the same corners.
 */
export default function GifticonStatusOverlay({
  label,
  textStyle,
}: {
  label: string | null;
  textStyle?: StyleProp<TextStyle>;
}) {
  if (!label) return null;
  return (
    <View style={styles.overlay} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={[styles.label, textStyle]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(30, 43, 42, 0.6)', // colors.gray900 at 60% opacity
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  label: {
    color: colors.surface,
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
  },
});
