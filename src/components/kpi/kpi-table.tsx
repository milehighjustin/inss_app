import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { MetroDialog, useMetro } from '@/components/metro';
import { MetroType, Radius } from '@/constants/metro';
import type { KpiFacility } from '@/lib/kpi';
import { DEFAULT_SORT, KPI_COLUMNS, nextSort, sortFacilities, type KpiSort } from './kpi-columns';

/**
 * v1's KPI table, on a phone.
 *
 * Same columns, same order, same short headers, same footer arithmetic. The frame
 * scrolls both ways inside a bounded box: the header row stays at the top, the
 * footer row stays at the bottom, and the facility column stays at the left, so a
 * number always has a label and a name.
 *
 * Two vertical panes (names, metrics) are kept in step by mirroring offsets. That
 * is what buys the frozen column without a native table: the label pane is simply
 * not part of the horizontal scroll.
 */

const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 52;
const ROW_HEIGHT = 44;
const NAME_WIDTH = 184;
/** Narrower label column on phones, so a whole metric column still fits beside it. */
const NAME_WIDTH_PHONE = 132;
const COLUMN_WIDTH = 136;

export interface KpiTableProps {
  facilities: KpiFacility[];
  onOpen: (facility: KpiFacility) => void;
}

export function KpiTable({ facilities, onOpen }: KpiTableProps) {
  const theme = useMetro();
  const { width } = useWindowDimensions();
  const nameWidth = width < 480 ? NAME_WIDTH_PHONE : NAME_WIDTH;

  const [innerHeight, setInnerHeight] = useState(0);
  const [sort, setSort] = useState<KpiSort>(DEFAULT_SORT);
  // Which column's explanation is open, if any. v1's headers carried these as
  // little info popovers; here the marker is a tap target and the text reads in
  // a dialog, which works the same on a phone, a tablet and the web.
  const [hint, setHint] = useState<{ label: string; text: string } | null>(null);

  const namesRef = useRef<ScrollViewInstance>(null);
  const cellsRef = useRef<ScrollViewInstance>(null);
  const offsets = useRef({ names: 0, cells: 0 });

  const bodyHeight = Math.max(innerHeight - HEADER_HEIGHT - FOOTER_HEIGHT, 0);
  const rows = useMemo(() => sortFacilities(facilities, sort), [facilities, sort]);

  /**
   * Mirrors one pane's vertical offset onto the other.
   *
   * The `offsets` bookkeeping is what stops the two from bouncing off each
   * other: a pane ignores an offset it was just told to move to.
   */
  const syncScroll =
    (from: 'names' | 'cells') => (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      offsets.current[from] = y;

      const other = from === 'names' ? 'cells' : 'names';
      if (Math.abs(offsets.current[other] - y) < 0.5) return;

      offsets.current[other] = y;
      const target = from === 'names' ? cellsRef : namesRef;
      target.current?.scrollTo({ y, animated: false });
    };

  const rowColor = (index: number) => (index % 2 === 0 ? theme.surface : theme.background);
  const arrow = (key: string) =>
    sort.key === key ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <View style={[styles.frame, { borderColor: theme.border }]}>
      {/* Measured inside the frame's border, not on it: with the outer height the
          panes were two points too tall, which lifted the label column's footer
          just above the metric footers beside it. */}
      <View
        style={styles.panes}
        onLayout={(event) => setInnerHeight(event.nativeEvent.layout.height)}>
        {innerHeight > 0 ? (
          <>
          {/* Sticky label column: outside the horizontal scroll, so it cannot move. */}
          <View style={[styles.labelPane, { width: nameWidth, borderColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sort by facility name"
              onPress={() => setSort((current) => nextSort(current, 'name'))}
              style={[
                styles.headerCell,
                styles.labelCell,
                {
                  height: HEADER_HEIGHT,
                  backgroundColor: theme.surfaceStrong,
                  borderColor: theme.border,
                },
                // The sort in force is marked on the column it belongs to, not
                // only by the arrow: a board of forty numbers needs the column
                // found at a glance.
                sort.key === 'name' ? { borderBottomWidth: 3, borderBottomColor: theme.accent } : null,
              ]}>
              <Text style={[styles.headerText, { color: theme.text }]}>
                {`Facility${arrow('name')}`}
              </Text>
            </Pressable>

            <ScrollView
              ref={namesRef}
              style={{ height: bodyHeight }}
              showsVerticalScrollIndicator={false}
              onScroll={syncScroll('names')}
              scrollEventThrottle={16}>
              {rows.map((facility, index) => (
                <Pressable
                  key={facility.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${facility.name}`}
                  onPress={() => onOpen(facility)}
                  style={({ pressed }) => [
                    styles.labelCell,
                    styles.nameRow,
                    {
                      height: ROW_HEIGHT,
                      backgroundColor: pressed ? theme.surfaceStrong : rowColor(index),
                      borderColor: theme.border,
                    },
                  ]}>
                  <Text numberOfLines={1} style={[styles.nameText, { color: theme.text }]}>
                    {facility.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* v1's total row, held at the bottom so it is always readable. */}
            <View
              style={[
                styles.footerCell,
                styles.labelCell,
              {
                height: FOOTER_HEIGHT,
                backgroundColor: theme.surfaceStrong,
                borderColor: theme.border,
                // A rule, not a fill, closes the table: totals belong to the
                // data above them.
                borderTopWidth: 1,
                borderTopColor: theme.text,
              },
            ]}>
            <Text style={[styles.footerLabel, { color: theme.text }]}>
                {`All ${rows.length} listed`}
              </Text>
              <Text style={[styles.footerNote, { color: theme.textDim }]}>S: sum · A: average</Text>
            </View>
          </View>

          {/* Metric columns: the header and footer scroll sideways with them, never up. */}
          <ScrollView
            horizontal
            style={styles.metricScroll}
              contentContainerStyle={{ height: innerHeight }}
            showsHorizontalScrollIndicator>
            <View style={{ height: innerHeight }}>
              <View style={[styles.headerRow, { height: HEADER_HEIGHT }]}>
                {KPI_COLUMNS.map((column) => (
                  <View
                    key={column.key}
                    style={[
                      styles.headerCell,
                      styles.metricCell,
                      {
                        width: COLUMN_WIDTH,
                        height: HEADER_HEIGHT,
                        backgroundColor: theme.surfaceStrong,
                        borderColor: theme.border,
                      },
                      sort.key === column.key
                        ? { borderBottomWidth: 3, borderBottomColor: theme.accent }
                        : null,
                    ]}>
                    {/* Sorting is the label's job; the explanation is its own
                        target, so a tap never does both. */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Sort by ${column.label}`}
                      onPress={() => setSort((current) => nextSort(current, column.key))}
                      style={styles.headerSort}>
                      <Text
                        numberOfLines={3}
                        style={[
                          styles.headerText,
                          styles.number,
                          { color: sort.key === column.key ? theme.accent : theme.textDim },
                        ]}>
                        {`${column.label}${arrow(column.key)}`}
                      </Text>
                    </Pressable>

                    {column.hint ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`About ${column.label}`}
                        onPress={() => setHint({ label: column.label, text: column.hint })}
                        style={({ pressed }) => [
                          styles.info,
                          {
                            borderColor: theme.border,
                            backgroundColor: pressed ? theme.background : 'transparent',
                          },
                        ]}>
                        <Text style={[styles.infoText, { color: theme.textDim }]}>i</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>

              <ScrollView
                ref={cellsRef}
                style={{ height: bodyHeight }}
                showsVerticalScrollIndicator
                onScroll={syncScroll('cells')}
                scrollEventThrottle={16}>
                {rows.map((facility, index) => (
                  <Pressable
                    key={facility.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${facility.name}`}
                    onPress={() => onOpen(facility)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        height: ROW_HEIGHT,
                        backgroundColor: pressed ? theme.surfaceStrong : rowColor(index),
                      },
                    ]}>
                    {KPI_COLUMNS.map((column) => (
                      <View
                        key={column.key}
                        style={[
                          styles.metricCell,
                          { width: COLUMN_WIDTH, borderColor: theme.border },
                        ]}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.cellText,
                            styles.number,
                            {
                              color:
                                column.tone?.(facility) === true ? theme.danger : theme.text,
                            },
                          ]}>
                          {column.value(facility)}
                        </Text>
                      </View>
                    ))}
                  </Pressable>
                ))}
              </ScrollView>

              <View style={[styles.footerRow, { height: FOOTER_HEIGHT }]}>
                {KPI_COLUMNS.map((column) => (
                  <View
                    key={column.key}
                    style={[
                      styles.footerCell,
                      styles.metricCell,
                      {
                        width: COLUMN_WIDTH,
                        height: FOOTER_HEIGHT,
                        backgroundColor: theme.surfaceStrong,
                        borderColor: theme.border,
                        borderTopWidth: 1,
                        borderTopColor: theme.text,
                      },
                    ]}>
                    <Text
                      numberOfLines={2}
                      style={[styles.footerText, styles.number, { color: theme.text }]}>
                      {column.footer?.(rows) ?? ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </>
        ) : null}
      </View>

      <MetroDialog
        visible={hint !== null}
        title={hint?.label ?? ''}
        message={hint?.text}
        onClose={() => setHint(null)}
        actions={[{ label: 'Got it', onPress: () => setHint(null) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    borderWidth: 1,
    // The list sits in a rounded plane like every other container; the rows
    // still read as a grid because only the outer corners are soft.
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  panes: {
    flexDirection: 'row',
    flex: 1,
  },
  labelPane: {
    borderRightWidth: 1,
  },
  metricScroll: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
  },
  footerRow: {
    flexDirection: 'row',
  },
  headerCell: {
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
  headerSort: {
    justifyContent: 'flex-end',
    // Keeps wrapped labels out of the marker's corner; the text is right
    // aligned, so the lane is invisible.
    paddingLeft: 22,
  },
  info: {
    // Top-left of the cell, above the label's lane.
    position: 'absolute',
    top: 4,
    left: 4,
    width: 18,
    height: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
  },
  labelCell: {
    justifyContent: 'center',
    paddingLeft: 10,
    paddingRight: 8,
    borderRightWidth: 0,
  },
  nameRow: {
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
  },
  metricCell: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  footerCell: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 2,
  },
  headerText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  nameText: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 600,
  },
  cellText: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 500,
    // Fixed-width digits so a column of money lines up.
    fontVariant: ['tabular-nums'],
  },
  footerText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  footerLabel: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 700,
  },
  footerNote: {
    fontSize: 10,
    lineHeight: 14,
  },
  number: {
    textAlign: 'right',
  },
});
