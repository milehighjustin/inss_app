import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MetroType, Spacing } from '@/constants/metro';
import { useMetro } from './use-metro';

export interface MetroSectionProps {
  /** v1's SectionBlock heading. Omitted for an untitled group. */
  title?: string;
  /** The one-line explanation under the heading. */
  hint?: string;
  /** Right-hand slot in the heading row, e.g. a count. */
  accessory?: ReactNode;
  children: ReactNode;
}

/**
 * A titled group — v1's SectionBlock.
 *
 * The heading carries the hierarchy and space closes the section; there is no
 * box, no fill, no shadow and no closing rule, per METRO.md — a rule under every
 * group turns a form into a stack of lines. Used by the admin panels, which are
 * long forms where every group needs its own label.
 */
export function MetroSection({ title, hint, accessory, children }: MetroSectionProps) {
  const theme = useMetro();

  return (
    <View style={styles.section}>
      {title || accessory ? (
        <View style={styles.heading}>
          <View style={styles.headingText}>
            {title ? (
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            ) : null}
            {hint ? (
              <Text style={[styles.hint, { color: theme.textDim }]}>{hint}</Text>
            ) : null}
          </View>
          {accessory}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  headingText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  hint: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: MetroType.subtle.fontWeight,
  },
  body: {
    gap: Spacing.two,
  },
});
