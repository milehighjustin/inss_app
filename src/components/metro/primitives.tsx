import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MetroType, Spacing } from '@/constants/metro';
import { useMetro } from './use-metro';

/** A flat horizontal rule. Metro separates with space and lines, not boxes. */
export function MetroRule({ label }: { label?: string }) {
  const theme = useMetro();

  if (!label) {
    return <View style={{ height: 1, backgroundColor: theme.border }} />;
  }

  return (
    <View style={styles.ruleRow}>
      <View style={[styles.ruleLine, { backgroundColor: theme.border }]} />
      <Text style={[styles.ruleLabel, { color: theme.textDim }]}>{label}</Text>
      <View style={[styles.ruleLine, { backgroundColor: theme.border }]} />
    </View>
  );
}

/** The small uppercase label used above fields and rows. */
export function MetroLabel({ children }: { children: string }) {
  const theme = useMetro();
  return <Text style={[styles.label, { color: theme.textDim }]}>{children.toUpperCase()}</Text>;
}

export interface MetroHeadingProps {
  children: string;
  /** Trailing slot on the heading row, e.g. a count. */
  accessory?: ReactNode;
}

/**
 * How a data block opens: a small uppercase heading.
 *
 * Used where a full `MetroSection` would be too grand — the property panel, a
 * facility's metric groups. It carries no rule: uppercase plus space is enough
 * hierarchy, and a hairline under every heading is what made the screens read as
 * ruled paper.
 */
export function MetroHeading({ children, accessory }: MetroHeadingProps) {
  const theme = useMetro();

  return (
    <View style={styles.heading}>
      <View style={styles.headingRow}>
        <Text style={[styles.label, styles.headingLabel, { color: theme.textDim }]}>
          {children.toUpperCase()}
        </Text>
        {accessory}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleLine: {
    flex: 1,
    height: 1,
  },
  ruleLabel: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  label: {
    fontSize: MetroType.eyebrow.fontSize,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  heading: {
    gap: Spacing.two,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headingLabel: {
    flexShrink: 1,
  }
});
