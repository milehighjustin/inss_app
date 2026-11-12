import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroEmpty,
  MetroError,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroScreen,
  MetroSection,
} from '@/components/metro';
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
 * second and carries a refresh button, while the history is a record that does
 * not change while you look at it. Mixing them into one feed would make a live
 * row and a closed row look alike.
 *
 * `?userId=` narrows the history to one person, which is how the performance
 * report drills into the sessions behind a weak answer rate.
 */
function when(session: SupportSession): string {
  const start = new Date(session.startedAt);
  if (Number.isNaN(start.getTime())) return '';
  return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function SessionsScreen() {
  const params = useLocalSearchParams<{ userId?: string; name?: string }>();
  const userId = typeof params.userId === 'string' && params.userId ? params.userId : undefined;
  const personName = typeof params.name === 'string' && params.name ? params.name : undefined;

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

  return (
    <MetroScreen
      eyebrow="Support"
      title={personName ? personName : 'Sessions'}
      subtitle={
        personName
          ? 'Every shift this person has worked, newest first.'
          : 'Who is on now, and what each shift came to.'
      }
      width="wide"
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      action={<MetroButton label="Refresh" size="compact" variant="ghost" onPress={() => void refresh()} />}>
      <SupportPivot />

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

      {loading ? (
        <MetroLoading label="Loading sessions" />
      ) : error && history.length === 0 ? (
        <MetroError message={error} onRetry={() => void load()} />
      ) : (
        <>
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
                    badge={row.active ? { label: 'On duty', tone: 'accent' } : undefined}
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
        </>
      )}
    </MetroScreen>
  );
}

const styles = StyleSheet.create({
  filterNote: {
    flexDirection: 'row',
  },
});
