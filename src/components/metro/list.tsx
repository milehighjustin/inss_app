import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { MetroType, Radius, Spacing } from '@/constants/metro';
import { useMetro } from './use-metro';

export interface MetroListProps {
  /** Optional small heading above the list. */
  title?: string;
  /** Empty state or summary shown under the list. */
  footer?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * A stack of rows separated by hairlines.
 *
 * The separator is the container colour showing through a 1px gap, so rows stay
 * square and nothing is drawn on top of the content.
 */
export function MetroList({ title, footer, children, style }: MetroListProps) {
  const theme = useMetro();

  return (
    <View style={styles.listWrapper}>
      {title ? <Text style={[styles.listTitle, { color: theme.textDim }]}>{title}</Text> : null}
      <View style={[styles.list, { backgroundColor: theme.border }, style]}>{children}</View>
      {footer}
    </View>
  );
}

export type MetroBadgeTone = 'neutral' | 'accent' | 'danger';

export function MetroBadge({ label, tone = 'neutral' }: { label: string; tone?: MetroBadgeTone }) {
  const theme = useMetro();
  const background =
    tone === 'accent' ? theme.accent : tone === 'danger' ? theme.danger : theme.surfaceStrong;
  const color = tone === 'accent' ? theme.onAccent : tone === 'danger' ? '#FFFFFF' : theme.textDim;

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

export interface MetroListRowProps {
  title: string;
  subtitle?: string;
  /** Trailing text, e.g. a count or date. */
  value?: string;
  /**
   * The value is the point of the row — a balance, a total — so it reads in the
   * text colour with tabular digits instead of as a quiet caption.
   */
  emphasis?: boolean;
  /** Trailing node, takes precedence over `value`. */
  accessory?: ReactNode;
  /** Badge rendered under the title. */
  badge?: { label: string; tone?: MetroBadgeTone };
  onPress?: () => void;
  disabled?: boolean;
}

export function MetroListRow({
  title,
  subtitle,
  value,
  emphasis = false,
  accessory,
  badge,
  onPress,
  disabled = false,
}: MetroListRowProps) {
  const theme = useMetro();

  const body = (
    <>
      <View style={styles.rowText}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: theme.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={[styles.rowSubtitle, { color: theme.textDim }]}>
            {subtitle}
          </Text>
        ) : null}
        {badge ? (
          <View style={styles.rowBadge}>
            <MetroBadge label={badge.label} tone={badge.tone} />
          </View>
        ) : null}
      </View>

      {accessory ??
        (value ? (
          <Text
            style={[
              styles.rowValue,
              emphasis && styles.rowValueStrong,
              { color: emphasis ? theme.text : theme.textDim },
            ]}>
            {value}
          </Text>
        ) : null)}

      {onPress ? <Text style={[styles.chevron, { color: theme.textDim }]}>›</Text> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, { backgroundColor: theme.surface, opacity: disabled ? 0.5 : 1 }]}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.surfaceStrong : theme.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listWrapper: {
    gap: Spacing.two,
  },
  listTitle: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  list: {
    gap: 1,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: 600,
  },
  rowSubtitle: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: MetroType.subtle.fontWeight,
  },
  rowBadge: {
    flexDirection: 'row',
    marginTop: 2,
  },
  rowValue: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: MetroType.subtle.fontWeight,
  },
  rowValueStrong: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    fontSize: 22,
    lineHeight: 24,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 700,
    letterSpacing: 1,
  },
});
