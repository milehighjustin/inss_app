import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroEmpty,
  MetroFigures,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroPivot,
  MetroScreen,
  MetroSection,
  type MetroFigure,
} from '@/components/metro';
import { useMetro } from '@/components/metro/use-metro';
import { Spacing } from '@/constants/metro';
import {
  fetchPerformance,
  formatDuration,
  formatRate,
  type PerformanceReport,
} from '@/lib/admin/performance';
import { roleLabel } from '@/lib/admin/users';
import { AdminPivot } from './admin-pivot';

/**
 * Admin → Performance.
 *
 * The question this answers is not "how many alerts did we send" — the
 * notification log already does that — but "is the desk covered, and who is
 * quick". So the headline is answered ÷ offered and the median time it took,
 * not a count: a code that nobody answers is worse than a code nobody scans.
 *
 * `held` is deliberately its own number. An alert held because the person who
 * should have got it was already on a call is not a missed alert, and collapsing
 * the two would make a busy day look like a careless one.
 */

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

export function PerformanceScreen() {
  const theme = useMetro();
  const [days, setDays] = useState('30');
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: string) => {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchPerformance(Number(range)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load performance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const totals = report?.totals;

  const figures: MetroFigure[] = [
    {
      label: 'Answered',
      value: formatRate(totals?.answerRate ?? null),
      hint: totals ? `${totals.answered} of ${totals.offered} alerts` : undefined,
    },
    {
      label: 'Median answer',
      value: formatDuration(totals?.medianAnswerSeconds ?? null),
      hint: 'From ringing to answered',
    },
    {
      label: 'Missed',
      value: String(totals?.missed ?? 0),
      hint: totals && totals.held > 0 ? `${totals.held} held during calls` : 'Nobody answered',
      ...(totals && totals.missed > 0 ? { tone: 'danger' as const } : {}),
    },
    {
      label: 'Video calls',
      value: String(totals?.calls ?? 0),
      hint: `${formatDuration(totals?.talkSeconds ?? null)} on the line`,
    },
  ];

  return (
    <MetroScreen
      eyebrow="Admin"
      title="Performance"
      subtitle="Whether the desk answers, how fast, and what the calls add up to."
      width="wide">
      <AdminPivot />

      <MetroPivot tabs={RANGES} value={days} onChange={setDays} />

      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading && !report ? (
        <MetroLoading label="Reading the log" />
      ) : !report ? null : (
        <>
          <MetroFigures figures={figures} size="medium" />

          <MetroSection
            title="People"
            hint="Everyone the alerts reached, worst coverage first.">
            {report.people.length === 0 ? (
              <MetroEmpty
                title="Nothing yet"
                message="No alert has been offered in this window, so there is nothing to compare."
              />
            ) : (
              <MetroList>
                {report.people.map((person) => (
                  <MetroListRow
                    key={person.userId}
                    title={person.name}
                    subtitle={[
                      person.roles.map(roleLabel).join(', ') || 'No role',
                      person.calls > 0
                        ? `${person.calls} call${person.calls === 1 ? '' : 's'} · ${formatDuration(person.talkSeconds)}`
                        : 'No calls',
                      person.held > 0 ? `${person.held} held` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    emphasis
                    accessory={
                      <View style={styles.trailing}>
                        <Text style={[styles.trailingValue, { color: theme.text }]}>
                          {formatRate(person.answerRate)}
                        </Text>
                        <Text style={[styles.trailingNote, { color: theme.textDim }]}>
                          {person.answered}/{person.offered} ·{' '}
                          {formatDuration(person.medianAnswerSeconds)}
                        </Text>
                      </View>
                    }
                  />
                ))}
              </MetroList>
            )}
          </MetroSection>

          <MetroSection
            title="Properties"
            hint="Alerts by where the sign is, busiest first.">
            {report.locations.length === 0 ? (
              <MetroEmpty
                title="No place attached"
                message="No code in this window has a property yet. Attach one on the QR code and scans start counting here."
              />
            ) : (
              <MetroList>
                {report.locations.map((location) => (
                  <MetroListRow
                    key={location.locationId}
                    title={location.name}
                    subtitle={`${location.answered} of ${location.offered} answered`}
                    value={formatRate(
                      location.offered === 0 ? null : location.answered / location.offered,
                    )}
                    emphasis
                  />
                ))}
              </MetroList>
            )}
          </MetroSection>

          <Text style={[styles.footnote, { color: theme.textDim }]}>
            Held alerts rang after the call ended, so they are counted separately from missed
            ones. Response time is measured from the moment an alert rang to the moment it was
            answered.
          </Text>
        </>
      )}
    </MetroScreen>
  );
}

const styles = StyleSheet.create({
  trailing: {
    alignItems: 'flex-end',
  },
  trailingValue: {
    fontSize: 15,
    fontWeight: 600,
  },
  trailingNote: {
    fontSize: 12,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.two,
  },
});
