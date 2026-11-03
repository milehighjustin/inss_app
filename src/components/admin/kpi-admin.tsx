import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroDialog,
  MetroEmpty,
  MetroError,
  MetroField,
  MetroFigures,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroPanel,
  MetroPivot,
  MetroScreen,
  MetroSection,
  MetroToggle,
  type MetroFigure,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import {
  formatMoney,
  listLocations,
  updateLocation,
  type AdminLocation,
} from '@/lib/admin/locations';
import { deleteSavedList, loadSavedLists, type SavedKpiList } from '@/lib/kpi';
import { useMetro } from '@/components/metro/use-metro';
import { AdminPivot } from './admin-pivot';
import { AdminToolbar } from './admin-toolbar';

const TABS = [
  { value: 'locations', label: 'Location Settings' },
  { value: 'lists', label: 'Saved Lists' },
];

/** Admin → KPI: v1's two tabs. */
export function KpiAdmin() {
  const [tab, setTab] = useState('locations');

  return (
    <MetroScreen
      eyebrow="Admin"
      title="KPI"
      subtitle="Which properties are on the board, their OER scores, and the saved lists everyone shares."
      width="wide">
      <AdminPivot />
      <MetroPivot tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'locations' ? <KpiLocationSettings /> : <SavedLists />}
    </MetroScreen>
  );
}

/**
 * Location Settings.
 *
 * v1's board is opt-in: a location appears on the KPI section only when
 * `kpiActive` is set, and the year's OER score is what the board shows in that
 * column. Both are written through the one location endpoint, so the investor
 * panel sees the same record.
 */
function KpiLocationSettings() {
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminLocation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLocations(await listLocations());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return locations;
    return locations.filter((location) =>
      `${location.departmentName} ${location.name}`.toLowerCase().includes(clean),
    );
  }, [locations, query]);

  const onBoard = locations.filter((location) => location.kpiActive).length;
  const scored = locations.filter((location) => typeof location.oerScore === 'number');
  const averageOer = scored.length
    ? scored.reduce((sum, location) => sum + (location.oerScore ?? 0), 0) / scored.length
    : 0;

  const figures: MetroFigure[] = [
    { label: 'On the board', value: String(onBoard), tone: 'accent' },
    { label: 'Not on the board', value: String(locations.length - onBoard) },
    {
      label: 'Average OER',
      value: scored.length ? averageOer.toFixed(1) : '—',
      hint: scored.length ? `Across ${scored.length} scored` : 'No scores recorded',
    },
  ];

  return (
    <View style={styles.body}>
      {notice ? <MetroBanner tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      <AdminToolbar
        count={`${visible.length} of ${locations.length}`}
        actions={<MetroButton label="Refresh" variant="ghost" onPress={() => void load()} />}>
        <View style={styles.search}>
          <MetroField
            label="Search locations"
            hideLabel
            value={query}
            onChangeText={setQuery}
            placeholder="Search locations"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </AdminToolbar>

      {loading ? null : <MetroFigures figures={figures} size="medium" />}

      {loading ? (
        <MetroLoading label="Loading locations" />
      ) : error ? (
        <MetroError message={error} onRetry={() => void load()} />
      ) : visible.length === 0 ? (
        <MetroEmpty
          title="No locations match"
          message={query ? `Nothing matches “${query}”.` : 'There are no locations yet.'}
        />
      ) : (
        <MetroList>
          {visible.map((location) => (
            <MetroListRow
              key={location.id}
              title={location.departmentName || location.name || 'Unnamed property'}
              subtitle={[
                location.status || 'No status',
                location.oerScore === null ? 'No OER score' : `OER ${location.oerScore}`,
                formatMoney(location.propertyValue),
              ].join(' · ')}
              badge={location.kpiActive ? { label: 'On board', tone: 'accent' } : undefined}
              onPress={() => setSelected(location)}
            />
          ))}
        </MetroList>
      )}

      {selected ? (
        <KpiLocationPanel
          location={selected}
          onClose={() => setSelected(null)}
          onSaved={(saved) => {
            setLocations((rows) =>
              rows.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)),
            );
            setSelected(saved);
            setNotice(`${saved.departmentName || saved.name} saved.`);
          }}
        />
      ) : null}
    </View>
  );
}

function KpiLocationPanel({
  location,
  onClose,
  onSaved,
}: {
  location: AdminLocation;
  onClose: () => void;
  onSaved: (location: AdminLocation) => void;
}) {
  const theme = useMetro();
  const [active, setActive] = useState(location.kpiActive);
  const [oer, setOer] = useState(location.oerScore === null ? '' : String(location.oerScore));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const score = oer.trim() === '' ? null : Number(oer);
    if (score !== null && (!Number.isFinite(score) || score < 0)) {
      setError('The OER score is a number of zero or more.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      onSaved(await updateLocation(location.id, { kpiActive: active, oerScore: score }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The location could not be saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MetroPanel
      visible
      title={location.departmentName || location.name || 'Property'}
      subtitle={location.status || undefined}
      onClose={onClose}>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      <MetroSection
        title="KPI board"
        hint="Off keeps this property out of the KPI section and every saved list.">
        <MetroToggle
          label="Show on the KPI board"
          description={active ? 'On the board' : 'Hidden from the board'}
          value={active}
          onChange={setActive}
        />
      </MetroSection>

      <MetroSection title="OER score" hint="The operational excellence review score the board shows.">
        <MetroField
          label="OER score"
          value={oer}
          onChangeText={setOer}
          keyboardType="numeric"
          placeholder="Leave empty for no score"
        />
      </MetroSection>

      <View style={styles.panelActions}>
        <MetroButton label="Save" loading={saving} onPress={() => void save()} />
        <Text style={[styles.meta, { color: theme.textDim }]}>
          {location.internalId ? `Internal ID ${location.internalId}` : 'No internal ID'}
        </Text>
      </View>
    </MetroPanel>
  );
}

/** Saved Lists: v1's shared subsets, with the one action it offers — Remove. */
function SavedLists() {
  const [lists, setLists] = useState<SavedKpiList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<SavedKpiList | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLists(await loadSavedLists());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load saved lists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteSavedList(removing.id);
      setRemoving(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The list could not be removed');
    } finally {
      setBusy(false);
    }
  };

  // How much of the board the saved lists actually cover, so a stale list is
  // visible without opening every one of them.
  const coveredProperties = new Set(lists.flatMap((list) => list.facilityIds)).size;

  return (
    <View style={styles.body}>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      <AdminToolbar
        count={loading ? 'Loading lists…' : `${lists.length} list${lists.length === 1 ? '' : 's'}`}
        actions={<MetroButton label="Refresh" variant="ghost" onPress={() => void load()} />}
      />

      {loading ? null : (
        <MetroFigures
          figures={[
            { label: 'Saved lists', value: String(lists.length) },
            { label: 'Properties covered', value: String(coveredProperties) },
          ]}
          size="medium"
        />
      )}

      {loading ? (
        <MetroLoading label="Loading saved lists" />
      ) : lists.length === 0 ? (
        <MetroEmpty
          title="No saved lists"
          message="Lists saved from the KPI board appear here, and everyone sees them."
        />
      ) : (
        <MetroList>
          {lists.map((list) => (
            <MetroListRow
              key={list.id}
              title={list.name}
              subtitle={`${list.facilityIds.length} propert${list.facilityIds.length === 1 ? 'y' : 'ies'}`}
              accessory={
                <MetroButton
                  label="Remove"
                  variant="ghost"
                  size="compact"
                  color="danger"
                  onPress={() => setRemoving(list)}
                />
              }
            />
          ))}
        </MetroList>
      )}

      <MetroDialog
        visible={removing !== null}
        title="Remove this list?"
        message={removing ? `“${removing.name}” will be gone for everyone.` : undefined}
        onClose={() => setRemoving(null)}
        actions={[
          {
            label: 'Remove',
            destructive: true,
            loading: busy,
            onPress: () => void remove(),
          },
          { label: 'Keep', variant: 'ghost', onPress: () => setRemoving(null) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  search: {
    flex: 1,
    // A phone wraps the rest of the toolbar under it rather than squeezing the field away.
    minWidth: 220,
  },
  panelActions: {
    gap: Spacing.two,
  },
  meta: {
    fontSize: 12,
  },
});
