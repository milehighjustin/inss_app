import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useMetro } from '@/components/metro';
import { MetroType, Metrics, Radius, Spacing } from '@/constants/metro';
import { getStoredAllocationView, setStoredAllocationView } from '@/lib/preferences/storage';
import {
  investorMoney,
  investorPct,
  type InvestorData,
  type InvestorLocation,
} from '@/lib/investor';
import { AllocationPie, AllocationTooltip, allocationColor } from './allocation-pie';

export interface PortfolioSnapshotProps {
  data: InvestorData;
  onOpenLocation: (location: InvestorLocation) => void;
}

/**
 * v1's Portfolio Snapshot, with the chart in either shape.
 *
 * The heading, the line under it, the two balances and the confidentiality note
 * are v1's, word for word. The equity allocation opens as v1's pie; the flat bar
 * is the alternate view, and the choice sticks per device — a reader who prefers
 * the bar should not have to ask for it again on the next visit.
 *
 * The bar needs a key, since one stacked strip has no names on it, so its legend
 * carries each property's share and the money in it. The pie already names its
 * slices on a wide screen; on a phone, where its labels are hidden, the legend
 * appears there too.
 *
 * The two balances are summed from the properties rather than read off the
 * portfolio totals, which is what v1's table does.
 */
type AllocationView = 'pie' | 'bar';

const DISCLAIMER =
  'The information contained in this Investor Portal (“IP”) is confidential and is to be used ' +
  'solely for Investors to track operational and financial data of real estate investment ' +
  'property. This IP and the information contained herein are not to be used for any other ' +
  'purpose or duplicated or made available to any other person without the express prior ' +
  'written consent of In Self Storage (“ISS”) and its affiliates. All data provided in the IP ' +
  'was prepared based upon current information understood to be accurate by ISS including ' +
  'information derived from third party sources. However, it does not purport to be ' +
  'all-inclusive or to contain all the information which may be material for Investors. Data ' +
  'provided in the IP are approximate and include best guess assumptions and reporting by ISS. ' +
  'All operation and financial data are unaudited and may be subject to error.';

export function PortfolioSnapshot({ data, onOpenLocation }: PortfolioSnapshotProps) {
  const theme = useMetro();
  const { width: windowWidth } = useWindowDimensions();

  const [view, setView] = useState<AllocationView>('pie');
  const [chartWidth, setChartWidth] = useState(0);

  // v1 answers a pointer over a slice with the property, its equity and its
  // share; the bar gets the same readout so the two views answer alike.
  const [barWidth, setBarWidth] = useState(0);
  const [barHover, setBarHover] = useState<{ index: number; x: number } | null>(null);

  // The measured width is exact once layout reports it, and the window-derived
  // width covers the first paint — a chart that waits for a measurement can stay
  // blank when the layout event lands before the screen has a size.
  const available = chartWidth > 0 ? chartWidth : Math.min(900, windowWidth - Metrics.gutter * 2);

  // v1 shows rim labels from its `md` breakpoint up and a solid pie with the
  // legend under it below that.
  const withLabels = available >= 640;

  useEffect(() => {
    let cancelled = false;
    getStoredAllocationView().then((stored) => {
      if (!cancelled && stored === 'bar') setView('bar');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const changeView = (next: AllocationView) => {
    setView(next);
    void setStoredAllocationView(next);
  };

  const shares = useMemo(
    () =>
      data.locations
        .map((location) => ({ location, share: Number(location.equity.pctTotalInvestment) || 0 }))
        .filter((entry) => entry.share > 0)
        .sort((left, right) => right.share - left.share),
    [data.locations],
  );

  // Each segment's place along the bar, as fractions of the whole, so the
  // readout can sit over the segment the pointer is on.
  const totalShare = shares.reduce((sum, entry) => sum + entry.share, 0) || 1;
  let barCursor = 0;
  const segments = shares.map((entry, index) => {
    const from = barCursor;
    barCursor += entry.share / totalShare;
    return { entry, index, from, to: barCursor };
  });

  const TOOLTIP_WIDTH = 178;
  const hoveredSegment = barHover ? segments[barHover.index] : null;
  // The bar fills the chart column, so the measured width answers first and the
  // container's own width covers the first paint.
  const barPixels = barWidth > 0 ? barWidth : available;
  const barTooltipLeft = barHover
    ? Math.min(Math.max(barHover.x - 40, 0), Math.max(0, barPixels - TOOLTIP_WIDTH))
    : 0;

  // The bar answers the pointer the way the pie does: one listener on the strip,
  // the segment worked out from the x position. Per-segment hover handlers are
  // not reliable across the web and native pressables.
  const barRef = useRef<ComponentRef<typeof View>>(null);
  const barHitRef = useRef<(x: number) => number | null>(() => null);
  barHitRef.current = (x: number) => {
    const width = barWidth > 0 ? barWidth : available;
    if (!segments.length || width <= 0) return null;
    const fraction = Math.min(Math.max(x / width, 0), 0.9999);
    const found = segments.findIndex((seg) => fraction >= seg.from && fraction < seg.to);
    return found >= 0 ? found : segments.length - 1;
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || view !== 'bar') return;
    const node = barRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return;

    const move = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const index = barHitRef.current(x);
      setBarHover(index === null ? null : { index, x });
    };
    const leave = () => setBarHover(null);

    node.addEventListener('pointermove', move);
    node.addEventListener('pointerleave', leave);
    return () => {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerleave', leave);
    };
  }, [view]);

  const invested = data.locations.reduce(
    (total, location) => total + (Number(location.equity.investorInvestedTotal) || 0),
    0,
  );
  const value = data.locations.reduce(
    (total, location) => total + (Number(location.equity.investorInvestmentValueDol) || 0),
    0,
  );

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text style={[styles.title, { color: theme.textDim }]}>Portfolio Equity Allocation</Text>
          <Text style={[styles.subtitle, { color: theme.textDim }]}>
            {shares.length > 0
              ? 'Click chart for property details'
              : 'No equity is recorded against this portfolio yet'}
          </Text>
        </View>

        {shares.length > 0 ? (
          <View style={[styles.toggle, { borderColor: theme.border }]} accessibilityRole="tablist">
            {(['pie', 'bar'] as const).map((option) => {
              const active = view === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  aria-selected={active}
                  onPress={() => changeView(option)}
                  style={({ pressed }) => [
                    styles.toggleOption,
                    {
                      backgroundColor: active
                        ? theme.surfaceStrong
                        : pressed
                          ? theme.surface
                          : 'transparent',
                    },
                  ]}>
                  <Text style={[styles.toggleLabel, { color: active ? theme.text : theme.textDim }]}>
                    {option === 'pie' ? 'Pie' : 'Bar'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {shares.length > 0 ? (
        <View style={styles.chartBlock}>
          {view === 'pie' ? (
            <View
              style={styles.pie}
              onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
              <AllocationPie
                slices={shares}
                available={available}
                showLabels={withLabels}
                onOpenLocation={onOpenLocation}
              />
            </View>
          ) : (
            <View ref={barRef} style={styles.barWrap}>
              <View
                style={[styles.bar, { backgroundColor: theme.surface }]}
                onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}>
                {segments.map(({ entry, index }) => (
                  <Pressable
                    key={entry.location.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${entry.location.departmentName}, ${investorPct(
                      entry.share,
                    )} of your portfolio`}
                    onPress={() => onOpenLocation(entry.location)}
                    style={({ pressed }) => [
                      styles.segment,
                      {
                        flexGrow: entry.share,
                        backgroundColor: allocationColor(index),
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  />
                ))}
              </View>

              {hoveredSegment ? (
                <AllocationTooltip
                  location={hoveredSegment.entry.location}
                  left={barTooltipLeft}
                  top={58}
                  width={TOOLTIP_WIDTH}
                />
              ) : null}
            </View>
          )}

          {/* v1's phone legend: a colour and a name under the solid pie. */}
          {view === 'pie' ? (
            !withLabels ? (
              <View style={styles.legend}>
                {shares.map((entry, index) => (
                  <Pressable
                    key={entry.location.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${entry.location.departmentName}`}
                    onPress={() => onOpenLocation(entry.location)}
                    style={({ pressed }) => [
                      styles.legendRow,
                      { backgroundColor: pressed ? theme.surface : 'transparent' },
                    ]}>
                    <View style={[styles.swatch, { backgroundColor: allocationColor(index) }]} />
                    <Text numberOfLines={1} style={[styles.legendName, { color: theme.textDim }]}>
                      {entry.location.departmentName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null
          ) : (
            <View style={styles.legend}>
              {shares.map((entry, index) => (
                <Pressable
                  key={entry.location.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${entry.location.departmentName}`}
                  onPress={() => onOpenLocation(entry.location)}
                  style={({ pressed }) => [
                    styles.legendRow,
                    styles.legendRowDetailed,
                    { backgroundColor: pressed ? theme.surfaceStrong : 'transparent' },
                  ]}>
                  <View style={[styles.swatch, { backgroundColor: allocationColor(index) }]} />
                  <Text numberOfLines={1} style={[styles.legendName, { color: theme.text }]}>
                    {entry.location.departmentName}
                  </Text>
                  <Text style={[styles.legendShare, styles.numbers, { color: theme.textDim }]}>
                    {investorPct(entry.share)}
                  </Text>
                  <Text style={[styles.legendMoney, styles.numbers, { color: theme.text }]}>
                    {investorMoney(entry.location.equity.investorInvestedTotal)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textDim }]}>Current Invested Equity</Text>
          <Text style={[styles.summaryValue, styles.numbers, { color: theme.textDim }]}>
            {investorMoney(invested)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textDim }]}>Current Value Of Equity</Text>
          <Text style={[styles.summaryValue, styles.numbers, { color: theme.textDim }]}>
            {investorMoney(value)}
          </Text>
        </View>
      </View>

      <View style={styles.footnote}>
        <Text style={[styles.disclaimer, { color: theme.textDim }]}>{DISCLAIMER}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  headingText: {
    flex: 1,
    minWidth: 240,
    gap: 2,
  },
  title: {
    // v1: `text-2xl font-bold` in grey.
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
  },
  subtitle: {
    // v1: `font-semibold`.
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: 600,
  },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.control,
    overflow: 'hidden',
  },
  toggleOption: {
    paddingHorizontal: Spacing.three,
    height: 32,
    justifyContent: 'center',
  },
  toggleLabel: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 600,
  },
  chartBlock: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  pie: {
    alignItems: 'center',
    width: '100%',
  },
  barWrap: {
    // The readout is drawn just under the strip, so it needs a box to sit in.
    position: 'relative',
  },
  bar: {
    flexDirection: 'row',
    height: 52,
    gap: 2,
    borderRadius: Radius.control,
    overflow: 'hidden',
  },
  segment: {
    flexBasis: 0,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 6,
    paddingHorizontal: 8,
    maxWidth: 320,
  },
  /** Two columns on a desktop, one on a phone, as the earlier legend read. */
  legendRowDetailed: {
    flexBasis: 340,
    flexGrow: 1,
    maxWidth: 440,
    paddingVertical: 8,
  },
  swatch: {
    width: 12,
    height: 12,
  },
  legendName: {
    flex: 1,
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 600,
  },
  legendShare: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    minWidth: 52,
    textAlign: 'right',
  },
  legendMoney: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    minWidth: 84,
    textAlign: 'right',
    fontWeight: 600,
  },
  summary: {
    alignSelf: 'center',
    gap: 6,
    marginTop: Spacing.three,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  summaryLabel: {
    // v1: `font-semibold text-gray-500`, centred beside its figure.
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: 600,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: 700,
    minWidth: 110,
    textAlign: 'right',
  },
  footnote: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.five,
  },
  disclaimer: {
    // v1: `text-sm text-justify`.
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'justify',
  },
  /** Fixed-width digits so a column of money lines up. */
  numbers: {
    fontVariant: ['tabular-nums'],
  },
});
