import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  MetroBanner,
  MetroBoard,
  MetroButton,
  MetroEmpty,
  MetroFigures,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroPane,
  MetroScreen,
  MetroSection,
  type MetroFigure,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import { formatDuration, formatRate } from '@/lib/admin/performance';
import { SESSION_STAFF_ROLES, hasAnyRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/session';
import {
  ageLabel,
  claimAlert,
  elapsedSeconds,
  endSession,
  fetchActiveSessions,
  fetchDeskAlerts,
  fetchMySession,
  startSession,
  type DeskAlert,
  type SupportSession,
} from '@/lib/support/sessions';
import { SupportPivot } from './support-pivot';

/**
 * Support → Session: the desk.
 *
 * **Wide screens do not scroll the page.** A supervisor is watching this on a
 * desktop or an iPad in a stand, and a page that scrolls means the alerts at the
 * bottom are invisible until somebody drags — exactly the alerts that matter.
 * So above `BOARD_WIDTH` the page is fixed and each pane scrolls inside itself;
 * on a phone, where there is genuinely no room, it stacks and scrolls as usual.
 *
 * **The board is the working area.** "Recent alerts" lists what was addressed to
 * this person's tags in the last two hours and what became of each, because an
 * alert raised at 07:58 belongs to the person starting at 08:00 — the visitor may
 * still be at the sign. Accepting one records the answer against them; nothing is
 * re-sent and nothing rings twice.
 *
 * The headline figure is still the status: whether alerts will arrive at all is
 * the one thing this screen must never be ambiguous about.
 */

/** Above this, the page itself stops scrolling and the panes do. */
const BOARD_WIDTH = 900;

/** Three readable columns need more than a two-column width. */
const THREE_PANE_WIDTH = 1180;

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

/** What the row says became of the alert. */
function alertState(alert: DeskAlert): string {
  if (alert.mine === 'answered') return 'You answered';
  if (alert.mine === 'ignored') return 'You ignored it';
  if (alert.outcome === 'answered') return `Answered by ${alert.answeredBy ?? 'someone'}`;
  if (alert.outcome === 'ignored') return 'Ignored, still open to take';
  return 'Nobody has answered';
}

export function SupportSessionScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const staff = hasAnyRole(user?.roles, SESSION_STAFF_ROLES);

  const board = width >= BOARD_WIDTH;
  const threePanes = staff && width >= THREE_PANE_WIDTH;

  const [session, setSession] = useState<SupportSession | null>(null);
  const [active, setActive] = useState<SupportSession[]>([]);
  const [alerts, setAlerts] = useState<DeskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const now = useNow(session?.active === true);

  /** Everything this screen reads, in one round trip each. */
  const pull = useCallback(async () => {
    const [mine, boardAlerts, onNow] = await Promise.all([
      fetchMySession(),
      fetchDeskAlerts(),
      staff ? fetchActiveSessions() : Promise.resolve([] as SupportSession[]),
    ]);

    setSession(mine);
    setAlerts(boardAlerts);
    setActive(onNow);
  }, [staff]);

  const load = useCallback(async () => {
    try {
      await pull();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the desk');
    } finally {
      setLoading(false);
    }
  }, [pull]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await pull();
      setError(null);
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not refresh the desk',
      });
    } finally {
      setRefreshing(false);
    }
  };

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
      await pull();
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
      await pull();
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not end the session',
      });
    } finally {
      setBusy(false);
    }
  };

  const accept = async (alert: DeskAlert) => {
    setClaiming(alert.notificationId);
    setNotice(null);

    try {
      const claimed = await claimAlert(alert.notificationId);
      setAlerts((current) =>
        current.map((row) =>
          row.notificationId === claimed.notificationId ? claimed : row,
        ),
      );
      setNotice({
        tone: 'success',
        message: `You took “${claimed.title}”. The response time is counted from when it rang, not from now.`,
      });
      // The shift's numbers just changed; read them again rather than guess.
      await pull();
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not take that alert',
      });
    } finally {
      setClaiming(null);
    }
  };

  const onDuty = session?.active === true;
  const clock = session
    ? onDuty
      ? elapsedSeconds(session.startedAt, now)
      : session.durationSeconds
    : 0;
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

  const shiftSection = (
    <MetroSection
      title="Your session"
      hint={
        onDuty
          ? 'End the session when you leave the desk — that is what stops the alerts.'
          : 'Start a session to be told about the signs your tags cover.'
      }>
      {session ? (
        <MetroList>
          <MetroListRow
            title={onDuty ? 'Session open' : 'Session ended'}
            subtitle={[
              `Started ${new Date(session.startedAt).toLocaleTimeString()}`,
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
    </MetroSection>
  );

  const alertsSection = (
    <MetroSection
      title="Recent alerts"
      hint="Addressed to your tags in the last two hours. Take one that nobody has answered — even if it rang before your shift."
      accessory={
        <MetroButton
          label="Refresh"
          size="compact"
          variant="ghost"
          loading={refreshing}
          onPress={() => void refresh()}
        />
      }>
      {alerts.length === 0 ? (
        <MetroEmpty
          title="Nothing recent"
          message="No alert addressed to your tags has been raised in the last two hours."
        />
      ) : (
        <MetroList>
          {alerts.map((alert) => (
            <MetroListRow
              key={alert.notificationId}
              title={alert.title}
              subtitle={[alertState(alert), ageLabel(alert.ageSeconds)]
                .filter(Boolean)
                .join(' · ')}
              badge={
                alert.outcome === 'open'
                  ? { label: 'Open', tone: 'accent' as const }
                  : alert.outcome === 'ignored'
                    ? { label: 'Ignored', tone: 'danger' as const }
                    : undefined
              }
              emphasis
              accessory={
                alert.canAccept ? (
                  <MetroButton
                    label="Accept"
                    size="compact"
                    loading={claiming === alert.notificationId}
                    onPress={() => void accept(alert)}
                  />
                ) : undefined
              }
            />
          ))}
        </MetroList>
      )}
    </MetroSection>
  );

  const numbersSection = (
    <MetroSection title="This session" hint="What happened while the clock was running.">
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
            subtitle={`${metrics.answered} answered · ${metrics.ignored} ignored · ${metrics.held} held`}
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
  );

  const teamSection = (
    <MetroSection
      title="On now"
      hint="Everyone with a session open, longest first."
      accessory={
        <MetroButton
          label="Refresh"
          size="compact"
          variant="ghost"
          loading={refreshing}
          onPress={() => void refresh()}
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
  );

  const banners = (
    <>
      {notice ? (
        <MetroBanner message={notice.message} tone={notice.tone} onDismiss={() => setNotice(null)} />
      ) : null}
      {error ? <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} /> : null}
    </>
  );

  // A phone has no width to spend: one column, page scrolls. Everything else is
  // a fixed board whose panes scroll, so the alerts stay on screen.
  if (!board) {
    return (
      <MetroScreen
        eyebrow="Support"
        title="Session"
        subtitle="Your shift on the desk. Alerts only come to you while a session is open."
        width="wide"
        onRefresh={() => void refresh()}
        refreshing={refreshing}>
        <SupportPivot />

        {banners}

        {loading ? (
          <MetroLoading label="Checking your session" />
        ) : (
          <>
            <MetroFigures figures={figures} size="medium" />
            {shiftSection}
            {alertsSection}
            {numbersSection}
            {staff ? teamSection : null}
          </>
        )}
      </MetroScreen>
    );
  }

  return (
    <MetroScreen
      eyebrow="Support"
      title="Session"
      width="wide"
      scroll={false}
      padding="compact"
      contentStyle={styles.boardContent}>
      <SupportPivot />

      {banners}

      {loading ? (
        <MetroLoading label="Checking your session" />
      ) : (
        <>
          <MetroFigures figures={figures} size="medium" />

          <MetroBoard>
            {threePanes ? (
              <>
                <MetroPane grow={1}>
                  {shiftSection}
                  {numbersSection}
                </MetroPane>
                <MetroPane grow={1.6}>{alertsSection}</MetroPane>
                <MetroPane grow={1}>{teamSection}</MetroPane>
              </>
            ) : (
              <>
                <MetroPane grow={1.6}>{alertsSection}</MetroPane>
                <MetroPane grow={1}>
                  {shiftSection}
                  {numbersSection}
                  {staff ? teamSection : null}
                </MetroPane>
              </>
            )}
          </MetroBoard>
        </>
      )}
    </MetroScreen>
  );
}

const styles = StyleSheet.create({
  boardContent: {
    flex: 1,
    gap: Spacing.three,
  },
  action: {
    flexDirection: 'row',
    marginTop: Spacing.one,
  },
});
