import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  MetroBanner,
  MetroBoardPage,
  MetroButton,
  MetroEmpty,
  MetroError,
  MetroField,
  MetroList,
  MetroListArea,
  MetroListRow,
  MetroLoading,
  MetroPager,
  MetroSelect,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import { formatDuration } from '@/lib/admin/performance';
import {
  ageLabel,
  alertOutcome,
  ALERTS_PAGE_SIZE,
  fetchAdminAlerts,
  type AlertActionFilter,
  type AlertPage,
  type AlertRow,
} from '@/lib/support/alerts';
import { AdminPivot } from '../admin-pivot';
import { AdminSupportPivot } from './support-pivot';

/**
 * Admin → Support → Alerts.
 *
 * The whole log, one row per alert, newest first, twenty-five to a page — the
 * question "what happened to the scan at 14:05" answered without opening a shift
 * or a person first.
 *
 * Search is over what an alert says: its title, its body, the code and the
 * property. The two filters are the two things a supervisor actually asks — what
 * became of it (answered, ignored, expired, still waiting) and who answered it —
 * and the range exists because an unfiltered log is a history of the company.
 *
 * `counts` comes back with the rows, so a filter can say how much is behind it
 * before it is chosen.
 */
export function SupportAlertsScreen() {
  const { width } = useWindowDimensions();
  const sideBySide = width >= 900;

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<AlertActionFilter>('all');
  const [answeredBy, setAnsweredBy] = useState('any');
  const [range, setRange] = useState('any');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AlertPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Typing should not fire a request per keystroke; the list is a search box, not
  // a live filter that flickers.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (wantedPage: number, mode: 'load' | 'refresh' | 'page') => {
      if (mode === 'load') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'page') setPaging(true);

      try {
        setData(
          await fetchAdminAlerts({
            page: wantedPage,
            pageSize: ALERTS_PAGE_SIZE,
            ...(search ? { q: search } : {}),
            action,
            ...(answeredBy !== 'any' ? { answeredBy } : {}),
            ...(range !== 'any' ? { days: Number(range) } : {}),
          }),
        );
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load the alerts');
      } finally {
        if (mode === 'load') setLoading(false);
        if (mode === 'refresh') setRefreshing(false);
        if (mode === 'page') setPaging(false);
      }
    },
    [search, action, answeredBy, range],
  );

  useEffect(() => {
    setPage(1);
    void load(1, 'load');
  }, [load]);

  const counts = data?.counts;

  const actionOptions = [
    { value: 'all', label: `Any action (${counts?.all ?? 0})` },
    { value: 'answered', label: `Answered (${counts?.answered ?? 0})` },
    { value: 'ignored', label: `Ignored (${counts?.ignored ?? 0})` },
    { value: 'expired', label: `Expired (${counts?.expired ?? 0})` },
    { value: 'waiting', label: `Waiting (${counts?.waiting ?? 0})` },
  ];

  const personOptions = [
    { value: 'any', label: 'Anyone' },
    ...(data?.people ?? []).map((person) => ({
      value: person.userId,
      label: `${person.name} (${person.answered})`,
    })),
  ];

  const rangeOptions = [
    { value: 'any', label: 'All time' },
    { value: '1', label: 'Last 24 hours' },
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
  ];

  const alerts = data?.alerts ?? [];

  return (
    <MetroBoardPage
      eyebrow="Admin"
      title="Support"
      subtitle="Every alert, what became of it, and who answered."
      width="wide"
      action={
        <MetroButton
          label="Refresh"
          variant="ghost"
          loading={refreshing}
          onPress={() => void load(page, 'refresh')}
        />
      }>
      <AdminPivot />
      <AdminSupportPivot />

      {error ? (
        <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} />
      ) : null}

      <View style={[styles.controls, { flexDirection: sideBySide ? 'row' : 'column' }]}>
        <View style={styles.search}>
          <MetroField
            label="Search"
            value={query}
            onChangeText={setQuery}
            placeholder="Title, visitor, code or property"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <View style={sideBySide ? styles.action : undefined}>
          <MetroSelect
            label="Action"
            options={actionOptions}
            value={action}
            onChange={(value) => {
              setAction(value as AlertActionFilter);
              setPage(1);
            }}
          />
        </View>
        <View style={sideBySide ? styles.person : undefined}>
          <MetroSelect
            label="Answered by"
            options={personOptions}
            value={answeredBy}
            onChange={(value) => {
              setAnsweredBy(value);
              setPage(1);
            }}
          />
        </View>
        <View style={sideBySide ? styles.range : undefined}>
          <MetroSelect
            label="Range"
            options={rangeOptions}
            value={range}
            onChange={(value) => {
              setRange(value);
              setPage(1);
            }}
          />
        </View>
      </View>

      <MetroListArea>
        {loading ? (
          <MetroLoading label="Reading the alert log" />
        ) : error && alerts.length === 0 ? (
          <MetroError message={error} onRetry={() => void load(1, 'load')} />
        ) : alerts.length === 0 ? (
          <MetroEmpty
            title="No alerts match"
            message={
              search
                ? `Nothing matches “${search}”. Try a shorter search or a wider range.`
                : 'Nothing in this filter and range yet.'
            }
          />
        ) : (
          <MetroList>
            {alerts.map((alert) => (
              <MetroListRow
                key={alert.notificationId}
                title={alert.title}
                subtitle={[
                  when(alert),
                  alert.locationName ?? alert.qrCodeName ?? 'No place attached',
                  alertOutcome(alert),
                  alert.answerSeconds != null ? `${alert.answerSeconds}s to answer` : '',
                  alert.action === 'answered' && !alert.call ? 'No call' : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                badge={badgeFor(alert)}
                value={
                  alert.call
                    ? alert.call.seconds === null
                      ? 'On a call'
                      : `${formatDuration(alert.call.seconds)} call`
                    : undefined
                }
                emphasis
              />
            ))}
          </MetroList>
        )}
      </MetroListArea>

      <View style={styles.footer}>
        <MetroPager
          page={data?.page ?? 1}
          pageSize={data?.pageSize ?? ALERTS_PAGE_SIZE}
          total={data?.total ?? 0}
          loading={paging}
          onChange={(next) => {
            setPage(next);
            void load(next, 'page');
          }}
        />
      </View>
    </MetroBoardPage>
  );
}

function badgeFor(alert: AlertRow) {
  switch (alert.action) {
    case 'answered':
      return alert.call
        ? ({ label: 'Called', tone: 'accent' as const } satisfies { label: string; tone: 'accent' })
        : { label: 'Answered', tone: 'neutral' as const };
    case 'ignored':
      return { label: 'Ignored', tone: 'danger' as const };
    case 'expired':
      return { label: 'Expired', tone: 'neutral' as const };
    case 'waiting':
    default:
      return { label: 'Waiting', tone: 'accent' as const };
  }
}

function when(alert: AlertRow): string {
  const at = new Date(alert.createdAt);
  if (Number.isNaN(at.getTime())) return ageLabel(alert.ageSeconds);
  return `${at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

const styles = StyleSheet.create({
  controls: {
    gap: Spacing.three,
    alignItems: 'flex-end',
  },
  search: {
    flex: 1,
    alignSelf: 'stretch',
  },
  action: {
    width: 200,
  },
  person: {
    width: 220,
  },
  range: {
    width: 180,
  },
  footer: {
    paddingBottom: Spacing.two,
  },
});
