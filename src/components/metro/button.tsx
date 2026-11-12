import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';

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
  const { width } = useWindowDimensions();
  const inactive = disabled || loading;

  /**
   * A button is as wide as its label — everywhere except a phone.
   *
   * Stretched across a desktop window it stops reading as a button and starts
   * reading as a banner, with its label a hand's width from whatever it acts on.
   * On a phone the full width is what makes it a comfortable target, so there it
   * keeps the column. `Metrics.desktop` is the same line the tile field uses,
   * so a button and the form around it never disagree about what a phone is.
   *
   * A caller that really needs the full width can still pass it in `style`,
   * which is applied last.
   */
  const fullWidth = width < Metrics.desktop;

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
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
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
