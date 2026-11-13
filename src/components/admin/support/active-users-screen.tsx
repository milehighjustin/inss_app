import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

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
} from '@/components/metro';
import { formatRate } from '@/lib/admin/performance';
import { elapsedSeconds, fetchActiveSessions, type SupportSession } from '@/lib/support/sessions';
import { AdminPivot } from '../admin-pivot';
import { AdminSupportPivot } from './support-pivot';

/**
 * Admin → Support → Active Users.
 *
 * One list, in one glance: who has a session open, how long they have been on,
 * and what share of the alerts offered to them they have answered *so far*. That
 * last one is the reason the list exists — a person can be on duty and still be
 * letting the desk ring — and it is live rather than a report, because the answer
 * to "is the desk covered" changes while you look at it.
 *
 * The clock ticks on the device: the server says how long the shift had run when
 * the list was read, and the row counts on from the start time between reads.
 */
export function SupportActiveUsersScreen() {
  const [rows, setRows] = useState<SupportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = useNow(rows.length > 0);

  const load = useCallback(async (mode: 'load' | 'refresh') => {
    if (mode === 'load') setLoading(true);
    else setRefreshing(true);

    try {
      setRows(await fetchActiveSessions());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read who is on duty');
    } finally {
      if (mode === 'load') setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('load');
  }, [load]);

  return (
    <MetroBoardPage
      eyebrow="Admin"
      title="Support"
      subtitle="Who is on the desk right now, how long they have been on, and how much of what was offered to them they answered."
      width="wide"
      action={
        <MetroButton
          label="Refresh"
          variant="ghost"
          loading={refreshing}
          onPress={() => void load('refresh')}
        />
      }>
      <AdminPivot />
      <AdminSupportPivot />

      {error ? (
        <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} />
      ) : null}

      <MetroListArea>
        {loading ? (
          <MetroLoading label="Reading the desk" />
        ) : error && rows.length === 0 ? (
          <MetroError message={error} onRetry={() => void load('load')} />
        ) : rows.length === 0 ? (
          <MetroEmpty
            title="Nobody is on duty"
            message="No support account has a session open. Alerts addressed to the group are being held until somebody starts one."
          />
        ) : (
          <MetroList title={`${rows.length} on duty`}>
            {rows.map((row) => (
              <MetroListRow
                key={row.sessionId}
                title={row.name}
                subtitle={[
                  `On for ${shortDuration(elapsedSeconds(row.startedAt, now))}`,
                  `${row.metrics.answered} of ${row.metrics.offered} answered`,
                  row.metrics.held > 0 ? `${row.metrics.held} held` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                value={formatRate(row.metrics.answerRate)}
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
        )}
      </MetroListArea>
    </MetroBoardPage>
  );
}

/** `3h 12m`, `42m`, `18s` — a shift length, without the seconds once there are minutes. */
function shortDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** A clock for the on-duty counters. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [active]);

  return now;
}
