import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { MetroType, Metrics, Radius } from '@/constants/metro';
import { MetroLabel } from './primitives';
import { useMetro } from './use-metro';

interface FieldChromeProps {
  label: string;
  error?: string;
  hint?: string;
  hideLabel?: boolean;
  children: ReactNode;
}

function FieldChrome({ label, error, hint, hideLabel = false, children }: FieldChromeProps) {
  const theme = useMetro();

  return (
    <View style={styles.wrapper}>
      {hideLabel ? null : <MetroLabel>{label}</MetroLabel>}
      {children}
      {error ? (
        <Text style={[styles.helper, { color: theme.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.helper, { color: theme.textDim }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export interface MetroFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Rendered under the field in the danger colour. */
  error?: string;
  /** Rendered under the field when there is no error. */
  hint?: string;
  /**
   * Drops the label above the field, for a toolbar where the placeholder and
   * the value carry the meaning. The label stays on the input for screen
   * readers.
   */
  hideLabel?: boolean;
}

export function MetroField({
  label,
  error,
  hint,
  hideLabel,
  onFocus,
  onBlur,
  ...rest
}: MetroFieldProps) {
  const theme = useMetro();
  const [focused, setFocused] = useState(false);

  return (
    <FieldChrome label={label} error={error} hint={hint} hideLabel={hideLabel}>
      <TextInput
        placeholderTextColor={theme.textDim}
        // The label is drawn above the field, so it has to be attached to the
        // input too for screen readers.
        accessibilityLabel={label}
        {...rest}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : focused ? theme.accent : theme.border,
            color: theme.text,
          },
        ]}
      />
    </FieldChrome>
  );
}

export interface MetroTextAreaProps extends MetroFieldProps {
  /** Visible lines; the box grows from here. */
  rows?: number;
}

export function MetroTextArea({
  label,
  error,
  hint,
  // Text areas are never label-less; the prop arrives with MetroFieldProps.
  hideLabel: _hideLabel,
  rows = 4,
  onFocus,
  onBlur,
  ...rest
}: MetroTextAreaProps) {
  const theme = useMetro();
  const [focused, setFocused] = useState(false);

  return (
    <FieldChrome label={label} error={error} hint={hint}>
      <TextInput
        multiline
        textAlignVertical="top"
        placeholderTextColor={theme.textDim}
        accessibilityLabel={label}
        {...rest}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          styles.textArea,
          {
            minHeight: 24 * rows + 24,
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : focused ? theme.accent : theme.border,
            color: theme.text,
          },
        ]}
      />
    </FieldChrome>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  input: {
    height: Metrics.control,
    borderRadius: Radius.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: MetroType.body.fontSize,
  },
  textArea: {
    height: undefined,
    paddingTop: 12,
    paddingBottom: 12,
  },
  helper: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
});
