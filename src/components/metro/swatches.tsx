import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MetroType, Radius, Spacing } from '@/constants/metro';
import { MetroLabel } from './primitives';
import { useMetro } from './use-metro';

export interface MetroSwatchOption {
  /** Identifier handed back by `onChange`. */
  value: string;
  label: string;
  /** The colour itself. */
  color: string;
}

export interface MetroSwatchesProps {
  /** Small uppercase label above the row. */
  label?: string;
  /** One line under the swatches, e.g. what the colour affects. */
  description?: string;
  options: MetroSwatchOption[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * A row of square colour chips, one selected.
 *
 * Metro has one accent colour, so this picks a single value rather than
 * several. Selected state is carried by a square outline plus a check, not by
 * a shadow; the chips wrap instead of scrolling so a phone still shows them all.
 */
export function MetroSwatches({
  label,
  description,
  options,
  value,
  onChange,
  disabled = false,
}: MetroSwatchesProps) {
  const theme = useMetro();

  return (
    <View style={styles.group}>
      {label ? <MetroLabel>{label}</MetroLabel> : null}

      <View style={styles.row} role="radiogroup">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected, disabled }}
              // react-native-web reads aria-*, native reads accessibilityState.
              aria-checked={selected}
              aria-disabled={disabled}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [styles.item, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
              <View
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? theme.text : 'transparent',
                    backgroundColor: option.color,
                  },
                ]}>
                {selected ? <Text style={[styles.check, { color: theme.onAccent }]}>✓</Text> : null}
              </View>
              <Text style={[styles.name, { color: selected ? theme.text : theme.textDim }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {description ? (
        <Text style={[styles.description, { color: theme.textDim }]}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  item: {
    alignItems: 'center',
    gap: 6,
    minWidth: 56,
  },
  chip: {
    width: 48,
    height: 48,
    borderRadius: Radius.control,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: 700,
  },
  name: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: MetroType.subtle.fontWeight,
  },
  description: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: MetroType.subtle.fontWeight,
  },
});
