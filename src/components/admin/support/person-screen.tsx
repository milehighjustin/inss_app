import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroBoard,
  MetroBoardPage,
  MetroButton,
  MetroEmpty,
  MetroFigures,
  MetroList,
  MetroListArea,
  MetroListRow,
  MetroLoading,
  MetroPivot,
  MetroSection,
  useBoard,
  useMetro,
  type MetroFigure,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import {
  fetchPersonReport,
  ordinal,
  averageCount,
  type PersonDayRow,
  type PersonReport,
} from '@/lib/admin/people';
import { formatDuration, formatRate } from '@/lib/admin/performance';
import { roleLabel } from '@/lib/auth/roles';
import { AdminPivot } from '../admin-pivot';
import { AdminSupportPivot } from './support-pivot';

/**
 * Admin → Support → one person.
 *
 * The question is not "how many alerts were sent" but "is this person doing the
 * job, and how do they compare" — so the page is the person's whole record over a
 * window, and the same numbers for the people beside them. Answer rate is the
 * headline because a desk that lets the phone ring is the failure that matters;
 * the median time is the second, because an answered alert that took four minutes
 * still left someone standing at a sign.
 *
 * **By day.** The window is cut into calendar days, quiet ones included: three
 * days of silence and one busy Friday is a different story from a steady week,
 * and only the day view shows it.
 *
 * **Against the team.** Peer averages are per person, not totals, so a colleague
 * who took two hundred alerts does not set the bar for everyone else. The rank is
 * over answer rate, and only counts people who were actually offered an alert.
 *
 * Shifts carry their own number — time on duty — because a person with a good
 * rate over four hours and one with the same rate over forty are not the same.
 */

const RANGES = [
  { value: '1', label: 'Today' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

export function SupportPersonScreen({
  userId,
  name,
}: {
  userId: string;
  name?: string;
}) {
  const theme = useMetro();
  const board = useBoard();

  const [days, setDays] = useState('30');
  const [report, setReport] = useState<PersonReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: string) => {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchPersonReport(userId, Number(range)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this person’s numbers');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const personName = report?.person.name ?? name ?? 'This person';
  const activity = report?.person.activity;
  const shifts = report?.shifts;
  const team = report?.team;

  const figures: MetroFigure[] = [
    {
      label: 'Answered',
      value: formatRate(activity?.answerRate ?? null),
      hint: activity ? `${activity.answered} of ${activity.offered} offered` : undefined,
    },
    {
      label: 'Median answer',
      value: formatDuration(activity?.medianAnswerSeconds ?? null),
      hint: 'From ringing to answered',
    },
    {
      label: 'Alerts received',
      value: String(activity?.notifications ?? 0),
      hint: activity ? `${activity.clicked} clicked` : undefined,
    },
    {
      label: 'On duty',
      value: formatDuration(shifts?.seconds ?? null),
      hint: shifts
        ? `${shifts.count} ${shifts.count === 1 ? 'shift' : 'shifts'}${shifts.active ? ' · on now' : ''}`
        : undefined,
    },
  ];

  // The window, newest first, quiet days included.
  const dayRows = useMemo<PersonDayRow[]>(() => [...(report?.daily ?? [])].reverse(), [report]);

  const dailySection = (
    <MetroSection
      title="By day"
      hint="Every day in this window, newest first. A quiet day is still a fact about the desk.">
      {loading && !report ? (
        <MetroLoading label="Reading the log" />
      ) : dayRows.length === 0 ? (
        <MetroEmpty title="No days yet" message="Pick a wider window to see this person's days." />
      ) : (
        <MetroList>
          {dayRows.map((day) => {
            const quiet =
              day.offered === 0 &&
              day.held === 0 &&
              day.answered === 0 &&
              day.ignored === 0 &&
              day.calls === 0;

            return (
              <MetroListRow
                key={day.date}
                title={dayLabel(day.date)}
                subtitle={
                  quiet
                    ? 'Nothing offered, nothing answered'
                    : [
                        `${day.answered} of ${day.offered} answered`,
                        day.missed > 0 ? `${day.missed} missed` : '',
                        day.held > 0 ? `${day.held} held` : '',
                        day.calls > 0
                          ? `${day.calls} ${day.calls === 1 ? 'call' : 'calls'} · ${formatDuration(day.talkSeconds)}`
                          : '',
                        `Median ${formatDuration(day.medianAnswerSeconds)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                }
                value={quiet ? undefined : formatRate(day.answerRate)}
                emphasis={!quiet}
              />
            );
          })}
        </MetroList>
      )}
    </MetroSection>
  );

  const rank = team?.rank;

  const teamSection = (
    <MetroSection
      title="Against the team"
      hint={
        team
          ? `${team.people} ${team.people === 1 ? 'person' : 'people'} in this window. Averages are per person, not totals.`
          : 'The same numbers for everyone else on the desk.'
      }>
      {!report || !activity || !team ? null : team.peers === 0 ? (
        <MetroEmpty
          title="Nobody to compare with"
          message="No other account was offered an alert in this window, so there is no team average yet."
        />
      ) : (
        <>
          <MetroList>
            <MetroListRow
              title="Answer rate"
              subtitle={`Team average ${formatRate(team.perPerson.answerRate)}`}
              value={formatRate(activity.answerRate)}
              emphasis
            />
            <MetroListRow
              title="Median answer"
              subtitle={`Desk median ${formatDuration(team.totals.medianAnswerSeconds)}`}
              value={formatDuration(activity.medianAnswerSeconds)}
              emphasis
            />
            <MetroListRow
              title="Alerts offered"
              subtitle={`Team average ${averageCount(team.perPerson.offered)}`}
              value={String(activity.offered)}
              emphasis
            />
            <MetroListRow
              title="Answered"
              subtitle={`Team average ${averageCount(team.perPerson.answered)}`}
              value={String(activity.answered)}
              emphasis
            />
            <MetroListRow
              title="Missed"
              subtitle={`Team average ${averageCount(team.perPerson.missed)}`}
              value={String(activity.missed)}
              emphasis
            />
            <MetroListRow
              title="Held during calls"
              subtitle={`Team average ${averageCount(team.perPerson.held)}`}
              value={String(activity.held)}
              emphasis
            />
            <MetroListRow
              title="Video calls"
              subtitle={`Team average ${averageCount(team.perPerson.calls)}`}
              value={String(activity.calls)}
              emphasis
            />
            <MetroListRow
              title="Time on the line"
              subtitle={`Team average ${formatDuration(team.perPerson.talkSeconds)}`}
              value={formatDuration(activity.talkSeconds)}
              emphasis
            />
          </MetroList>

          <Text style={[styles.footnote, { color: theme.textDim }]}>
            {rank && rank.answerRate !== null && rank.of > 1
              ? `${ordinal(rank.answerRate)} of ${rank.of} on answer rate in this window.`
              : 'Not ranked: no alert was offered to them in this window, so there is no rate to compare.'}
          </Text>
        </>
      )}
    </MetroSection>
  );

  return (
    <MetroBoardPage
      eyebrow="Support · Person"
      title={personName}
      subtitle={
        report
          ? [report.person.roles.map(roleLabel).join(', ') || 'No role', `${days}-day view`].join(' · ')
          : name
            ? 'Their whole record on the desk.'
            : undefined
      }
      width="wide"
      action={
        <View style={styles.actions}>
          <MetroButton
            label="Their sessions"
            variant="ghost"
            size="compact"
            onPress={() =>
              router.push({
                pathname: '/admin/support/sessions',
                params: { userId, name: personName },
              })
            }
          />
          <MetroButton
            label="Back to performance"
            variant="ghost"
            size="compact"
            onPress={() => router.navigate('/admin/support/performance')}
          />
        </View>
      }>
      <AdminPivot />
      <AdminSupportPivot />

      <MetroPivot tabs={RANGES} value={days} onChange={setDays} />

      {error ? <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} /> : null}

      {loading && !report ? (
        <MetroLoading label="Reading the log" />
      ) : !report ? null : (
        <>
          <MetroFigures figures={figures} size="medium" />

          {board ? (
            <MetroBoard>
              <MetroListArea grow={1.3}>{dailySection}</MetroListArea>
              <MetroListArea grow={1}>{teamSection}</MetroListArea>
            </MetroBoard>
          ) : (
            <>
              {dailySection}
              {teamSection}
            </>
          )}
        </>
      )}
    </MetroBoardPage>
  );
}

/** `Mon, Nov 12` from `YYYY-MM-DD`, read in UTC so the day never slips. */
function dayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.two,
  },
});
