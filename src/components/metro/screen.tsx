import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { MaxContentWidth, MetroType, Metrics, Spacing } from '@/constants/metro';
import { useMetro } from './use-metro';

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
  const bodyPadding =
    padding === 'compact'
      ? { paddingTop: Spacing.two, paddingBottom: Spacing.two }
      : { paddingTop: Spacing.four, paddingBottom: Spacing.five };

  const column = (
    <View
      style={[styles.column, width === 'column' && { maxWidth: MaxContentWidth }, contentStyle]}>
      {eyebrow || title || subtitle || action ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
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
          {action}
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
