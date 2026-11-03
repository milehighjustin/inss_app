import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MetroType, Radius, Spacing } from '@/constants/metro';
import { useMetro } from './use-metro';

export interface MetroStatProps {
  /** What the number is, in the eyebrow voice. */
  label: string;
  /** The number, already formatted by the caller. */
  value: string;
  /** One line of context under it. */
  hint?: string;
  /** `danger` is for a number that needs attention (behind budget, late rent). */
  tone?: 'neutral' | 'accent' | 'danger';
}

/**
 * A headline metric: label, number, optional note on a flat plane.
 *
 * v1's `StatsV2`, minus the boxes inside boxes — hierarchy comes from type.
 * Sizes are fixed-basis and grow, so a row of them fills the width on desktop
 * and wraps to two columns on a phone without any measuring.
 */
export function MetroStat({ label, value, hint, tone = 'neutral' }: MetroStatProps) {
  const theme = useMetro();
  const valueColor = tone === 'danger' ? theme.danger : tone === 'accent' ? theme.accent : theme.text;

  return (
    <View style={[styles.stat, { backgroundColor: theme.surface }]}>
      <Text style={[styles.label, { color: theme.textDim }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={[styles.hint, { color: theme.textDim }]}>{hint}</Text> : null}
    </View>
  );
}

/** A wrapping row of `MetroStat`s. */
export function MetroStatRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 140,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.card,
    gap: 4,
  },
  label: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  value: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  hint: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: MetroType.subtle.fontWeight,
  },
});
