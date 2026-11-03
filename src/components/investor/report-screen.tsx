import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroEmpty,
  MetroError,
  MetroField,
  MetroLabel,
  MetroLoading,
  MetroScreen,
  useMetro,
} from '@/components/metro';
import { MetroType, Spacing } from '@/constants/metro';
import type { InvestorTarget } from '@/lib/investor';
import { openPdf } from '@/lib/pdf';
import {
  REPORT_TITLES,
  isReportKind,
  loadReport,
  reportFileName,
  reportRangeLabel,
  type ReportDocument,
  type ReportTable,
} from '@/lib/reports';
import { ActingAsNotice } from './acting-as';

/**
 * One report for one property.
 *
 * v1 opened these in a modal over the portfolio: a pair of date fields, "Run
 * Report", and once there was a report, a PDF icon. The order is the same here —
 * dates, run, print — but the report itself is drawn from the API's tables
 * rather than injected HTML, so a phone can read it and the columns can scroll.
 *
 * The dates start on the API's default window for the report, which is v1's.
 *
 * `actingAs` builds the report for an administrator previewing that investor's
 * portfolio, so the preview shows the same numbers the investor would print.
 */

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A `YYYY-MM-DD` date that exists: `2026-13-01` matches the shape but not the calendar. */
function isRealDay(value: string): boolean {
  if (!DAY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export function InvestorReportScreen({ actingAs }: { actingAs?: InvestorTarget }) {
  const router = useRouter();
  const theme = useMetro();
  const { locationId, kind: rawKind } = useLocalSearchParams<{
    locationId?: string;
    kind?: string;
  }>();

  const kind = isReportKind(rawKind) ? rawKind : null;
  const id = typeof locationId === 'string' ? locationId : '';

  const [report, setReport] = useState<ReportDocument | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !kind) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadReport(id, kind, undefined, actingAs?.userId)
      .then((document) => {
        if (cancelled) return;
        setReport(document);
        setStart(document.start);
        setEnd(document.end);
      })
      .catch((cause) => {
        if (!cancelled) setError(messageOf(cause, 'Could not build this report'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, kind, actingAs?.userId]);

  const run = async () => {
    if (!id || !kind) return;
    setNotice(null);

    if (!isRealDay(start) || !isRealDay(end)) {
      setError('Use dates like 2025-01-31');
      return;
    }
    if (start >= end) {
      setError('Start date must be before end date');
      return;
    }

    setRunning(true);
    setError(null);

    try {
      const document = await loadReport(id, kind, { start, end }, actingAs?.userId);
      setReport(document);
      setStart(document.start);
      setEnd(document.end);
    } catch (cause) {
      setError(messageOf(cause, 'Could not build this report'));
    } finally {
      setRunning(false);
    }
  };

  const print = async () => {
    if (!report) return;

    setPrinting(true);
    setError(null);
    setNotice(null);

    try {
      await openPdf({ html: report.html, filename: reportFileName(report) });
      setNotice('The PDF is ready.');
    } catch (cause) {
      setError(messageOf(cause, 'Could not produce the PDF'));
    } finally {
      setPrinting(false);
    }
  };

  const back = () => router.back();

  if (!id || !kind) {
    return (
      <MetroScreen eyebrow="Investor · Report" title="Report">
        <MetroError
          message="No report was chosen. Open one from a property in your portfolio."
          onRetry={back}
          retryLabel="Back to portfolio"
        />
      </MetroScreen>
    );
  }

  return (
    <MetroScreen
      eyebrow={actingAs ? 'Investor Portal · Preview' : 'Investor · Report'}
      title={report?.title ?? REPORT_TITLES[kind]}
      subtitle={report ? `${report.property} · ${reportRangeLabel(report)}` : undefined}
      width="wide"
      action={<MetroButton label="‹ Portfolio" variant="ghost" onPress={back} />}>
      {actingAs ? <ActingAsNotice target={actingAs} /> : null}
      {/* The period and what to do with it, in one strip. A rule closes the
          strip so the report below reads as the document, not as more settings. */}
      <View style={styles.toolbar}>
        <View style={styles.dateField}>
          <MetroField
            label="Start date"
            value={start}
            onChangeText={setStart}
            placeholder="2025-01-31"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading && !running}
          />
        </View>
        <View style={styles.dateField}>
          <MetroField
            label="End date"
            value={end}
            onChangeText={setEnd}
            placeholder="2025-09-30"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading && !running}
          />
        </View>
        <View style={styles.toolbarActions}>
          <MetroButton label="Run report" onPress={run} loading={running} disabled={loading} />
          <MetroButton
            label={Platform.OS === 'web' ? 'Download PDF' : 'Share PDF'}
            variant="ghost"
            onPress={print}
            loading={printing}
            disabled={!report}
          />
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: theme.border }} />

      {error ? (
        <MetroBanner message={error} onDismiss={() => setError(null)} />
      ) : notice ? (
        <MetroBanner message={notice} tone="success" onDismiss={() => setNotice(null)} />
      ) : null}

      {loading ? (
        <MetroLoading label={`Building the ${REPORT_TITLES[kind].toLowerCase()}`} />
      ) : null}

      {report && !loading
        ? report.tables.map((table, index) => (
            <ReportTableView key={`${table.title ?? 'table'}-${index}`} table={table} />
          ))
        : null}

      {report && !loading && report.tables.length === 0 ? (
        <MetroEmpty
          title="Nothing to report"
          message="QuickBooks has no figures for this property in that period. Try a wider window."
        />
      ) : null}

      {report && !loading ? (
        <View style={[styles.footnote, { borderTopColor: theme.border }]}>
          <Text style={[styles.footnoteLabel, { color: theme.textDim }]}>QUICKBOOKS ONLINE</Text>
          <Text style={[styles.footnoteText, { color: theme.textDim }]}>
            {`Generated ${new Date(report.generatedAt).toLocaleString()} · ${report.company}`}
          </Text>
        </View>
      ) : null}
    </MetroScreen>
  );
}

/**
 * One table of a report.
 *
 * Label on the left, one right-aligned column per value. Budget vs Actuals has
 * four, which is wider than a phone: the table scrolls sideways while the label
 * column stays readable at the left of each row. Rows carry hairlines and the
 * figures carry tabular digits, so the columns read as a statement rather than a
 * grid of boxes — and a total closes its table with a rule instead of a fill.
 */
function ReportTableView({ table }: { table: ReportTable }) {
  const theme = useMetro();
  const wide = table.columns.length > 1;

  return (
    <View style={styles.tableBlock}>
      {table.title ? <MetroLabel>{table.title}</MetroLabel> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridScroll}>
        <View style={[styles.grid, { minWidth: wide ? 560 : 360 }]}>
          <View style={[styles.headerRow, { borderBottomColor: theme.text }]}>
            <Text style={[styles.headerCell, styles.labelCell, { color: theme.textDim }]} />
            {table.columns.map((column) => (
              <Text
                key={column}
                style={[styles.headerCell, styles.valueCell, styles.number, { color: theme.textDim }]}>
                {column}
              </Text>
            ))}
          </View>

          {table.rows.map((row, index) => {
            const weight = row.emphasis ? 700 : 500;
            const final = row.emphasis === 'final';

            return (
              <View
                key={`${row.label}-${index}`}
                style={[
                  styles.row,
                  {
                    borderTopWidth: row.emphasis ? 1 : 0,
                    borderTopColor: theme.text,
                    borderBottomWidth: final ? 2 : 1,
                    borderBottomColor: final ? theme.text : theme.border,
                  },
                ]}>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.labelCell,
                    styles.cellText,
                    {
                      color: theme.text,
                      fontWeight: weight,
                      paddingLeft: 8 + (row.level ?? 0) * 14,
                    },
                  ]}>
                  {row.label}
                </Text>
                {row.values.map((value, columnIndex) => (
                  <Text
                    key={`${row.label}-${columnIndex}`}
                    numberOfLines={1}
                    style={[
                      styles.valueCell,
                      styles.cellText,
                      styles.number,
                      styles.numbers,
                      { color: theme.text, fontWeight: weight },
                    ]}>
                    {value}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  dateField: {
    width: 158,
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginLeft: 'auto',
  },
  tableBlock: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  gridScroll: {
    flexGrow: 1,
  },
  grid: {
    flex: 1,
    width: '100%',
    // A statement is read left to right: past this the label and its amount are
    // so far apart that the eye has to travel to pair them.
    maxWidth: 900,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
  },
  headerCell: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    paddingVertical: 6,
  },
  labelCell: {
    flex: 1,
    minWidth: 168,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  valueCell: {
    width: 112,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cellText: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  number: {
    textAlign: 'right',
  },
  /** Fixed-width digits so a column of money lines up. */
  numbers: {
    fontVariant: ['tabular-nums'],
  },
  footnote: {
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    gap: 2,
  },
  footnoteLabel: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  footnoteText: {
    fontSize: 11,
    lineHeight: 16,
  },
});
