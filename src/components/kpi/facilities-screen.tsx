import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroEmpty,
  MetroError,
  MetroField,
  MetroLoading,
  MetroScreen,
  MetroSelect,
  useMetro,
} from '@/components/metro';
import { MetroType, Spacing } from '@/constants/metro';
import {
  loadKpi,
  loadSavedLists,
  searchFacilities,
  type KpiFacility,
  type SavedKpiList,
} from '@/lib/kpi';
import { KpiTable } from './kpi-table';

const ALL_FACILITIES = 'all';

type Notice = { tone: 'success' | 'error'; message: string };

/**
 * KPI → Facilities.
 *
 * v1's board is one wide table, so this is one wide table: every column it has,
 * scrolling inside a framed area with the header row, the facility column and the
 * totals row held still. The page itself does not scroll — the table does, both
 * ways.
 *
 * Above it sit the list to view, a search and a refresh. Lists are authored in
 * Admin → KPI instead: the board only reads them, so nothing done here changes
 * what everybody else sees.
 */
export function KpiFacilities() {
  const theme = useMetro();

  const [facilities, setFacilities] = useState<KpiFacility[]>([]);
  const [lists, setLists] = useState<SavedKpiList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>(ALL_FACILITIES);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = async (mode: 'refresh' | 'retry') => {
    if (mode === 'retry') {
      setLoading(true);
      setError(null);
    }
    if (mode === 'refresh') setRefreshing(true);

    try {
      const [board, saved] = await Promise.all([loadKpi(), loadSavedLists()]);
      setFacilities(board);
      setLists(saved);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the KPI board');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // The first load: state is only touched once the request settles, so mounting
  // does not render twice, and an unmount before the response is ignored.
  useEffect(() => {
    let cancelled = false;

    Promise.all([loadKpi(), loadSavedLists()])
      .then(([board, saved]) => {
        if (cancelled) return;
        setFacilities(board);
        setLists(saved);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load the KPI board');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;

  const scoped = useMemo(
    () =>
      selectedList
        ? facilities.filter((facility) => selectedList.facilityIds.includes(facility.id))
        : facilities,
    [facilities, selectedList],
  );

  const visible = useMemo(() => searchFacilities(scoped, query), [scoped, query]);

  const listOptions = [
    { value: ALL_FACILITIES, label: `All facilities (${facilities.length})` },
    ...lists.map((list) => ({
      value: list.id,
      label: list.name,
      description: `${list.facilityIds.length} facilities`,
    })),
  ];

  return (
    <MetroScreen width="wide" scroll={false} padding="compact" contentStyle={{ flex: 1, gap: Spacing.two }}>
      {notice ? (
        <MetroBanner message={notice.message} tone={notice.tone} onDismiss={() => setNotice(null)} />
      ) : null}

      {/* One strip: how many properties, which list, the search, the actions.
          There is no page heading and no labels above the controls — the count
          labels itself and the table is the page, so every row of chrome is a
          row of facilities lost. It wraps onto its own lines on a phone. */}
      <View style={styles.controls}>
        <Text numberOfLines={1} style={[styles.count, { color: theme.textDim }]}>
          {loading
            ? 'Loading…'
            : `${visible.length}${query || selectedList ? ` of ${facilities.length}` : ''} properties`}
        </Text>
        <View style={styles.listField}>
          <MetroSelect
            hideLabel
            label="List"
            options={listOptions}
            value={selectedListId}
            onChange={(value) => {
              setNotice(null);
              setSelectedListId(value);
            }}
            sheetTitle="Saved lists"
          />
        </View>
        <View style={styles.searchField}>
          <MetroField
            hideLabel
            label="Search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search facilities"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <View style={styles.actions}>
          <MetroButton
            label="Refresh"
            variant="ghost"
            loading={refreshing}
            onPress={() => load('refresh')}
          />
        </View>
      </View>

      {loading ? (
        <MetroLoading label="Loading the board" />
      ) : error ? (
        <MetroError message={error} onRetry={() => load('retry')} />
      ) : visible.length === 0 ? (
        <MetroEmpty
          title="No facilities match"
          message={
            query
              ? `Nothing matches “${query}”. Try a shorter search.`
              : selectedList
                ? 'That list is empty, or its facilities are no longer active.'
                : 'No facility is active yet.'
          }
        />
      ) : (
        <KpiTable
          facilities={visible}
          onOpen={(facility) =>
            router.push({ pathname: '/kpi/[facilityId]', params: { facilityId: facility.id } })
          }
        />
      )}

    </MetroScreen>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // The count is text among 52-point controls, so the row centres on the
    // controls rather than hanging off their tops.
    alignItems: 'center',
    gap: Spacing.two,
  },
  count: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 600,
  },
  listField: {
    flexBasis: 190,
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 170,
    maxWidth: 260,
  },
  searchField: {
    flexBasis: 200,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 160,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginLeft: 'auto',
  },
});
