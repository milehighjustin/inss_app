import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroEmpty,
  MetroFigures,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroScreen,
  MetroSection,
  useMetro,
  type MetroFigure,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import { formatDuration, formatRate } from '@/lib/admin/performance';
import { SESSION_STAFF_ROLES, hasAnyRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/session';
import {
  elapsedSeconds,
  endSession,
  fetchActiveSessions,
  fetchMySession,
  startSession,
  type SupportSession,
} from '@/lib/support/sessions';
import { SupportPivot } from './support-pivot';

/**
 * Support → Session: the person's own shift.
 *
 * The one thing this screen has to be unambiguous about is whether alerts will
 * arrive. So the headline figure is the status, not a count, and the button is
 * either "Start" or "End" — never both, and never a toggle that looks the same in
 * two states.
 *
 * Starting a session is what turns delivery on, and it is the only thing that
 * does: the server reads the open session, not the app. Closing the app, losing
 * signal or ignoring the phone does not end a shift; pressing End does.
 *
 * Numbers on the right are the shift's own, cut from the same activity log the
 * performance report reads. The clock ticks locally so an open shift counts up
 * between refreshes.
 */

/** A clock that only runs while the shift is open. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  return now;
}

export function SupportSessionScreen() {
  const theme = useMetro();
  const { user } = useAuth();
  const staff = hasAnyRole(user?.roles, SESSION_STAFF_ROLES);

  const [session, setSession] = useState<SupportSession | null>(null);
  const [active, setActive] = useState<SupportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const now = useNow(session?.active === true);

  const refreshActive = useCallback(async () => {
    if (!staff) return;

    setRefreshing(true);
    try {
      setActive(await fetchActiveSessions());
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not refresh who is on duty',
      });
    } finally {
      setRefreshing(false);
    }
  }, [staff]);

  const load = useCallback(async () => {
    setError(null);

    try {
      setSession(await fetchMySession());
      if (staff) setActive(await fetchActiveSessions());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your session');
    } finally {
      setLoading(false);
    }
  }, [staff]);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    setBusy(true);
    setNotice(null);

    try {
      const result = await startSession();
      setSession(result.session);
      setNotice({
        tone: 'success',
        message: result.replaced
          ? 'You are on duty. The earlier session was closed and this one carries the numbers from here.'
          : 'You are on duty. Alerts addressed to your tags will come through until you end the session.',
      });
      await refreshActive();
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not start a session',
      });
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setNotice(null);

    try {
      const ended = await endSession();
      setSession(null);
      setNotice({
        tone: 'info',
        message: ended
          ? `Session ended after ${formatDuration(ended.durationSeconds)}. You will not hear alerts until you start another.`
          : 'There was no session open.',
      });
      await refreshActive();
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not end the session',
      });
    } finally {
      setBusy(false);
    }
  };

  const onDuty = session?.active === true;
  const clock = session ? (onDuty ? elapsedSeconds(session.startedAt, now) : session.durationSeconds) : 0;
  const metrics = session?.metrics;

  const figures: MetroFigure[] = [
    {
      label: 'Status',
      value: onDuty ? 'On duty' : 'Off duty',
      hint: onDuty ? 'Alerts are reaching this account' : 'Alerts are held until you start',
      ...(onDuty ? { tone: 'accent' as const } : {}),
    },
    {
      label: onDuty ? 'On the clock' : 'Last session',
      value: formatDuration(session ? clock : null),
      hint: session ? `Since ${new Date(session.startedAt).toLocaleTimeString()}` : 'No session yet',
    },
    {
      label: 'Answered',
      value: formatRate(metrics?.answerRate ?? null),
      hint: metrics ? `${metrics.answered} of ${metrics.offered} offered` : 'Nothing offered yet',
    },
    {
      label: 'Alerts received',
      value: String(metrics?.notifications ?? 0),
      hint: metrics ? `${metrics.clicked} clicked` : 'Nothing sent to you yet',
    },
  ];

  return (
    <MetroScreen
      eyebrow="Support"
      title="Session"
      subtitle="Your shift on the desk. Alerts only come to you while a session is open."
      width="wide"
      onRefresh={() => void load()}>
      <SupportPivot />

      {notice ? (
        <MetroBanner message={notice.message} tone={notice.tone} onDismiss={() => setNotice(null)} />
      ) : null}

      {error ? <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <MetroLoading label="Checking your session" />
      ) : (
        <>
          <MetroFigures figures={figures} size="medium" />

          <MetroSection
            title="Your session"
            hint={
              onDuty
                ? 'Everyone this account’s tags address is coming to this device. End the session when you leave the desk.'
                : 'Start a session to be told about the signs your tags cover. Until then the desk is covered by whoever is on.'
            }>
            {session ? (
              <MetroList>
                <MetroListRow
                  title={onDuty ? 'Session open' : 'Session ended'}
                  subtitle={[
                    `Started ${new Date(session.startedAt).toLocaleString()}`,
                    session.endedAt ? `Ended ${new Date(session.endedAt).toLocaleString()}` : '',
                    session.tags.length ? `Tags: ${session.tags.join(', ')}` : 'No tags on this account',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  value={formatDuration(clock)}
                  emphasis
                />
              </MetroList>
            ) : null}

            <View style={styles.action}>
              <MetroButton
                label={onDuty ? 'End session' : session ? 'Start a new session' : 'Start a session'}
                loading={busy}
                variant={onDuty ? 'ghost' : 'primary'}
                color={onDuty ? 'danger' : 'accent'}
                onPress={() => void (onDuty ? stop() : start())}
              />
            </View>

            {onDuty ? (
              <Text style={[styles.note, { color: theme.textDim }]}>
                Ending a session stops the alerts. The numbers stay with it, so a supervisor can still
                read the shift.
              </Text>
            ) : null}
          </MetroSection>

          <MetroSection
            title="This session"
            hint="What happened while the clock was running."
            accessory={
              <MetroButton label="Refresh" size="compact" variant="ghost" onPress={() => void load()} />
            }>
            {!metrics || metrics.notifications === 0 ? (
              <MetroEmpty
                title="Nothing yet"
                message={
                  onDuty
                    ? 'No alert addressed to your tags has reached you since this session began.'
                    : 'Start a session and the alerts your tags cover will be counted here.'
                }
              />
            ) : (
              <MetroList>
                <MetroListRow
                  title="Alerts received"
                  subtitle={`${metrics.answered} answered · ${metrics.ignored} ignored · ${metrics.held} held during calls`}
                  value={String(metrics.notifications)}
                  emphasis
                />
                <MetroListRow
                  title="Median answer"
                  subtitle="From ringing to answered"
                  value={formatDuration(metrics.medianAnswerSeconds)}
                  emphasis
                />
                <MetroListRow
                  title="Missed"
                  subtitle="Offered, never answered or ignored"
                  value={String(metrics.missed)}
                  emphasis
                />
                <MetroListRow
                  title="Video calls"
                  subtitle={`${formatDuration(metrics.talkSeconds)} on the line`}
                  value={String(metrics.calls)}
                  emphasis
                />
              </MetroList>
            )}
          </MetroSection>

          {staff ? (
            <MetroSection
              title="On now"
              hint="Everyone with a session open, longest first. Refresh to see it as it is."
              accessory={
                <MetroButton
                  label="Refresh"
                  size="compact"
                  variant="ghost"
                  loading={refreshing}
                  onPress={() => void refreshActive()}
                />
              }>
              {active.length === 0 ? (
                <MetroEmpty
                  title="Nobody is on duty"
                  message="No support account has a session open. Alerts addressed to the group are being held."
                />
              ) : (
                <MetroList>
                  {active.map((row) => (
                    <MetroListRow
                      key={row.sessionId}
                      title={row.name}
                      subtitle={`On for ${formatDuration(row.durationSeconds)} · ${row.metrics.answered} of ${row.metrics.offered} answered`}
                      value={`${row.metrics.notifications} alerts`}
                      emphasis
                      onPress={() =>
                        router.push({
                          pathname: '/support/session/[sessionId]',
                          params: { sessionId: row.sessionId },
                        })
                      }
                    />
                  ))}
                </MetroList>
              )}
            </MetroSection>
          ) : null}
        </>
      )}
    </MetroScreen>
  );
}

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
    marginTop: Spacing.two,
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
  },
});
