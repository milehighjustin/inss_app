import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  MetroBanner,
  MetroBoard,
  MetroButton,
  MetroEmpty,
  MetroError,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroPane,
  MetroScreen,
  MetroSection,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import { formatDuration, formatRate } from '@/lib/admin/performance';
import {
  endReasonLabel,
  fetchActiveSessions,
  fetchSessions,
  type SupportSession,
} from '@/lib/support/sessions';
import { SupportPivot } from './support-pivot';

/**
 * Support → Sessions: the desk's view of every shift.
 *
 * Two lists, deliberately not one: "who is on now" is a question about this
 * second, while the history is a record that does not change while you read it.
 *
 * Wide screens get both at once — on now on the left, history on the right — and
 * the page does not scroll; each list scrolls inside its own pane. A phone
 * stacks them, because there is no second column to put anything in.
 *
 * `?userId=` narrows the history to one person, which is how the performance
 * report drills into the sessions behind a weak answer rate.
 */

/** Above this the panes sit side by side; below it the page stacks and scrolls. */
const BOARD_WIDTH = 900;

function when(session: SupportSession): string {
  const start = new Date(session.startedAt);
  if (Number.isNaN(start.getTime())) return '';
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

export function SessionsScreen() {
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ userId?: string; name?: string }>();

  const userId = typeof params.userId === 'string' && params.userId ? params.userId : undefined;
  const personName = typeof params.name === 'string' && params.name ? params.name : undefined;
  const board = width >= BOARD_WIDTH;

  const [active, setActive] = useState<SupportSession[]>([]);
  const [history, setHistory] = useState<SupportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      const [onNow, past] = await Promise.all([
        fetchActiveSessions(),
        fetchSessions({ ...(userId ? { userId } : {}), limit: 25 }),
      ]);
      setActive(onNow);
      setHistory(past);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load sessions');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onNowSection = (
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
          message="No support account has a session open, so alerts addressed to the group are being held."
        />
      ) : (
        <MetroList>
          {active.map((row) => (
            <MetroListRow
              key={row.sessionId}
              title={row.name}
              subtitle={`On for ${formatDuration(row.durationSeconds)} · ${formatRate(row.metrics.answerRate)} answered`}
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

  const historySection = (
    <MetroSection
      title={personName ? 'Their sessions' : 'Recent sessions'}
      hint="Newest first. Open one for its numbers, or the person's for their shift history.">
      {history.length === 0 ? (
        <MetroEmpty
          title="No sessions yet"
          message="A session appears here as soon as a support account starts one."
        />
      ) : (
        <MetroList>
          {history.map((row) => (
            <MetroListRow
              key={row.sessionId}
              title={row.name}
              subtitle={[
                when(row),
                formatDuration(row.durationSeconds),
                `${row.metrics.answered} of ${row.metrics.offered} answered`,
                row.metrics.clicked > 0 ? `${row.metrics.clicked} clicked` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
              badge={row.active ? { label: 'On duty', tone: 'accent' as const } : undefined}
              value={row.active ? 'now' : endReasonLabel(row.endedReason)}
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
      {error ? <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} /> : null}
      {personName ? (
        <View style={styles.filterNote}>
          <MetroButton
            label="Show everyone"
            variant="ghost"
            size="compact"
            onPress={() => router.navigate('/support/sessions')}
          />
        </View>
      ) : null}
    </>
  );

  if (!board) {
    return (
      <MetroScreen
        eyebrow="Support"
        title={personName ?? 'Sessions'}
        subtitle={
          personName
            ? 'Every shift this person has worked, newest first.'
            : 'Who is on now, and what each shift came to.'
        }
        width="wide"
        onRefresh={() => void refresh()}
        refreshing={refreshing}
        action={
          <MetroButton
            label="Refresh"
            size="compact"
            variant="ghost"
            onPress={() => void refresh()}
          />
        }>
        <SupportPivot />
        {banners}
        {loading ? (
          <MetroLoading label="Loading sessions" />
        ) : error && history.length === 0 ? (
          <MetroError message={error} onRetry={() => void load()} />
        ) : (
          <>
            {onNowSection}
            {historySection}
          </>
        )}
      </MetroScreen>
    );
  }

  return (
    <MetroScreen
      eyebrow="Support"
      title={personName ?? 'Sessions'}
      width="wide"
      scroll={false}
      padding="compact"
      contentStyle={styles.boardContent}>
      <SupportPivot />
      {banners}

      {loading ? (
        <MetroLoading label="Loading sessions" />
      ) : error && history.length === 0 ? (
        <MetroError message={error} onRetry={() => void load()} />
      ) : (
        <MetroBoard>
          <MetroPane grow={1}>{onNowSection}</MetroPane>
          <MetroPane grow={1.8}>{historySection}</MetroPane>
        </MetroBoard>
      )}
    </MetroScreen>
  );
}

const styles = StyleSheet.create({
  boardContent: {
    flex: 1,
    gap: Spacing.three,
  },
  filterNote: {
    flexDirection: 'row',
  },
});
