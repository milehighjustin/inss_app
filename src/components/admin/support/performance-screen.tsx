import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroBoardPage,
  MetroBoard,
  MetroEmpty,
  MetroStatLine,
  MetroList,
  MetroListRow,
  MetroListArea,
  MetroLoading,
  MetroPane,
  MetroPivot,
  MetroSection,
  useBoard,
  useMetro,
  type MetroFigure,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import {
  fetchPerformance,
  formatDuration,
  formatRate,
  type PerformanceReport,
} from '@/lib/admin/performance';
import { roleLabel } from '@/lib/auth/roles';
import { AdminPivot } from '../admin-pivot';
import { AdminSupportPivot } from './support-pivot';

/**
 * Admin → Support → Performance.
 *
 * The question this answers is not "how many alerts did we send" — the
 * notification log already does that — but "is the desk covered, and who is
 * quick". So the headline is answered ÷ offered and the median time it took,
 * not a count: a code that nobody answers is worse than a code nobody scans.
 *
 * `held` is deliberately its own number. An alert held because the person who
 * should have got it was already on a call is not a missed alert, and collapsing
 * the two would make a busy day look like a careless one.
 *
 * A person row opens their sessions, which is how a weak answer rate becomes a
 * shift you can look at rather than a number you can only suspect.
 */

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

export function SupportPerformanceScreen() {
  const theme = useMetro();
  const board = useBoard();
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

  const peopleSection = (
    <MetroSection
      title="People"
      hint="Everyone the alerts reached, busiest first. Open a person for their numbers.">
      {!report || report.people.length === 0 ? (
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
              onPress={() =>
                router.push({
                  pathname: '/admin/support/user/[userId]',
                  params: { userId: person.userId, name: person.name },
                })
              }
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
  );

  const propertiesSection = (
    <MetroSection title="Properties" hint="Alerts by where the sign is, busiest first.">
      {!report || report.locations.length === 0 ? (
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

      <Text style={[styles.footnote, { color: theme.textDim }]}>
        Held alerts rang after the call ended, so they are counted separately from missed ones.
        Response time is measured from the moment an alert rang to the moment it was answered.
      </Text>
    </MetroSection>
  );

  return (
    <MetroBoardPage
      eyebrow="Admin"
      title="Support"
      subtitle="Whether the desk answers, how fast, and what the calls add up to."
      width="wide">
      <AdminPivot />
      <AdminSupportPivot />

      <MetroPivot tabs={RANGES} value={days} onChange={setDays} />

      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading && !report ? (
        <MetroLoading label="Reading the log" />
      ) : !report ? null : (
        <>
          <MetroStatLine figures={figures} />

          {board ? (
            <MetroBoard>
              <MetroListArea grow={1.6}>{peopleSection}</MetroListArea>
              <MetroListArea grow={1}>{propertiesSection}</MetroListArea>
            </MetroBoard>
          ) : (
            <>
              {peopleSection}
              {propertiesSection}
            </>
          )}
        </>
      )}
    </MetroBoardPage>
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
