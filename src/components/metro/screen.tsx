import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';

import { MaxContentWidth, MetroType, Metrics, Spacing } from '@/constants/metro';
import { useMetro } from './use-metro';

/**
 * Below this the header's buttons move under its words.
 *
 * The same line the button uses to go full width: on a phone every button in the
 * action slot is as wide as the page, so sharing a row with the title left the
 * title clipped to a few letters.
 */
const HEADER_STACK_BREAKPOINT = Metrics.desktop;

export interface MetroScreenProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Right-hand slot in the header row, e.g. an add button. */
  action?: ReactNode;
  children: ReactNode;
  /** Adds pull-to-refresh. Pass the same callback here and to your data fetch. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Turn off for screens that scroll themselves (a FlatList body, for example). */
  scroll?: boolean;
  /**
   * How much of a wide window the page uses.
   *
   * - `column` (default): one centred column, capped at `MaxContentWidth`.
   *   Right for forms, account details and anything else read line by line.
   * - `wide`: the full width, minus the gutters. Right for dashboards, KPI
   *   boards and lists, where the extra width is the point.
   */
  width?: 'column' | 'wide';
  contentStyle?: ViewStyle;
  /**
   * Page breathing room. `compact` is for screens that own the whole window and
   * need the height — a table, a board — rather than a page with a heading.
   */
  padding?: 'page' | 'compact';
}

/**
 * Page body: flat background, one centred column, a type-led header and
 * pull-to-refresh. Screens should not re-implement padding or max width.
 */
export function MetroScreen({
  eyebrow,
  title,
  subtitle,
  action,
  children,
  onRefresh,
  refreshing = false,
  scroll = true,
  width = 'column',
  contentStyle,
  padding = 'page',
}: MetroScreenProps) {
  const theme = useMetro();
  const { width: windowWidth } = useWindowDimensions();
  // A wide window puts the actions beside the heading; a narrow one puts them
  // beneath it, full width, where they cannot squeeze the heading away.
  const stacked = windowWidth < HEADER_STACK_BREAKPOINT;
  const bodyPadding =
    padding === 'compact'
      ? { paddingTop: Spacing.two, paddingBottom: Spacing.two }
      : { paddingTop: Spacing.four, paddingBottom: Spacing.five };

  const column = (
    <View
      style={[styles.column, width === 'column' && { maxWidth: MaxContentWidth }, contentStyle]}>
      {eyebrow || title || subtitle || action ? (
        <View
          style={[
            styles.header,
            stacked && { flexDirection: 'column', alignItems: 'stretch' },
          ]}>
          <View style={stacked ? styles.headerTextStacked : styles.headerText}>
            {eyebrow ? (
              <Text style={[styles.eyebrow, { color: theme.textDim }]}>
                {eyebrow.toUpperCase()}
              </Text>
            ) : null}
            {title ? <Text style={[styles.title, { color: theme.text }]}>{title}</Text> : null}
            {subtitle ? (
              <Text style={[styles.subtitle, { color: theme.textDim }]}>{subtitle}</Text>
            ) : null}
          </View>
          {action ? (
            <View style={stacked ? styles.actionStacked : styles.actionInline}>{action}</View>
          ) : null}
        </View>
      ) : null}

      {children}
    </View>
  );

  if (!scroll) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <View style={[styles.staticBody, bodyPadding]}>{column}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.scrollContent, bodyPadding]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        ) : undefined
      }>
      {column}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Metrics.gutter,
  },
  staticBody: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Metrics.gutter,
  },
  column: {
    width: '100%',
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  // In a column the words take their own height rather than `flex: 1`, which
  // would grow them down the page; `stretch` gives them the full width.
  headerTextStacked: {
    alignSelf: 'stretch',
    gap: 4,
  },
  actionInline: {
    flexShrink: 0,
    justifyContent: 'flex-start',
  },
  actionStacked: {
    alignSelf: 'stretch',
  },
  eyebrow: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  title: {
    fontSize: MetroType.title.fontSize,
    lineHeight: MetroType.title.lineHeight,
    fontWeight: MetroType.title.fontWeight,
  },
  subtitle: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: MetroType.body.fontWeight,
  },
});
