import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroEmpty,
  MetroError,
  MetroFigures,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroScreen,
  useMetro,
  type MetroBannerTone,
  type MetroFigure,
} from '@/components/metro';
import { MetroType, Spacing } from '@/constants/metro';
import {
  fetchQuickBooks,
  requestQuickBooksConnect,
  type IntegrationStatus,
} from '@/lib/admin/integrations';
import { AdminPivot } from './admin-pivot';

function whenLabel(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

/**
 * Admin → Integrations.
 *
 * v1's Integrations panel, which is one row that opens "Login with QuickBooks".
 * The connection is a browser errand here too — the app asks the API for Intuit's
 * authorize URL and opens it — so this screen says what is connected, whether it
 * still works, and offers to connect or renew it. It re-reads when the browser
 * window comes back, because the callback lands in that other tab.
 */
export function IntegrationsAdmin() {
  const theme = useMetro();
  const { width } = useWindowDimensions();
  const sideBySide = width >= 720;

  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: MetroBannerTone; message: string } | null>(null);

  /**
   * Re-read the status.
   *
   * `retry` is the error path and owns the whole screen; the quieter modes keep
   * what is on screen and report a failure as a banner.
   */
  const load = useCallback(async (mode: 'silent' | 'refresh' | 'retry') => {
    if (mode === 'retry') {
      setLoading(true);
      setError(null);
    }
    if (mode === 'refresh') setRefreshing(true);

    try {
      const next = await fetchQuickBooks();
      setStatus(next);
      setError(null);
    } catch (cause) {
      const message = messageOf(cause, 'Could not read the QuickBooks connection');
      if (mode === 'retry') setError(message);
      else setNotice({ tone: 'error', message });
    } finally {
      if (mode === 'retry') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  }, []);

  // The first load: state is only touched once the request settles, so mounting
  // does not render twice, and an unmount before the response is ignored.
  useEffect(() => {
    let cancelled = false;

    fetchQuickBooks()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch((cause) => {
        if (!cancelled) setError(messageOf(cause, 'Could not read the QuickBooks connection'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Coming back from the browser: the callback ran in the other tab.
  useEffect(() => {
    if (Platform.OS === 'web') {
      const onFocus = () => void load('silent');
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load('silent');
    });
    return () => subscription.remove();
  }, [load]);

  /**
   * Open Intuit in a browser.
   *
   * On the web the tab is opened before the request so the browser still counts
   * it as part of the tap; a blocked popup falls back to this tab.
   */
  const connect = async () => {
    setStarting(true);
    setNotice(null);

    const pendingTab = Platform.OS === 'web' ? window.open('', '_blank') : null;
    if (pendingTab) pendingTab.opener = null;

    try {
      const { url } = await requestQuickBooksConnect();

      if (Platform.OS === 'web') {
        if (pendingTab) pendingTab.location.href = url;
        else window.location.href = url;
      } else {
        await Linking.openURL(url);
      }

      setNotice({
        tone: 'info',
        message: 'Finish connecting in the browser, then come back. This screen updates by itself.',
      });
    } catch (cause) {
      pendingTab?.close();
      setNotice({
        tone: 'error',
        message: messageOf(cause, 'Could not start the QuickBooks connection'),
      });
    } finally {
      setStarting(false);
    }
  };

  const connected = status?.connected === true;
  const refreshDaysLeft = status?.refreshTokenExpiresAt
    ? Math.ceil((new Date(status.refreshTokenExpiresAt).getTime() - Date.now()) / 86_400_000)
    : null;

  // The two facts that decide whether the connection is about to break; the
  // list underneath carries the rest of the detail.
  const figures: MetroFigure[] = [
    {
      label: 'Refresh token',
      value:
        refreshDaysLeft === null
          ? '—'
          : refreshDaysLeft > 0
            ? `${refreshDaysLeft} day${refreshDaysLeft === 1 ? '' : 's'}`
            : 'Expired',
      tone: refreshDaysLeft !== null && refreshDaysLeft <= 0 ? 'danger' : 'neutral',
    },
    {
      label: 'Connected since',
      value: status?.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : '—',
    },
  ];

  return (
    <MetroScreen
      eyebrow="Admin"
      title="Integrations"
      subtitle={
        loading
          ? 'Checking the QuickBooks connection…'
          : connected
            ? status?.companyName
              ? `QuickBooks · ${status.companyName}`
              : 'QuickBooks connected'
            : 'QuickBooks is not connected'
      }
      width="wide"
      onRefresh={() => void load('refresh')}
      refreshing={refreshing}
      action={
        <View style={styles.actions}>
          <MetroButton
            label="Check"
            variant="ghost"
            onPress={() => void load('refresh')}
            disabled={loading}
          />
          <MetroButton
            label={connected ? 'Reconnect' : 'Connect QuickBooks'}
            onPress={() => void connect()}
            loading={starting}
          />
        </View>
      }>
      <AdminPivot />

      {notice ? (
        <MetroBanner
          message={notice.message}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      {status?.needsAttention && !loading ? (
        <MetroBanner
          message={status.needsAttention}
          tone={connected ? 'error' : 'info'}
        />
      ) : null}

      {loading ? (
        <MetroLoading label="Checking QuickBooks" />
      ) : error ? (
        <MetroError message={error} onRetry={() => void load('retry')} />
      ) : !status ? null : (
        <>
          <MetroFigures figures={figures} size="medium" />

          <View style={[styles.columns, { flexDirection: sideBySide ? 'row' : 'column' }]}>
            <View style={styles.column}>
              <MetroList title="Integration">
                <MetroListRow
                  title="QuickBooks Online"
                  subtitle={connected ? 'Accounting · company file' : 'Accounting · not linked yet'}
                  badge={{
                    label: connected ? 'Connected' : 'Not connected',
                    tone: connected ? 'accent' : 'neutral',
                  }}
                />
              </MetroList>

              {connected ? null : (
                <MetroEmpty
                  title="No QuickBooks company is linked"
                  message="Connect it so portfolio reports and facility metrics can read straight from the books."
                />
              )}

              <Text style={[styles.note, { color: theme.textDim }]}>
                {connected
                  ? 'Status is read from QuickBooks every time this screen loads, so a connection shown here is one that still works.'
                  : 'Connecting opens QuickBooks in a browser tab. Sign in there, approve access, then come back — nothing is stored until QuickBooks answers.'}
              </Text>
            </View>

            <View style={styles.column}>
              <MetroList title="Connection">
                <MetroListRow title="Company" value={status.companyName ?? '—'} />
                <MetroListRow title="Company ID" value={status.realmId ?? '—'} />
                <MetroListRow
                  title="Access token"
                  subtitle="Refreshes on its own while the connection is alive"
                  value={whenLabel(status.accessTokenExpiresAt)}
                />
                <MetroListRow
                  title="Refresh token"
                  subtitle={
                    refreshDaysLeft === null
                      ? 'No refresh window recorded'
                      : refreshDaysLeft > 0
                        ? `${refreshDaysLeft} day${refreshDaysLeft === 1 ? '' : 's'} left before reconnecting`
                        : 'Expired — reconnect to renew'
                  }
                  value={whenLabel(status.refreshTokenExpiresAt)}
                />
                <MetroListRow title="Connected" value={whenLabel(status.connectedAt)} />
              </MetroList>
            </View>
          </View>
        </>
      )}
    </MetroScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  columns: {
    gap: Spacing.four,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    alignSelf: 'stretch',
    gap: Spacing.three,
  },
  note: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
});
