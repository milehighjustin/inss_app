import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  MetroBanner,
  MetroBoardPage,
  MetroButton,
  MetroError,
  MetroList,
  MetroListArea,
  MetroListRow,
  MetroLoading,
} from '@/components/metro';
import { listIntegrations, type IntegrationSummary } from '@/lib/admin/integrations';
import { AdminPivot } from './admin-pivot';

/**
 * Admin → Integrations.
 *
 * A list, not a page of panels. Each integration is its own thing — its own
 * credentials, its own failure modes, its own page — so the section opens with
 * what is connected and lets each connection be opened. QuickBooks and PDK have
 * nothing to say to each other, and stacking them on one screen made the section
 * read as a QuickBooks screen with a stranger at the bottom.
 *
 * The rows are read live: this page exists to answer "does it work", so a cached
 * answer would be the one thing it must not show.
 */
export function IntegrationsAdmin() {
  const [rows, setRows] = useState<IntegrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (mode: 'load' | 'refresh') => {
    if (mode === 'load') setLoading(true);
    else setRefreshing(true);

    try {
      setRows(await listIntegrations());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read the integrations');
    } finally {
      if (mode === 'load') setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('load');
  }, [load]);

  const connected = rows.filter((row) => row.connected).length;

  return (
    <MetroBoardPage
      eyebrow="Admin"
      title="Integrations"
      subtitle="What this app is connected to, and what each connection can see."
      width="wide"
      action={
        <MetroButton
          label="Check all"
          variant="ghost"
          loading={refreshing}
          onPress={() => void load('refresh')}
        />
      }>
      <AdminPivot />

      {notice ? (
        <MetroBanner tone="success" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <MetroListArea>
        {loading ? (
          <MetroLoading label="Checking the connections" />
        ) : error ? (
          <MetroError message={error} onRetry={() => void load('load')} />
        ) : (
          <MetroList title={`${connected} of ${rows.length} connected`}>
            {rows.map((row) => (
              <MetroListRow
                key={row.id}
                title={row.name}
                subtitle={row.needsAttention ?? row.summary}
                value={row.detail ?? undefined}
                badge={
                  row.connected
                    ? { label: 'Connected', tone: 'accent' }
                    : row.needsAttention
                      ? { label: 'Needs attention', tone: 'danger' }
                      : { label: 'Not connected', tone: 'neutral' }
                }
                onPress={() => router.navigate(`/admin/integrations/${row.id}` as Href)}
              />
            ))}
          </MetroList>
        )}
      </MetroListArea>
    </MetroBoardPage>
  );
}
