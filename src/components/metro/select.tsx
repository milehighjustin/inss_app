import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MetroType, Metrics, Radius } from '@/constants/metro';
import { MetroLabel } from './primitives';
import { MetroList, MetroListRow } from './list';
import { MetroSheet } from './overlay';
import { useMetro } from './use-metro';

export interface MetroSelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface MetroSelectProps {
  label: string;
  options: MetroSelectOption[];
  value?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  /** Sheet heading; defaults to the field label. */
  sheetTitle?: string;
  /**
   * Drops the label above the control, for a toolbar where the selected value
   * says enough. The label stays on the control for screen readers.
   */
  hideLabel?: boolean;
}

/**
 * Single-choice picker. Looks like a field, opens a sheet with the options —
 * the Metro version of v1's InputCombobox, with no dropdown overlay to trap.
 */
export function MetroSelect({
  label,
  options,
  value,
  placeholder = 'Select',
  onChange,
  error,
  hint,
  disabled = false,
  sheetTitle,
  hideLabel = false,
}: MetroSelectProps) {
  const theme = useMetro();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.wrapper}>
      {hideLabel ? null : <MetroLabel>{label}</MetroLabel>}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        accessibilityLabel={label}
        // react-native-web reads aria-*, native reads accessibilityState.
        aria-expanded={open}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: pressed ? theme.surfaceStrong : theme.surface,
            borderColor: error ? theme.danger : theme.border,
            opacity: disabled ? 0.5 : 1,
          },
        ]}>
        <Text
          numberOfLines={1}
          style={[styles.value, { color: selected ? theme.text : theme.textDim }]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={[styles.caret, { color: theme.textDim }]}>▾</Text>
      </Pressable>

      {error ? (
        <Text style={[styles.helper, { color: theme.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.helper, { color: theme.textDim }]}>{hint}</Text>
      ) : null}

      <MetroSheet
        visible={open}
        title={sheetTitle ?? label}
        onClose={() => setOpen(false)}>
        <MetroList>
          {options.map((option) => (
            <MetroListRow
              key={option.value}
              title={option.label}
              subtitle={option.description}
              value={option.value === value ? 'Selected' : undefined}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
            />
          ))}
        </MetroList>
      </MetroSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  field: {
    height: Metrics.control,
    borderRadius: Radius.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: {
    flex: 1,
    fontSize: MetroType.body.fontSize,
  },
  caret: {
    fontSize: 14,
  },
  helper: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
});
