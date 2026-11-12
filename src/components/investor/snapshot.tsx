import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { MetroFigures, useMetro, type MetroFigure } from '@/components/metro';
import { MetroType, Metrics, Radius, Spacing } from '@/constants/metro';
import { getStoredAllocationView, setStoredAllocationView } from '@/lib/preferences/storage';
import {
  investorMoney,
  investorPct,
  investorSignedMoney,
  investorSignedPct,
  type InvestorData,
  type InvestorLocation,
} from '@/lib/investor';
import { AllocationPie, allocationColor } from './allocation-pie';

export interface PortfolioSnapshotProps {
  data: InvestorData;
  onOpenLocation: (location: InvestorLocation) => void;
}

/**
 * v1's Portfolio Snapshot: the equity allocation at the top, the portfolio's
 * money under it, and the confidentiality note at the bottom.
 *
 * The chart opens as v1's pie, with the same colours and the same outboard
 * labels; the flat bar is the alternate for anyone who prefers it, and the choice
 * sticks per device. The legend under either carries the property name, its share
 * and the money in it, which v1's pie only showed on hover.
 *
 * The three figures below the chart are the portfolio in one line — what is
 * invested, what it is worth now, and what has been paid out — because an
 * investor opens this screen to answer exactly those three questions. The two
 * balances keep v1's names so nothing has moved.
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

  // v1's chart is what someone should see first; the flat bar is the alternate
  // for anyone who prefers it. The choice sticks per device.
  const [view, setView] = useState<AllocationView>('pie');
  const [chartWidth, setChartWidth] = useState(0);

  // The measured width is exact once layout reports it, and the window-derived
  // width covers the first paint — a chart that waits for a measurement can stay
  // blank when the layout event lands before the screen has a size.
  const available = chartWidth > 0 ? chartWidth : Math.min(900, windowWidth - Metrics.gutter * 2);

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

  const figures = useMemo<MetroFigure[]>(() => {
    const invested = Number(data.portfolio.investorInvestedTotal) || 0;
    const value = Number(data.portfolio.investorInvestmentValueDol) || 0;
    const change = value - invested;
    const changePct = invested > 0 ? (change / invested) * 100 : 0;
    const dividends = Number(data.portfolio.totalDividendsPaid) || 0;
    const lastDividend = Number(data.portfolio.lastDividendDol) || 0;

    return [
      {
        label: 'Current Invested Equity',
        value: investorMoney(invested),
        hint:
          shares.length > 0
            ? `Across ${shares.length} ${shares.length === 1 ? 'property' : 'properties'}`
            : undefined,
      },
      {
        label: 'Current Value Of Equity',
        value: investorMoney(value),
        hint:
          invested > 0 && change !== 0
            ? `${investorSignedMoney(change)} ${investorSignedPct(changePct)}`
            : undefined,
      },
      {
        label: 'Total Dividends Paid',
        value: investorMoney(dividends),
        hint: lastDividend > 0 ? `Last payment ${investorMoney(lastDividend)}` : undefined,
      },
    ];
  }, [data.portfolio, shares.length]);

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text style={[styles.title, { color: theme.text }]}>Portfolio Equity Allocation</Text>
          <Text style={[styles.subtitle, { color: theme.textDim }]}>
            {shares.length > 0
              ? 'Tap a property for its details'
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
                showLabels={available >= 520}
                onOpenLocation={onOpenLocation}
              />
            </View>
          ) : (
            <View style={[styles.bar, { backgroundColor: theme.surface }]}>
              {shares.map((entry, index) => (
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
          )}

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
        </View>
      ) : null}

      <MetroFigures figures={figures} />

      <View style={[styles.footnote, { borderTopColor: theme.border }]}>
        <Text style={[styles.footnoteLabel, { color: theme.textDim }]}>CONFIDENTIAL</Text>
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
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  subtitle: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
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
  },
  pie: {
    alignItems: 'center',
    width: '100%',
  },
  bar: {
    flexDirection: 'row',
    height: 52,
    gap: 2,
  },
  segment: {
    flexBasis: 0,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // Two columns on a desktop, one on a phone: wide enough that a property name
    // is never cut off, which is how v1's legend read.
    flexBasis: 340,
    flexGrow: 1,
    maxWidth: 440,
    paddingVertical: 8,
    paddingHorizontal: 8,
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
    minWidth: 88,
    textAlign: 'right',
  },
  footnote: {
    paddingTop: Spacing.three,
    gap: Spacing.two,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  footnoteLabel: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
    textAlign: 'center',
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  /** Fixed-width digits so a column of money lines up. */
  numbers: {
    fontVariant: ['tabular-nums'],
  },
});
