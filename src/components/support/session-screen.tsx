import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroBoardPage,
  MetroButton,
  MetroEmpty,
  MetroFigures,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroPager,
  useBoard,
  useMetro,
  type MetroFigure,
} from '@/components/metro';
import { Radius, Spacing } from '@/constants/metro';
import { formatDuration, formatRate } from '@/lib/admin/performance';
import {
  ageLabel,
  alertOutcome,
  ALERTS_PAGE_SIZE,
  claimAlert,
  fetchMyAlerts,
  type AlertPage,
  type AlertRow,
} from '@/lib/support/alerts';
import {
  elapsedSeconds,
  endSession,
  fetchMySession,
  startSession,
  type SupportSession,
} from '@/lib/support/sessions';

/**
 * Support → the desk.
 *
 * **The list is the page.** An alert is what this screen is for, so it is what
 * the screen shows: every alert addressed to this person's tags, newest first,
 * twenty-five to a page, with the ones still inside their five minutes carrying
 * an Accept button. Nothing else competes with it.
 *
 * **The shift is one line of chrome.** Starting and ending it is the switch that
 * turns delivery on, so it sits at the top left with the shift's own numbers
 * beside it, filling the width they were given. There is no second list of
 * sessions and no report here: everyone's shifts and the numbers are in Admin →
 * Support, and a desk screen that also administers is a desk nobody watches.
 *
 * **Wide screens do not scroll the page.** The list scrolls inside its pane and
 * the pager stays put beneath it, because the alert that matters is usually the
 * one at the bottom of the window.
 */

export function SupportSessionScreen() {
  const theme = useMetro();
  const board = useBoard();

  const [session, setSession] = useState<SupportSession | null>(null);
  const [data, setData] = useState<AlertPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paging, setPaging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const now = useNow(session?.active === true);

  const pull = useCallback(async (wantedPage: number) => {
    const [mine, alerts] = await Promise.all([
      fetchMySession(),
      fetchMyAlerts({ page: wantedPage, pageSize: ALERTS_PAGE_SIZE }),
    ]);

    setSession(mine);
    setData(alerts);
  }, []);

  const load = useCallback(
    async (wantedPage: number, mode: 'load' | 'refresh' | 'page') => {
      if (mode === 'load') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'page') setPaging(true);

      try {
        await pull(wantedPage);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load the alerts');
      } finally {
        if (mode === 'load') setLoading(false);
        if (mode === 'refresh') setRefreshing(false);
        if (mode === 'page') setPaging(false);
      }
    },
    [pull],
  );

  useEffect(() => {
    void load(1, 'load');
  }, [load]);

  const refresh = () => load(data?.page ?? 1, 'refresh');

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
      await pull(data?.page ?? 1);
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
      await pull(data?.page ?? 1);
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not end the session',
      });
    } finally {
      setBusy(false);
    }
  };

  const accept = async (alert: AlertRow) => {
    setClaiming(alert.notificationId);
    setNotice(null);

    try {
      await claimAlert(alert.notificationId);
      setNotice({
        tone: 'success',
        message: `You took “${alert.title}”. The response time is counted from when it rang, not from now.`,
      });
      // The row, its numbers and the shift's rate all changed; read them again.
      await load(data?.page ?? 1, 'refresh');
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not take that alert',
      });
      // A refusal is usually age or someone else's answer; the list is stale.
      await load(data?.page ?? 1, 'refresh');
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

  const stats: MetroFigure[] = [
    {
      label: onDuty ? 'On the clock' : 'Last session',
      value: formatDuration(session ? clock : null),
      hint: session
        ? `${onDuty ? 'Since' : 'Started'} ${new Date(session.startedAt).toLocaleTimeString()}`
        : 'No session yet',
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

  const head = (
    <View style={[styles.head, board && styles.headRow]}>
      <MetroFigures figures={stats} size="medium" style={styles.stats} />

      <View style={[styles.shift, board && styles.shiftWide, board && styles.shiftRight]}>
        <View style={styles.statusLine}>
          <View
            style={[
              styles.dot,
              { backgroundColor: onDuty ? theme.accent : theme.border },
            ]}
          />
          <Text
            style={[styles.statusText, { color: onDuty ? theme.accent : theme.text }]}>
            {onDuty ? 'On duty' : 'Off duty'}
          </Text>
        </View>

        <Text
          style={[styles.statusHint, board && styles.rightText, { color: theme.textDim }]}>
          {onDuty
            ? 'Alerts addressed to your tags are coming through. End the session when you leave.'
            : 'Start a session to be told about the signs your tags cover.'}
        </Text>

        <MetroButton
          label={onDuty ? 'End session' : session ? 'Start a new session' : 'Start a session'}
          loading={busy}
          variant={onDuty ? 'ghost' : 'primary'}
          color={onDuty ? 'danger' : 'accent'}
          onPress={() => void (onDuty ? stop() : start())}
        />
      </View>
    </View>
  );

  const alerts = data?.alerts ?? [];

  const listBody = loading ? (
    <MetroLoading label="Reading the alerts" />
  ) : alerts.length === 0 ? (
    <MetroEmpty
      title="No alerts yet"
      message="An alert addressed to your tags appears here as soon as somebody scans a sign you cover."
    />
  ) : (
    <MetroList title="Alerts">
      {alerts.map((alert) => (
        <MetroListRow
          key={alert.notificationId}
          title={alert.title}
          subtitle={[
            alert.locationName ?? alert.qrCodeName ?? 'No place attached',
            alertOutcome(alert),
            ageLabel(alert.ageSeconds),
          ]
            .filter(Boolean)
            .join(' · ')}
          badge={
            alert.canAccept
              ? { label: 'Answerable', tone: 'accent' as const }
              : alert.action === 'answered'
                ? { label: 'Answered', tone: 'neutral' as const }
                : alert.action === 'ignored'
                  ? { label: 'Ignored', tone: 'danger' as const }
                  : alert.action === 'expired'
                    ? { label: 'Expired', tone: 'neutral' as const }
                    : undefined
          }
          value={
            alert.action === 'answered' && alert.answerSeconds != null
              ? `${alert.answerSeconds}s`
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
  );

  // The same container as the kiosk console: on a wide screen the alerts sit in
  // a framed pane that takes the height left under the shift and scrolls inside
  // it, with the scrollbar showing. The pager below never moves, so the newest
  // alert and the page control are both always where they were left.
  const list = board ? (
    <View style={[styles.listFrame, { borderColor: theme.border }]}>
      <ScrollView style={styles.listScroll} showsVerticalScrollIndicator>
        {listBody}
      </ScrollView>
    </View>
  ) : (
    <View>{listBody}</View>
  );

  return (
    <MetroBoardPage
      eyebrow="Support"
      title="Desk"
      subtitle="Every alert addressed to your tags. The ones inside five minutes can be answered here."
      width="wide"
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      action={
        <MetroButton
          label="Refresh"
          size="compact"
          variant="ghost"
          loading={refreshing}
          onPress={() => void refresh()}
        />
      }>
      {notice ? (
        <MetroBanner
          message={notice.message}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
        />
      ) : null}
      {error ? (
        <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} />
      ) : null}

      {head}

      {list}

      <View style={styles.footer}>
        <MetroPager
          page={data?.page ?? 1}
          pageSize={data?.pageSize ?? ALERTS_PAGE_SIZE}
          total={data?.total ?? 0}
          loading={paging}
          onChange={(page) => void load(page, 'page')}
        />
      </View>
    </MetroBoardPage>
  );
}

/** A clock for the on-duty figures. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  return now;
}

const styles = StyleSheet.create({
  head: {
    gap: Spacing.three,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  shift: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  shiftWide: {
    // The switch keeps a readable column; the numbers take everything else.
    width: 260,
  },
  shiftRight: {
    // The switch is the last thing on the row and sits on the right edge: the
    // numbers run from the left margin up to it. On a phone it is a plain
    // stacked block, where a full-width button is the better target.
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
  },
  statusText: {
    fontSize: 15,
    fontWeight: 600,
  },
  statusHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  rightText: {
    textAlign: 'right',
  },
  stats: {
    flex: 1,
  },
  listFrame: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
  },
  footer: {
    paddingBottom: Spacing.two,
  },
});
