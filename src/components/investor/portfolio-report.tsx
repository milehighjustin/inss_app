import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMetro } from '@/components/metro';
import { MetroType, Spacing } from '@/constants/metro';
import {
  investorDate,
  investorMoney,
  investorNegatedMoney,
  investorPct,
  type InvestorData,
  type InvestorLocation,
} from '@/lib/investor';

export interface PortfolioReportProps {
  data: InvestorData;
  onOpenLocation: (location: InvestorLocation) => void;
}

interface ReportRow {
  title: string;
  /** One value per location, in the same order as `data.locations`. */
  values: string[];
  portfolio: string;
  organization: string;
}

interface ReportSection {
  divider: string;
  rows: ReportRow[];
}

const HEADER_HEIGHT = 64;
const ROW_HEIGHT = 40;
const LABEL_WIDTH = 210;
const LOCATION_WIDTH = 120;
const TOTAL_WIDTH = 118;

/**
 * v1's Portfolio Report.
 *
 * A row per metric, a column per property, then this investor's portfolio and
 * the organization's beside them. Section dividers are v1's, in v1's order, and
 * the arithmetic is v1's too — including printing `N/A` where v1 prints it
 * rather than inventing a number.
 *
 * The header row is outside the vertical scroll and inside the horizontal one,
 * so property names stay above their columns whichever way the board moves.
 */
export function PortfolioReport({ data, onOpenLocation }: PortfolioReportProps) {
  const theme = useMetro();
  const [frameHeight, setFrameHeight] = useState(0);

  const sections = useMemo<ReportSection[]>(() => {
    const each = (get: (location: InvestorLocation) => string) => data.locations.map(get);

    return [
      {
        divider: 'Operations',
        rows: [
          {
            title: 'Status',
            values: each((location) => location.status || 'N/A'),
            portfolio: 'N/A',
            organization: 'N/A',
          },
          {
            title: 'Budget Occupancy',
            values: each((location) => investorPct(location.budgetOccupancy)),
            portfolio: investorPct(data.portfolio.budgetOccupancy),
            organization: investorPct(data.organizationPortfolio.budgetOccupancy),
          },
          {
            title: 'SF Occupancy (Storage Only)',
            values: each((location) => investorPct(location.occupiedAreaPct)),
            portfolio: investorPct(data.portfolio.storageSfOcc),
            organization: investorPct(data.organizationPortfolio.storageSfOcc),
          },
          {
            title: 'Total Unit Occupancy',
            values: each((location) => investorPct(location.occupancyPct)),
            portfolio: investorPct(data.portfolio.totalUnitOcc),
            organization: investorPct(data.organizationPortfolio.totalUnitOcc),
          },
          {
            title: '30 Day Net Absorption',
            values: each((location) => investorPct(location.absorption30)),
            portfolio: investorPct(data.portfolio.absorption30),
            organization: investorPct(data.organizationPortfolio.absorption30),
          },
          {
            title: '>1 Month Delinquency',
            values: each((location) => investorPct(location.gt30delinquent)),
            portfolio: investorPct(data.portfolio.gt30delinquent),
            organization: investorPct(data.organizationPortfolio.gt30delinquent),
          },
        ],
      },
      {
        divider: 'Financial Performance',
        rows: [
          {
            title: 'Income Actual as % of Budget',
            values: each((location) => investorPct(location.incomeVsBudgetPct)),
            portfolio: investorPct(data.portfolio.incomeVsBudgetPct),
            organization: investorPct(data.organizationPortfolio.incomeVsBudgetPct),
          },
          {
            title: 'Expense Actual as % of Budget',
            values: each((location) => investorPct(location.expensesVsBudgetPct)),
            portfolio: investorPct(data.portfolio.expensesVsBudgetPct),
            organization: investorPct(data.organizationPortfolio.expensesVsBudgetPct),
          },
          {
            title: 'NOI Actual as % of Budget',
            values: each((location) => investorPct(location.noiVsBudgetPct)),
            portfolio: investorPct(data.portfolio.noiVsBudgetPct),
            organization: investorPct(data.organizationPortfolio.noiVsBudgetPct),
          },
          {
            title: 'Actual vs Budget NOI Delta',
            values: each((location) => investorMoney(location.noiVsBudgetDol)),
            portfolio: investorMoney(data.portfolio.noiVsBudgetDol),
            organization: investorMoney(data.organizationPortfolio.noiVsBudgetDol),
          },
        ],
      },
      {
        divider: 'Your Equity Amount',
        rows: [
          {
            title: 'Current Deal Equity Amount',
            values: each((location) => investorMoney(location.equity.totalInvested)),
            portfolio: investorMoney(data.portfolio.totalDealEquity),
            organization: investorMoney(data.organizationPortfolio.totalDealEquity),
          },
          {
            title: 'Your Equity Share',
            values: each((location) => investorPct(location.equity.investorSharePct, 2)),
            portfolio: investorPct(data.portfolio.investorSharePct, 2),
            organization: investorPct(data.organizationPortfolio.investorSharePct, 2),
          },
          {
            title: 'Your Current Equity',
            values: each((location) => investorMoney(location.equity.investorInvestedTotal)),
            portfolio: investorMoney(data.portfolio.investorInvestedTotal),
            organization: investorMoney(data.organizationPortfolio.investorInvestedTotal),
          },
          {
            title: 'Your Equity Allocation p/ Deal',
            values: each((location) => investorPct(location.equity.pctTotalInvestment)),
            portfolio: investorPct(data.portfolio.pctTotalInvestment),
            organization: 'N/A',
          },
          {
            title: 'Your Est. Capital Calls',
            values: each((location) => investorMoney(location.equity.projectedCapitalCallsDol)),
            portfolio: investorMoney(data.portfolio.projectedCapitalCalls),
            organization: investorMoney(data.organizationPortfolio.projectedCapitalCalls),
          },
        ],
      },
      {
        divider: 'Your Equity Value',
        rows: [
          {
            title: 'Valuation Date',
            values: each((location) => investorDate(location.valuationDate)),
            portfolio: '-',
            organization: '-',
          },
          {
            title: 'Est. Property Value',
            values: each((location) => investorMoney(location.propertyValue)),
            portfolio: investorMoney(data.portfolio.propertyValue),
            organization: investorMoney(data.organizationPortfolio.propertyValue),
          },
          {
            title: 'Est. Closing Costs',
            values: each((location) =>
              investorNegatedMoney((location.closingCostPct / 100) * location.propertyValue),
            ),
            portfolio: investorNegatedMoney(data.portfolio.estimatedClosingCosts),
            organization: investorNegatedMoney(data.organizationPortfolio.estimatedClosingCosts),
          },
          {
            title: 'Operating Cash + Reserves',
            values: each((location) => investorMoney(location.operatingCashReserves)),
            portfolio: '-',
            organization: '-',
          },
          {
            title: 'Loan Balance',
            values: each((location) => investorMoney(location.loanBalance * -1)),
            portfolio: investorMoney(data.portfolio.loanBalance * -1),
            organization: investorMoney(data.organizationPortfolio.loanBalance * -1),
          },
          {
            title: 'Net Sales Proceeds',
            values: each((location) => investorMoney(location.equity.netSalesProceeds)),
            portfolio: investorMoney(data.portfolio.netSalesProceeds),
            organization: investorMoney(data.organizationPortfolio.netSalesProceeds),
          },
          {
            title: 'Est Sale Promote',
            values: each((location) => investorNegatedMoney(location.issPromote)),
            portfolio: investorNegatedMoney(data.portfolio.issPromote),
            organization: investorNegatedMoney(data.organizationPortfolio.issPromote),
          },
          {
            title: 'Net Investor Proceeds',
            values: each((location) => investorMoney(location.equity.netInvestorProceeds)),
            portfolio: investorMoney(data.portfolio.netInvestorProceeds),
            organization: investorMoney(data.organizationPortfolio.netInvestorProceeds),
          },
          {
            title: 'Your Equity Value',
            values: each((location) => investorMoney(location.equity.investorInvestmentValueDol)),
            portfolio: investorMoney(data.portfolio.investorInvestmentValueDol),
            organization: investorMoney(data.organizationPortfolio.investorInvestmentValueDol),
          },
        ],
      },
      {
        divider: 'Your Dividends',
        rows: [
          {
            title: 'Total Dividends Paid',
            values: each((location) => investorMoney(location.equity.totalDividendsPaid)),
            portfolio: investorMoney(data.portfolio.totalDividendsPaid),
            organization: 'N/A',
          },
          {
            title: 'Needed to Break Even',
            values: each((location) => investorMoney(location.equity.equityExposure)),
            portfolio: investorMoney(data.portfolio.equityExposure),
            organization: 'N/A',
          },
          {
            title: 'Last Dividend Annualized %',
            values: each((location) => investorPct(location.equity.lastDividendAnn)),
            portfolio: 'N/A',
            organization: 'N/A',
          },
          {
            title: 'Last Dividend $ Paid',
            values: each((location) => investorMoney(location.equity.lastDividendDol)),
            portfolio: investorMoney(data.portfolio.lastDividendDol),
            organization: 'N/A',
          },
        ],
      },
    ];
  }, [data]);

  const bodyHeight = Math.max(frameHeight - HEADER_HEIGHT, 0);

  return (
    <View style={styles.root}>
      <View
        style={[styles.frame, { borderColor: theme.border }]}
        onLayout={(event) => setFrameHeight(event.nativeEvent.layout.height)}>
        {frameHeight > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View
                style={[
                  styles.headerRow,
                  { height: HEADER_HEIGHT, backgroundColor: theme.surface },
                ]}>
                <View style={[styles.headerCell, styles.labelCell]}>
                  <Text style={[styles.headerText, { color: theme.textDim }]}>METRIC</Text>
                </View>
                {data.locations.map((location) => (
                  <View key={location.id} style={[styles.headerCell, styles.locationCell]}>
                    <Text
                      numberOfLines={2}
                      onPress={() => onOpenLocation(location)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${location.departmentName}`}
                      style={[styles.headerText, styles.number, styles.numbers, { color: theme.accent }]}>
                      {location.departmentName}
                    </Text>
                  </View>
                ))}
                <View
                  style={[
                    styles.headerCell,
                    styles.totalCell,
                    styles.summaryStart,
                    { borderLeftColor: theme.border },
                  ]}>
                  <Text style={[styles.headerText, styles.number, { color: theme.accent }]}>
                    My Portfolio
                  </Text>
                </View>
                <View style={[styles.headerCell, styles.totalCell]}>
                  <Text style={[styles.headerText, styles.number, { color: theme.text }]}>
                    ISS Portfolio
                  </Text>
                </View>
              </View>

              <ScrollView style={{ height: bodyHeight }} showsVerticalScrollIndicator>
                {sections.map((section, sectionIndex) => (
                  <View key={section.divider}>
                    <View style={[styles.dividerRow, { borderBottomColor: theme.border }]}>
                      <Text style={[styles.dividerText, { color: theme.textDim }]}>
                        {section.divider.toUpperCase()}
                      </Text>
                    </View>

                    {section.rows.map((row, rowIndex) => (
                      <View
                        key={row.title}
                        style={[
                          styles.row,
                          {
                            height: ROW_HEIGHT,
                            backgroundColor:
                              (sectionIndex + rowIndex) % 2 === 0 ? theme.background : theme.surface,
                            borderColor: theme.border,
                          },
                        ]}>
                        <View style={[styles.cell, styles.labelCell]}>
                          <Text numberOfLines={2} style={[styles.cellText, { color: theme.text }]}>
                            {row.title}
                          </Text>
                        </View>
                        {row.values.map((value, index) => (
                          <View
                            key={`${row.title}-${index}`}
                            style={[styles.cell, styles.locationCell]}>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.cellText,
                                styles.number,
                                styles.numbers,
                                { color: theme.text },
                              ]}>
                              {value}
                            </Text>
                          </View>
                        ))}
                        <View
                          style={[
                            styles.cell,
                            styles.totalCell,
                            styles.summaryStart,
                            { borderLeftColor: theme.border },
                          ]}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.cellText,
                              styles.number,
                              styles.numbers,
                              { color: theme.text, fontWeight: 600 },
                            ]}>
                            {row.portfolio}
                          </Text>
                        </View>
                        <View style={[styles.cell, styles.totalCell]}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.cellText,
                              styles.number,
                              styles.numbers,
                              { color: theme.textDim },
                            ]}>
                            {row.organization}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        ) : null}
      </View>

      <Text style={[styles.caption, { color: theme.textDim }]}>
        Amounts in US dollars unless shown as a percentage. Tap a property name to open it.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: Spacing.two,
  },
  frame: {
    flex: 1,
    borderWidth: 1,
    overflow: 'hidden',
  },
  /** The hairline that sets this investor's own column apart from the org's. */
  summaryStart: {
    borderLeftWidth: 1,
  },
  numbers: {
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontSize: 11,
    lineHeight: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerCell: {
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  dividerRow: {
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingTop: Spacing.three,
    paddingBottom: 6,
  },
  dividerText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 700,
    letterSpacing: 1.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  cell: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cellText: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 500,
  },
  labelCell: {
    width: LABEL_WIDTH,
  },
  locationCell: {
    width: LOCATION_WIDTH,
  },
  totalCell: {
    width: TOTAL_WIDTH,
  },
  number: {
    textAlign: 'right',
  },
});
