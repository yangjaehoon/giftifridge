import { StyleSheet } from 'react-native';
import type { Palette } from './colors';
import { useThemedStyles } from './ThemeProvider';

/**
 * The labeled-text-input look shared by every form screen (add/edit gifticon,
 * create/join space). Screens still own their own layout; this is just the
 * label / field / error-text triad that was defined byte-for-byte identically
 * in each one. Call `useFormStyles()` from a component so it tracks the theme.
 */
const makeFormStyles = (colors: Palette) =>
  StyleSheet.create({
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.gray700,
      marginBottom: 6,
      marginTop: 14,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.gray900,
      backgroundColor: colors.surface,
    },
    inputError: { borderColor: colors.danger },
    errorText: { fontSize: 12, color: colors.danger, marginTop: 6 },
  });

export function useFormStyles() {
  return useThemedStyles(makeFormStyles);
}
