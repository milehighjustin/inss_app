import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { MetroType, Metrics, Radius, type MetroColorName } from '@/constants/metro';
import { useMetro } from './use-metro';

export interface MetroButtonProps {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** `ghost` is for secondary actions: flat, no fill, still square. */
  variant?: 'primary' | 'ghost';
  /**
   * `compact` is for an action inside a row (Open, Remove). Full-size buttons in
   * a 40-point row make every row look like a form; this keeps the row a row.
   */
  size?: 'default' | 'compact';
  color?: MetroColorName;
  style?: ViewStyle;
}

export function MetroButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  color = 'accent',
  size = 'default',
  style,
}: MetroButtonProps) {
  const theme = useMetro();
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'compact' && styles.compact,
        {
          backgroundColor:
            variant === 'primary' ? theme[color] : pressed ? theme.surface : 'transparent',
          borderColor: variant === 'ghost' ? theme.border : 'transparent',
          opacity: inactive ? 0.5 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.onAccent : theme.text} />
      ) : (
        <Text
          style={{
            color: variant === 'primary' ? theme.onAccent : theme.text,
            fontSize: size === 'compact' ? MetroType.subtle.fontSize : MetroType.body.fontSize,
            fontWeight: 600,
          }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: Metrics.control,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  compact: {
    height: 36,
    paddingHorizontal: 12,
  },
});
