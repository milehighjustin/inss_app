import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  MetroBanner,
  MetroBoardPage,
  MetroButton,
  MetroEmpty,
  MetroError,
  MetroList,
  MetroListArea,
  MetroListRow,
  MetroLoading,
  MetroPager,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import { formatDuration, formatRate } from '@/lib/admin/performance';
import {
  elapsedSeconds,
  endReasonLabel,
  fetchSessions,
  SESSIONS_PAGE_SIZE,
  type SessionPage,
  type SupportSession,
} from '@/lib/support/sessions';
import { AdminPivot } from '../admin-pivot';
import { AdminSupportPivot } from './support-pivot';

/**
 * Admin → Support → Sessions.
 *
 * Every shift, newest first, twenty-five to a page. Not one row per person: a
 * person can have worked four shifts this week and the question is usually about
 * one of them, so the record is the shift.
 *
 * `?userId=` narrows the list to one person, which is how the performance report
 * drills into the sessions behind a weak answer rate.
 */
export function SupportSessionsScreen() {
  const params = useLocalSearchParams<{ userId?: string; name?: string }>();
  const userId = typeof params.userId === 'string' && params.userId ? params.userId : undefined;
  const personName = typeof params.name === 'string' && params.name ? params.name : undefined;

  const [data, setData] = useState<SessionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (page: number, mode: 'load' | 'refresh' | 'page') => {
      if (mode === 'load') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'page') setPaging(true);

      try {
        setData(
          await fetchSessions({
            page,
            pageSize: SESSIONS_PAGE_SIZE,
            ...(userId ? { userId } : {}),
          }),
        );
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load sessions');
      } finally {
        if (mode === 'load') setLoading(false);
        if (mode === 'refresh') setRefreshing(false);
        if (mode === 'page') setPaging(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void load(1, 'load');
  }, [load]);

  const sessions = data?.sessions ?? [];
  const now = useNow(sessions.some((row) => row.active));

  return (
    <MetroBoardPage
      eyebrow="Admin"
      title={personName ? `${personName}’s sessions` : 'Sessions'}
      subtitle={
        personName
          ? 'Every shift this person has worked, newest first.'
          : 'Every shift on the desk, newest first, twenty-five to a page.'
      }
      width="wide"
      action={
        <MetroButton
          label="Refresh"
          variant="ghost"
          loading={refreshing}
          onPress={() => void load(data?.page ?? 1, 'refresh')}
        />
      }>
      <AdminPivot />
      <AdminSupportPivot />

      {error ? (
        <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} />
      ) : null}

      {personName ? (
        <View style={styles.filterNote}>
          <MetroButton
            label="Show everyone"
            variant="ghost"
            size="compact"
            onPress={() => router.navigate('/admin/support/sessions')}
          />
        </View>
      ) : null}

      <MetroListArea>
        {loading ? (
          <MetroLoading label="Loading sessions" />
        ) : error && sessions.length === 0 ? (
          <MetroError message={error} onRetry={() => void load(1, 'load')} />
        ) : sessions.length === 0 ? (
          <MetroEmpty
            title="No sessions yet"
            message="A session appears here as soon as a support account starts one."
          />
        ) : (
          <>
            <MetroList>
              {sessions.map((row) => (
                <MetroListRow
                  key={row.sessionId}
                  title={row.name}
                  subtitle={[
                    when(row),
                    formatDuration(
                      row.active ? elapsedSeconds(row.startedAt, now) : row.durationSeconds,
                    ),
                    `${row.metrics.answered} of ${row.metrics.offered} answered`,
                    row.metrics.notifications > 0 ? `${row.metrics.notifications} alerts` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  badge={row.active ? { label: 'On duty', tone: 'accent' as const } : undefined}
                  value={row.active ? 'now' : formatRate(row.metrics.answerRate)}
                  emphasis
                  onPress={() =>
                    router.push({
                      pathname: '/admin/support/session/[sessionId]',
                      params: { sessionId: row.sessionId },
                    })
                  }
                />
              ))}
            </MetroList>
            <MetroPager
              page={data?.page ?? 1}
              pageSize={data?.pageSize ?? SESSIONS_PAGE_SIZE}
              total={data?.total ?? 0}
              loading={paging}
              onChange={(page) => void load(page, 'page')}
            />
          </>
        )}
      </MetroListArea>
    </MetroBoardPage>
  );
}

/** A clock for the on-duty rows, so an open shift keeps counting between reads. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [active]);

  return now;
}

function when(session: SupportSession): string {
  const start = new Date(session.startedAt);
  if (Number.isNaN(start.getTime())) return '';
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

const styles = StyleSheet.create({
  filterNote: {
    flexDirection: 'row',
    marginBottom: Spacing.two,
  },
});
