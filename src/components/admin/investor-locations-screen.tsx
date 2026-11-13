import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroEmpty,
  MetroError,
  MetroField,
  MetroFigures,
  MetroList,
  MetroListRow,
  MetroListArea,
  MetroLoading,
  type MetroFigure,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import {
  formatMoney,
  listLocations,
  type AdminLocation,
} from '@/lib/admin/locations';
import { AdminToolbar } from './admin-toolbar';
import { LocationPanel } from './location-panel';

/**
 * Investor Portal → Locations.
 *
 * The same records the KPI panel edits, with the fields the portal actually
 * reads: status, the QuickBooks link, the manual inputs and the notes.
 */
export function InvestorLocations() {
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
      `${location.departmentName} ${location.name} ${location.internalId}`
        .toLowerCase()
        .includes(clean),
    );
  }, [locations, query]);

  const figures: MetroFigure[] = [
    { label: 'Properties', value: String(locations.length) },
    {
      label: 'Linked to QuickBooks',
      value: String(locations.filter((location) => Boolean(location.departmentId)).length),
    },
    {
      label: 'Est. property value',
      value: formatMoney(
        locations.reduce((sum, location) => sum + (location.propertyValue || 0), 0),
      ),
    },
  ];

  return (
    <>
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
            placeholder="Search properties"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </AdminToolbar>

      {loading ? null : <MetroFigures figures={figures} size="medium" />}

      <MetroListArea>
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
                location.departmentId ? 'Linked to QuickBooks' : 'Not linked',
                formatMoney(location.propertyValue),
              ].join(' · ')}
              onPress={() => setSelected(location)}
            />
          ))}
        </MetroList>
      )}

      {selected ? (
        <LocationPanel
          location={selected}
          onClose={() => setSelected(null)}
          onSaved={(saved) => {
            setLocations((rows) =>
              rows.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)),
            );
            setSelected((current) => (current && current.id === saved.id ? saved : current));
          }}
        />
      ) : null}
      </MetroListArea>
    </>
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
});
