import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MetroType, Radius, Spacing } from '@/constants/metro';
import { MetroLabel } from './primitives';
import { useMetro } from './use-metro';

/** Label + optional description + control, shared by the row-style controls. */
function ControlRow({
  label,
  description,
  disabled,
  onPress,
  accessibilityRole,
  accessibilityState,
  children,
  alignTop = false,
}: {
  label: string;
  description?: string;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityRole: 'checkbox' | 'switch' | 'radio';
  accessibilityState: { checked?: boolean; disabled?: boolean };
  children: React.ReactNode;
  alignTop?: boolean;
}) {
  const theme = useMetro();

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityLabel={label}
      // react-native-web reads the aria-* props, native reads accessibilityState.
      aria-checked={accessibilityState.checked}
      aria-disabled={accessibilityState.disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.surface : 'transparent',
          opacity: disabled ? 0.5 : 1,
          alignItems: alignTop ? 'flex-start' : 'center',
        },
      ]}>
      {children}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.rowDescription, { color: theme.textDim }]}>{description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export interface MetroCheckboxProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function MetroCheckbox({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: MetroCheckboxProps) {
  const theme = useMetro();

  return (
    <ControlRow
      label={label}
      description={description}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}>
      <View
        style={[
          styles.checkbox,
          {
            borderColor: checked ? theme.accent : theme.border,
            backgroundColor: checked ? theme.accent : 'transparent',
          },
        ]}>
        {checked ? <Text style={[styles.checkmark, { color: theme.onAccent }]}>✓</Text> : null}
      </View>
    </ControlRow>
  );
}

export interface MetroToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

/** Switch with a square track and a round knob, per METRO.md. */
export function MetroToggle({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: MetroToggleProps) {
  const theme = useMetro();

  return (
    <ControlRow
      label={label}
      description={description}
      disabled={disabled}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}>
      <View
        style={[
          styles.track,
          { backgroundColor: value ? theme.accent : theme.surfaceStrong },
        ]}>
        <View
          style={[
            styles.knob,
            {
              backgroundColor: value ? theme.onAccent : theme.background,
              transform: [{ translateX: value ? 18 : 0 }],
            },
          ]}
        />
      </View>
    </ControlRow>
  );
}

export interface MetroRadioOption {
  value: string;
  label: string;
  description?: string;
}

export interface MetroRadioGroupProps {
  label?: string;
  options: MetroRadioOption[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function MetroRadioGroup({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: MetroRadioGroupProps) {
  const theme = useMetro();

  return (
    <View style={styles.group}>
      {label ? <MetroLabel>{label}</MetroLabel> : null}
      <View style={styles.groupRows}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <ControlRow
              key={option.value}
              label={option.label}
              description={option.description}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              alignTop>
              <View
                style={[
                  styles.radio,
                  { borderColor: selected ? theme.accent : theme.border },
                ]}>
                {selected ? (
                  <View style={[styles.radioDot, { backgroundColor: theme.accent }]} />
                ) : null}
              </View>
            </ControlRow>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: 500,
  },
  rowDescription: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 700,
  },
  track: {
    width: 44,
    height: 26,
    borderRadius: Radius.control,
    padding: 3,
    justifyContent: 'center',
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: Radius.round,
  },
  group: {
    gap: 6,
  },
  groupRows: {
    gap: 0,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: Radius.round,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.round,
  },
});
