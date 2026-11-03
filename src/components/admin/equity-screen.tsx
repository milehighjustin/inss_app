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
  MetroLoading,
  type MetroFigure,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import {
  formatMoney,
  listInvestments,
  type AdminInvestment,
} from '@/lib/admin/investors';
import { AdminToolbar } from './admin-toolbar';

/**
 * Investor Portal → Equity.
 *
 * v1's read-only table of the whole book: which QuickBooks equity account holds
 * money in which property, and how much. It is the data the portal's investor
 * pages are derived from, so it is the first place to look when a number does
 * not add up.
 */
export function EquityAdmin() {
  const [investments, setInvestments] = useState<AdminInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvestments(await listInvestments());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load equity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    const rows = clean
      ? investments.filter((investment) =>
          `${investment.accountName} ${investment.locationName}`
            .toLowerCase()
            .includes(clean),
        )
      : investments;
    return [...rows].sort((left, right) => right.amount - left.amount);
  }, [investments, query]);

  const total = visible.reduce((sum, investment) => sum + investment.amount, 0);

  // The book's own summary: how much is invested, in how many places.
  const figures: MetroFigure[] = [
    { label: 'Total equity', value: formatMoney(total), tone: 'accent' },
    { label: 'Entries', value: String(visible.length) },
    {
      label: 'Properties',
      value: String(new Set(visible.map((investment) => investment.locationName)).size),
    },
  ];

  return (
    <View style={styles.body}>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      <AdminToolbar
        count={`${visible.length} of ${investments.length}`}
        actions={<MetroButton label="Refresh" variant="ghost" onPress={() => void load()} />}>
        <View style={styles.search}>
          <MetroField
            label="Search equity"
            hideLabel
            value={query}
            onChangeText={setQuery}
            placeholder="Search by account or property"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </AdminToolbar>

      {loading ? null : <MetroFigures figures={figures} size="medium" />}

      {loading ? (
        <MetroLoading label="Loading equity" />
      ) : visible.length === 0 ? (
        <MetroEmpty
          title="Nothing here yet"
          message={
            query
              ? `Nothing matches “${query}”.`
              : 'QuickBooks has not returned any equity investments. Check the connection, then refresh.'
          }
        />
      ) : (
        <MetroList>
          {visible.map((investment, index) => (
            <MetroListRow
              key={`${investment.account}-${investment.locationId}-${index}`}
              title={investment.locationName || 'Unassigned property'}
              subtitle={investment.accountName || 'Unknown account'}
              value={formatMoney(investment.amount)}
              emphasis
            />
          ))}
        </MetroList>
      )}
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
});
