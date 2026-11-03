import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useMetro } from '@/components/metro/use-metro';
import { MetroType, Spacing } from '@/constants/metro';

export interface AdminToolbarProps {
  /** The one line of context: how many rows out of how many. */
  count: string;
  /** Fields, in the middle of the strip. Wrap each in a flexed View. */
  children?: ReactNode;
  /** Buttons, pushed to the right edge on a wide window. */
  actions?: ReactNode;
}

/**
 * The strip above every admin list.
 *
 * The same order as the KPI board: the count first, then the search, then the
 * actions at the right. Admin used to put the count after the search on some
 * screens and before it on none, which made moving between sections feel like
 * changing apps. On a phone the strip wraps onto its own lines; the actions keep
 * their size rather than squeezing the search away.
 */
export function AdminToolbar({ count, children, actions }: AdminToolbarProps) {
  const theme = useMetro();

  return (
    <View style={styles.strip}>
      <Text numberOfLines={1} style={[styles.count, { color: theme.textDim }]}>
        {count}
      </Text>

      {children}

      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // The count is text among 52-point controls, so the strip centres on the
    // controls rather than hanging off their tops.
    alignItems: 'center',
    gap: Spacing.two,
  },
  count: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 600,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginLeft: 'auto',
  },
});
