import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';

type Variant = 'primary' | 'secondary' | 'ghostDanger';

/**
 * The one button in the app. `primary` fills with the brand colour, `secondary`
 * is a muted fill, `ghostDanger` is borderless red text for destructive
 * secondary actions. Height stays >= 48 for touch, and `loading` swaps the
 * label for a spinner while blocking presses.
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const spinnerColor = variant === 'primary' ? colors.surface : colors.gray700;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghostDanger' && styles.ghostDanger,
        isDisabled && variant !== 'ghostDanger' && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.labelOnFill,
            variant === 'secondary' && styles.labelSecondary,
            variant === 'ghostDanger' && styles.labelDanger,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceMuted },
  ghostDanger: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.6 },
  label: { fontSize: 15, fontWeight: '700' },
  labelOnFill: { color: colors.surface },
  labelSecondary: { color: colors.gray700 },
  labelDanger: { color: colors.danger },
});
