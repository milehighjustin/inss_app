import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroBoardPage,
  MetroButton,
  MetroCheckbox,
  MetroDialog,
  MetroEmpty,
  MetroError,
  MetroField,
  MetroFigures,
  MetroList,
  MetroListArea,
  MetroListRow,
  MetroLoading,
  MetroPanel,
  MetroPivot,
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
import {
  createSavedList,
  deleteSavedList,
  loadKpi,
  loadSavedLists,
  updateSavedList,
  type SavedKpiList,
} from '@/lib/kpi';
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
    <MetroBoardPage
      eyebrow="Admin"
      title="KPI"
      subtitle="Which properties are on the board, their OER scores, and the saved lists everyone shares."
      width="wide">
      <AdminPivot />
      <MetroPivot tabs={TABS} value={tab} onChange={setTab} />
      <MetroListArea>
        {tab === 'locations' ? <KpiLocationSettings /> : <SavedLists />}
      </MetroListArea>
    </MetroBoardPage>
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

/**
 * Saved Lists — where lists are made, changed and removed.
 *
 * v1 saved the board's current view as a new list from a sheet on the board
 * itself, which put authoring on the screen people read. Worse, it had no way to
 * fix a list afterwards: the only action was Remove, so a list with one wrong
 * property had to be deleted and rebuilt. Editing lives here instead, where the
 * facilities are already a list to tick, and the board is left as a board.
 *
 * The documents are still v1's — `loglady.savedKpiLists`, shared by every viewer
 * — so a list edited here is the same list the website's admin panel sees.
 */
function SavedLists() {
  const [lists, setLists] = useState<SavedKpiList[]>([]);
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<SavedKpiList | 'new' | null>(null);
  const [removing, setRemoving] = useState<SavedKpiList | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [saved, board] = await Promise.all([loadSavedLists(), loadKpi()]);
      setLists(saved);
      // Only the board's own facilities: a list selects from what the board can
      // show, so offering a property that is off the board would build a list
      // that renders empty.
      setFacilities(board.map((facility) => ({ id: facility.id, name: facility.name })));
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
      setLists((rows) => rows.filter((row) => row.id !== removing.id));
      setNotice(`“${removing.name}” removed.`);
      setRemoving(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The list could not be removed');
    } finally {
      setBusy(false);
    }
  };

  const edited = editing === 'new' ? null : editing;

  // How much of the board the saved lists actually cover, so a stale list is
  // visible without opening every one of them.
  const coveredProperties = new Set(lists.flatMap((list) => list.facilityIds)).size;

  const sortLists = (rows: SavedKpiList[]) =>
    [...rows].sort((left, right) => left.name.localeCompare(right.name, 'en', { numeric: true }));

  return (
    <View style={styles.body}>
      {notice ? <MetroBanner tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      <AdminToolbar
        count={loading ? 'Loading lists…' : `${lists.length} list${lists.length === 1 ? '' : 's'}`}
        actions={
          <>
            <MetroButton label="New list" onPress={() => setEditing('new')} />
            <MetroButton label="Refresh" variant="ghost" onPress={() => void load()} />
          </>
        }
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
          message="Name a set of properties here and everyone sees it in the KPI board's list picker."
        />
      ) : (
        <MetroList>
          {lists.map((list) => (
            <MetroListRow
              key={list.id}
              title={list.name}
              subtitle={`${list.facilityIds.length} propert${list.facilityIds.length === 1 ? 'y' : 'ies'}`}
              value="Edit"
              onPress={() => setEditing(list)}
            />
          ))}
        </MetroList>
      )}

      {editing ? (
        <SavedListPanel
          list={edited}
          facilities={facilities}
          onClose={() => setEditing(null)}
          onRemove={edited ? () => {
            setEditing(null);
            setRemoving(edited);
          } : undefined}
          onSaved={(saved, created) => {
            setLists((rows) =>
              sortLists(
                created ? [...rows, saved] : rows.map((row) => (row.id === saved.id ? saved : row)),
              ),
            );
            setEditing(null);
            setNotice(
              created
                ? `“${saved.name}” created with ${saved.facilityIds.length} propert${saved.facilityIds.length === 1 ? 'y' : 'ies'}.`
                : `“${saved.name}” saved.`,
            );
          }}
        />
      ) : null}

      <MetroDialog
        visible={removing !== null}
        title="Remove this list?"
        message={removing ? `“${removing.name}” will be gone for everyone.` : undefined}
        onClose={() => setRemoving(null)}
        actions={[
          { label: 'Remove', destructive: true, loading: busy, onPress: () => void remove() },
          { label: 'Keep', variant: 'ghost', onPress: () => setRemoving(null) },
        ]}
      />
    </View>
  );
}

/**
 * One list: its name and which properties are in it.
 *
 * `list` is null when this is a new one, which is the only difference — the same
 * form creates and edits, so the two cannot drift apart.
 */
function SavedListPanel({
  list,
  facilities,
  onClose,
  onSaved,
  onRemove,
}: {
  list: SavedKpiList | null;
  facilities: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (saved: SavedKpiList, created: boolean) => void;
  onRemove?: () => void;
}) {
  const theme = useMetro();
  const [name, setName] = useState(list?.name ?? '');
  const [ids, setIds] = useState<string[]>(list?.facilityIds ?? []);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return facilities;
    return facilities.filter((facility) => facility.name.toLowerCase().includes(clean));
  }, [facilities, query]);

  const toggle = (id: string, checked: boolean) =>
    setIds((current) => (checked ? [...current, id] : current.filter((entry) => entry !== id)));

  const save = async () => {
    const clean = name.trim();
    if (!clean) {
      setError('Name the list before saving it.');
      return;
    }
    if (ids.length === 0) {
      setError('Choose at least one property.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = list
        ? await updateSavedList(list.id, { name: clean, facilityIds: ids })
        : await createSavedList(clean, ids);
      onSaved(saved, list === null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The list could not be saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MetroPanel
      visible
      title={list ? list.name || 'Saved list' : 'New saved list'}
      subtitle={
        list
          ? `${list.facilityIds.length} propert${list.facilityIds.length === 1 ? 'y' : 'ies'} · shared with everyone`
          : 'Shared with everyone once it is created'
      }
      onClose={onClose}>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      <MetroSection title="Name" hint="This is what the board's list picker shows.">
        <MetroField
          label="List name"
          value={name}
          onChangeText={setName}
          placeholder="My facilities"
          autoCapitalize="words"
        />
      </MetroSection>

      <MetroSection
        title={`Properties · ${ids.length} of ${facilities.length}`}
        hint="Tick the properties this list shows. A property that is off the board is not offered.">
        <MetroField
          label="Search properties"
          hideLabel
          value={query}
          onChangeText={setQuery}
          placeholder="Search properties"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.inlineActions}>
          <MetroButton
            label="All"
            variant="ghost"
            size="compact"
            onPress={() => setIds(facilities.map((facility) => facility.id))}
          />
          <MetroButton
            label="None"
            variant="ghost"
            size="compact"
            onPress={() => setIds([])}
          />
        </View>

        {facilities.length === 0 ? (
          <Text style={[styles.meta, { color: theme.textDim }]}>
            No property is on the KPI board yet. Turn one on in Location Settings first.
          </Text>
        ) : visible.length === 0 ? (
          <Text style={[styles.meta, { color: theme.textDim }]}>
            Nothing matches “{query}”.
          </Text>
        ) : (
          visible.map((facility) => (
            <MetroCheckbox
              key={facility.id}
              label={facility.name}
              checked={ids.includes(facility.id)}
              onChange={(checked) => toggle(facility.id, checked)}
            />
          ))
        )}
      </MetroSection>

      <View style={styles.panelActions}>
        <MetroButton
          label={list ? 'Save list' : 'Create list'}
          loading={saving}
          onPress={() => void save()}
        />
        {onRemove ? (
          <MetroButton
            label="Remove this list"
            variant="ghost"
            color="danger"
            onPress={onRemove}
          />
        ) : null}
      </View>
    </MetroPanel>
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
  inlineActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
  },
});
