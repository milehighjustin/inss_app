import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/metro';

/**
 * A board: a fixed-height row of columns on a wide screen.
 *
 * Used with `MetroScreen scroll={false}`. The page itself does not move — the
 * panes do — which is the difference between a dashboard and a document. On a
 * phone there is no width to split, so a screen should fall back to a normal
 * scrolling page below its own breakpoint.
 */
export function MetroBoard({ children }: { children: ReactNode }) {
  return <View style={styles.board}>{children}</View>;
}

/**
 * One column of a board.
 *
 * `grow` is a flex weight, so an alerts pane that matters most gets the width
 * rather than all columns being equal by accident.
 */
export function MetroPane({ grow = 1, children }: { grow?: number; children: ReactNode }) {
  return (
    <View style={[styles.pane, { flex: grow }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator
        nestedScrollEnabled>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.four,
    // Lets the panes resolve a height instead of growing the page: without this
    // a ScrollView inside a flex row has nothing to be bounded by.
    minHeight: 0,
  },
  pane: {
    minWidth: 0,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
  },
  body: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
});
