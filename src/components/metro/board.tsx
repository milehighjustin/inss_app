import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Spacing } from '@/constants/metro';
import { MetroScreen, type MetroScreenProps } from './screen';

/**
 * The width at which pages stop being documents and become boards.
 *
 * One number for the whole app: a screen that switches layout at a different
 * width from the one beside it makes the console feel assembled from parts.
 */
export const BOARD_BREAKPOINT = 900;

/** True on a window wide enough to be split, which is what every layout asks. */
export function useBoard(): boolean {
  const { width } = useWindowDimensions();
  return width >= BOARD_BREAKPOINT;
}

/**
 * A page that does not scroll on a wide screen.
 *
 * The admin console is a console, not a document: a supervisor standing at a
 * desk should see the whole section without dragging anything. Children are laid
 * out in a fixed column, and the part that genuinely needs to scroll — the list,
 * a long form — goes inside `MetroListArea`.
 *
 * Below the breakpoint this is an ordinary scrolling page: a phone has no second
 * axis to spend, and stacking there is the honest choice rather than a lazy one.
 */
export function MetroBoardPage({ contentStyle, ...rest }: Omit<MetroScreenProps, 'scroll'>) {
  const board = useBoard();

  return (
    <MetroScreen
      {...rest}
      scroll={!board}
      padding={board ? 'compact' : (rest.padding ?? 'page')}
      contentStyle={board ? (StyleSheet.flatten([styles.page, contentStyle]) ?? undefined) : contentStyle}
    />
  );
}

/**
 * The one region of a board that scrolls.
 *
 * A fragment on a phone, where the page already scrolls and a second scroll
 * area inside it would trap the drag.
 */
export function MetroListArea({ grow = 1, children }: { grow?: number; children: ReactNode }) {
  const board = useBoard();
  if (!board) return <>{children}</>;
  return <MetroPane grow={grow}>{children}</MetroPane>;
}

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
  page: {
    flex: 1,
  },
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
