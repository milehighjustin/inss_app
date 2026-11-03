import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { MetroFigures, MetroHeading, useMetro, type MetroFigure } from '@/components/metro';
import { MetroType, Spacing } from '@/constants/metro';
import { REPORT_MENU, type ReportKind } from '@/lib/reports';
import {
  investorDate,
  investorMoney,
  investorNegatedMoney,
  investorNumber,
  investorPct,
  type InvestorLocation,
  type InvestorPortfolio,
} from '@/lib/investor';

export interface LocationDetailProps {
  location: InvestorLocation;
  investorPortfolio: InvestorPortfolio;
  organizationPortfolio: InvestorPortfolio;
  /** Opens one of the property's QuickBooks reports. */
  onOpenReport: (kind: ReportKind) => void;
}

interface DetailRow {
  title: string;
  location?: string;
  portfolio?: string;
  organization?: string;
}

interface DetailSection {
  divider: string;
  rows: DetailRow[];
}

/**
 * One property, as v1's big modal shows it.
 *
 * The four numbers an investor comes here for open the panel; below them the
 * same three-column comparison v1 draws — this property, this investor's
 * portfolio, the organization's — and beside it the property's facts, how the
 * equity splits across accounts, and the three reports. Nothing has moved; the
 * hierarchy is now carried by type and hairlines instead of filled section bars,
 * so forty rows of figures read as one statement.
 */
export function LocationDetail({
  location,
  investorPortfolio,
  organizationPortfolio,
  onOpenReport,
}: LocationDetailProps) {
  const theme = useMetro();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const sections: DetailSection[] = [
    {
      divider: 'Operations',
      rows: [
        {
          title: 'Budget Occupancy',
          location: investorPct(location.budgetOccupancy),
          portfolio: investorPct(investorPortfolio.budgetOccupancy),
          organization: investorPct(organizationPortfolio.budgetOccupancy),
        },
        {
          title: 'SF Occupancy (Storage Only)',
          location: investorPct(location.occupiedStorageSfPct),
          portfolio: investorPct(investorPortfolio.occupiedStorageSfPct),
          organization: investorPct(organizationPortfolio.occupiedStorageSfPct),
        },
        {
          title: 'Total Unit Occupancy',
          location: investorPct(location.occupancyPct),
          portfolio: investorPct(investorPortfolio.totalUnitOcc),
          organization: investorPct(organizationPortfolio.totalUnitOcc),
        },
        {
          title: '30 Day Net Absorption',
          location: investorPct(location.absorption30),
          portfolio: investorPct(investorPortfolio.absorption30),
          organization: investorPct(organizationPortfolio.absorption30),
        },
        {
          title: '>1 Month Delinquency',
          location: investorPct(location.gt30delinquent),
          portfolio: investorPct(investorPortfolio.gt30delinquent),
          organization: investorPct(organizationPortfolio.gt30delinquent),
        },
      ],
    },
    {
      divider: 'Financials',
      rows: [
        {
          title: 'Income Actual as % of Budget',
          location: investorPct(location.incomeVsBudgetPct),
          portfolio: investorPct(investorPortfolio.incomeVsBudgetPct),
          organization: investorPct(organizationPortfolio.incomeVsBudgetPct),
        },
        {
          title: 'Expense Actual as % of Budget',
          location: investorPct(location.expensesVsBudgetPct),
          portfolio: investorPct(investorPortfolio.expensesVsBudgetPct),
          organization: investorPct(organizationPortfolio.expensesVsBudgetPct),
        },
        {
          title: 'NOI Actual as % of Budget',
          location: investorPct(location.noiVsBudgetPct),
          portfolio: investorPct(investorPortfolio.noiVsBudgetPct),
          organization: investorPct(organizationPortfolio.noiVsBudgetPct),
        },
        {
          title: 'Actual vs Budget NOI Delta',
          location: investorMoney(location.noiVsBudgetDol),
          portfolio: investorMoney(investorPortfolio.noiVsBudgetDol),
          organization: investorMoney(organizationPortfolio.noiVsBudgetDol),
        },
      ],
    },
    {
      divider: 'Values And Dividends',
      rows: [
        {
          title: 'Your Equity Share',
          location: investorPct(location.equity.investorSharePct, 2),
          portfolio: investorPct(investorPortfolio.investorSharePct, 2),
          organization: '-',
        },
        {
          title: 'Your Starting Equity',
          location: investorMoney(location.equity.initialInvestmentDol),
          portfolio: investorMoney(investorPortfolio.initialInvestmentDol),
          organization: '-',
        },
        {
          title: 'Your Change In Equity',
          location: investorMoney(location.equity.changeInEquity),
          portfolio: investorMoney(
            investorPortfolio.initialInvestmentDol - investorPortfolio.investorInvestedTotal,
          ),
          organization: '-',
        },
        {
          title: 'Your Current Equity',
          location: investorMoney(location.equity.investorInvestedTotal),
          portfolio: investorMoney(investorPortfolio.investorInvestedTotal),
          organization: '-',
        },
        {
          title: `Est. Value of Investment (as of ${investorDate(location.valuationDate)})`,
          location: investorMoney(location.equity.investorInvestmentValueDol),
          portfolio: investorMoney(investorPortfolio.investorInvestmentValueDol),
          organization: '-',
        },
        {
          title: 'Total Dividends Paid',
          location: investorMoney(location.equity.totalDividendsPaid),
          portfolio: investorMoney(investorPortfolio.totalDividendsPaid),
          organization: '-',
        },
        {
          title: 'Last Dividend Annualized %',
          location: investorPct(location.equity.lastDividendAnn),
          portfolio: '-',
          organization: '-',
        },
        {
          title: 'Last Dividend Paid',
          location: investorMoney(location.equity.lastDividendDol),
          portfolio: '-',
          organization: '-',
        },
      ],
    },
  ];

  const details: { label: string; value: string }[] = [
    {
      label: 'Location',
      value:
        [location.address.city, location.address.region].filter(Boolean).join(', ') || '-',
    },
    { label: 'Acquisition Date', value: investorDate(location.acquisitionDate) },
    { label: 'Status', value: location.status || '-' },
    { label: 'Storage SF', value: investorNumber(location.storageSF) },
    { label: 'Total Area (SF)', value: investorNumber(location.totalArea) },
    { label: 'Valuation Date', value: investorDate(location.valuationDate) },
    { label: 'Loan Interest Rate', value: investorPct(location.loanInterestRate) },
    { label: 'Loan Maturity Date', value: investorDate(location.loanMaturityDate) },
  ];

  // The panel's statement: share, equity, what it is worth and what has been
  // paid out. Same four numbers the portfolio shows for all properties at once.
  const figures: MetroFigure[] = [
    {
      label: 'Your Equity Share',
      value: investorPct(location.equity.investorSharePct, 2),
      hint: `${investorMoney(location.equity.totalInvested)} of deal equity`,
    },
    {
      label: 'Your Current Equity',
      value: investorMoney(location.equity.investorInvestedTotal),
      hint: `Started at ${investorMoney(location.equity.initialInvestmentDol)}`,
    },
    {
      label: 'Est. Value Of Equity',
      value: investorMoney(location.equity.investorInvestmentValueDol),
      hint: `As of ${investorDate(location.valuationDate)}`,
      tone: 'accent',
    },
    {
      label: 'Dividends Paid',
      value: investorMoney(location.equity.totalDividendsPaid),
      hint:
        location.equity.lastDividendDol > 0
          ? `Last payment ${investorMoney(location.equity.lastDividendDol)}`
          : undefined,
    },
  ];

  // Every account's slice of this property's equity, as a share of the total
  // the rows add up to.
  const allocationTotal = location.equity.cumulativeByAccount.reduce(
    (total, account) => total + account.amount,
    0,
  );

  const comparison = (
    <View style={styles.comparison}>
      <MetroHeading>How this property compares</MetroHeading>

      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
        <View style={styles.table}>
          <View style={[styles.headerRow, { borderBottomColor: theme.text }]}>
            <View style={[styles.headerCell, styles.titleCell]} />
            <Text
              numberOfLines={2}
              style={[
                styles.headerCell,
                styles.headerText,
                styles.valueCell,
                styles.number,
                { color: theme.accent },
              ]}>
              {location.departmentName}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.headerCell,
                styles.headerText,
                styles.valueCell,
                styles.number,
                { color: theme.text },
              ]}>
              Your Portfolio
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.headerCell,
                styles.headerText,
                styles.valueCell,
                styles.number,
                { color: theme.textDim },
              ]}>
              ISS Portfolio
            </Text>
          </View>

          {sections.map((section) => (
            <View key={section.divider}>
              <View style={[styles.dividerRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.dividerText, { color: theme.textDim }]}>
                  {section.divider.toUpperCase()}
                </Text>
              </View>
              {section.rows.map((row) => (
                <View
                  key={row.title}
                  style={[styles.row, { borderBottomColor: theme.border }]}>
                  <Text
                    numberOfLines={2}
                    style={[styles.cell, styles.titleCell, { color: theme.text }]}>
                    {row.title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.cell,
                      styles.valueCell,
                      styles.number,
                      styles.numbers,
                      styles.valueStrong,
                      { color: theme.text },
                    ]}>
                    {row.location ?? '-'}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.cell,
                      styles.valueCell,
                      styles.number,
                      styles.numbers,
                      styles.valueMedium,
                      { color: theme.text },
                    ]}>
                    {row.portfolio ?? '-'}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.cell,
                      styles.valueCell,
                      styles.number,
                      styles.numbers,
                      { color: theme.textDim },
                    ]}>
                    {row.organization ?? '-'}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {location.notes.length > 0 ? (
        <View style={styles.notes}>
          <MetroHeading>{`Notes · ${location.notes.length}`}</MetroHeading>
          {location.notes.map((note, index) => (
            <View
              key={`${note.createdAt}-${index}`}
              style={[styles.note, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
              <Text style={[styles.noteDate, { color: theme.textDim }]}>
                {investorDate(note.createdAt).toUpperCase()}
              </Text>
              <Text style={[styles.noteText, { color: theme.text }]}>{note.content}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  const side = (
    <View style={styles.side}>
      <View style={styles.sideBlock}>
        <MetroHeading>Property details</MetroHeading>
        <View>
          {details.map((detail, index) => (
            <View
              key={detail.label}
              style={[
                styles.detailRow,
                index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
              ]}>
              <Text style={[styles.detailLabel, { color: theme.textDim }]}>{detail.label}</Text>
              <Text style={[styles.detailValue, styles.numbers, { color: theme.text }]}>
                {detail.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sideBlock}>
        <MetroHeading>Investment allocation</MetroHeading>
        {location.equity.cumulativeByAccount.length === 0 ? (
          <Text style={[styles.emptyNote, { color: theme.textDim }]}>No equity accounts</Text>
        ) : (
          <View style={styles.allocation}>
            {location.equity.cumulativeByAccount.map((account, index) => {
              const share =
                allocationTotal > 0
                  ? Math.max(0, Math.min(100, (account.amount / allocationTotal) * 100))
                  : 0;

              return (
                <View
                  key={`${account.name}-${index}`}
                  style={[
                    styles.allocationRow,
                    index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                  ]}>
                  <View style={styles.allocationLine}>
                    <Text numberOfLines={1} style={[styles.detailLabel, { color: theme.text }]}>
                      {account.name}
                    </Text>
                    <Text style={[styles.detailValue, styles.numbers, { color: theme.text }]}>
                      {investorMoney(account.amount)}
                    </Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: theme.surfaceStrong }]}>
                    <View
                      style={[
                        styles.trackFill,
                        { backgroundColor: theme.accent, width: `${share}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.sideBlock}>
        <MetroHeading>Reports</MetroHeading>
        <View>
          {REPORT_MENU.map((report, index) => (
            <Pressable
              key={report.kind}
              accessibilityRole="button"
              accessibilityLabel={`Open ${report.label}`}
              onPress={() => onOpenReport(report.kind)}
              style={({ pressed }) => [
                styles.reportRow,
                {
                  borderColor: theme.border,
                  borderTopWidth: index > 0 ? 1 : 0,
                  backgroundColor: pressed ? theme.surface : 'transparent',
                },
              ]}>
              <Text style={[styles.reportLabel, { color: theme.text }]}>{report.label}</Text>
              <Text style={[styles.reportChevron, { color: theme.textDim }]}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.sideBlock}>
        <MetroHeading>Property value</MetroHeading>
        <MetroFigures
          size="medium"
          figures={[
            { label: 'Est. Property Value', value: investorMoney(location.propertyValue) },
            {
              label: 'Est. Closing Costs',
              value: investorNegatedMoney((location.closingCostPct / 100) * location.propertyValue),
            },
          ]}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <MetroFigures figures={figures} />

      <View style={[styles.body, wide ? styles.bodyWide : null]}>
        {comparison}
        {side}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.four,
  },
  body: {
    gap: Spacing.five,
  },
  bodyWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.five,
  },
  comparison: {
    flex: 1,
    gap: Spacing.three,
    minWidth: 0,
  },
  tableScroll: {
    flexGrow: 0,
  },
  table: {
    minWidth: 620,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
  },
  headerCell: {
    paddingHorizontal: 8,
  },
  headerText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 700,
    letterSpacing: 0.6,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  dividerRow: {
    borderBottomWidth: 1,
    paddingHorizontal: 8,
    paddingTop: Spacing.four,
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
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  titleCell: {
    width: 216,
  },
  valueCell: {
    width: 116,
  },
  number: {
    textAlign: 'right',
  },
  /** The property itself: the subject of the panel, so the heaviest numbers. */
  valueStrong: {
    fontWeight: 700,
  },
  valueMedium: {
    fontWeight: 600,
  },
  /** Fixed-width digits so a column of money lines up. */
  numbers: {
    fontVariant: ['tabular-nums'],
  },
  notes: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  note: {
    paddingVertical: Spacing.three,
    gap: 4,
  },
  noteText: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  noteDate: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 700,
    letterSpacing: 1,
  },
  side: {
    width: '100%',
    maxWidth: 360,
    gap: Spacing.five,
  },
  sideBlock: {
    gap: Spacing.two,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: 9,
  },
  detailLabel: {
    flexShrink: 1,
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 500,
  },
  detailValue: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 600,
    textAlign: 'right',
  },
  emptyNote: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    paddingVertical: Spacing.three,
  },
  allocation: {
    gap: 0,
  },
  allocationRow: {
    paddingVertical: 10,
    gap: 6,
  },
  allocationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  track: {
    height: 4,
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  reportLabel: {
    fontSize: MetroType.body.fontSize,
    fontWeight: 600,
  },
  reportChevron: {
    fontSize: 20,
    lineHeight: 22,
  },
});
