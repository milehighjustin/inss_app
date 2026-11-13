import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroCheckbox,
  MetroEmpty,
  MetroError,
  MetroField,
  MetroFigures,
  MetroHeading,
  MetroList,
  MetroListRow,
  MetroLabel,
  MetroListArea,
  MetroLoading,
  MetroPanel,
  type MetroFigure,
} from '@/components/metro';
import { useMetro } from '@/components/metro/use-metro';
import { Spacing } from '@/constants/metro';
import {
  fetchInvestorView,
  formatMoney,
  listEquityAccounts,
  listInvestors,
  saveInvestments,
  type AdminInvestor,
  type EquityAccount,
  type InvestorView,
} from '@/lib/admin/investors';
import { AdminToolbar } from './admin-toolbar';

/**
 * Investor Portal → Investors.
 *
 * v1 lists every account with the investor role and opens the one form that
 * matters: which QuickBooks equity accounts are theirs. The list is what the
 * portal derives a portfolio from, so saving here is what makes an investor's
 * properties appear on their own screens.
 */
export function InvestorsAdmin() {
  const [investors, setInvestors] = useState<AdminInvestor[]>([]);
  const [accounts, setAccounts] = useState<EquityAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminInvestor | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [people, equity] = await Promise.all([listInvestors(), listEquityAccounts()]);
      setInvestors(people);
      setAccounts(equity);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load investors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return investors;
    return investors.filter((investor) =>
      `${investor.name} ${investor.email}`.toLowerCase().includes(clean),
    );
  }, [investors, query]);

  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name ?? id;

  return (
    <>
      {notice ? <MetroBanner tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      <AdminToolbar
        count={`${visible.length} of ${investors.length}`}
        actions={<MetroButton label="Refresh" variant="ghost" onPress={() => void load()} />}>
        <View style={styles.search}>
          <MetroField
            label="Search investors"
            hideLabel
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or email"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </AdminToolbar>

      <MetroListArea>
      {loading ? (
        <MetroLoading label="Loading investors" />
      ) : error ? (
        <MetroError message={error} onRetry={() => void load()} />
      ) : visible.length === 0 ? (
        <MetroEmpty
          title="No investors"
          message={
            query
              ? `Nothing matches “${query}”.`
              : 'Give an account the investor role in Users, then come back to set up their equity.'
          }
        />
      ) : (
        <MetroList>
          {visible.map((investor) => (
            <MetroListRow
              key={investor.userId}
              title={investor.name}
              subtitle={[
                investor.email || 'No email',
                investor.investmentCount === 0
                  ? 'No equity accounts'
                  : `${investor.investmentCount} equity account${investor.investmentCount === 1 ? '' : 's'}`,
              ].join(' · ')}
              badge={investor.active ? undefined : { label: 'Inactive', tone: 'danger' }}
              onPress={() => setSelected(investor)}
            />
          ))}
        </MetroList>
      )}

      {selected ? (
        <InvestorPanel
          investor={selected}
          accounts={accounts}
          accountName={accountName}
          onClose={() => setSelected(null)}
          onSaved={(saved) => {
            const withAccounts = { ...saved, investmentCount: saved.investments.length };
            setInvestors((rows) =>
              rows.map((row) => (row.userId === withAccounts.userId ? withAccounts : row)),
            );
            setSelected(withAccounts);
            setNotice(`${withAccounts.name} saved.`);
          }}
        />
      ) : null}
      </MetroListArea>
    </>
  );
}

function InvestorPanel({
  investor,
  accounts,
  accountName,
  onClose,
  onSaved,
}: {
  investor: AdminInvestor;
  accounts: EquityAccount[];
  accountName: (id: string) => string;
  onClose: () => void;
  onSaved: (investor: AdminInvestor) => void;
}) {
  const theme = useMetro();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(investor.investments);
  const [filter, setFilter] = useState('');
  const [view, setView] = useState<InvestorView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadView = useCallback(async () => {
    try {
      setView(await fetchInvestorView(investor.userId));
    } catch {
      // The holdings are a preview; the association form still works without it.
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [investor.userId]);

  useEffect(() => {
    void loadView();
  }, [loadView]);

  const visibleAccounts = useMemo(() => {
    const clean = filter.trim().toLowerCase();
    if (!clean) return accounts;
    return accounts.filter((account) => account.name.toLowerCase().includes(clean));
  }, [accounts, filter]);

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...current, id] : current.filter((entry) => entry !== id),
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveInvestments(investor.userId, selectedIds);
      onSaved(saved);
      setNotice('Equity accounts saved.');
      await loadView();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The association could not be saved');
    } finally {
      setSaving(false);
    }
  };

  const isDirty =
    selectedIds.length !== investor.investments.length ||
    selectedIds.some((id) => !investor.investments.includes(id));

  const figures: MetroFigure[] = [
    {
      label: 'Total invested',
      value: formatMoney(view?.totalInvested ?? 0),
      tone: 'accent',
    },
    {
      label: 'Properties',
      value: String(view?.holdings.length ?? 0),
    },
    {
      label: 'Equity accounts',
      value: String(selectedIds.length),
      hint: 'What their portfolio is derived from',
    },
  ];

  return (
    <MetroPanel
      visible
      title={investor.name}
      subtitle={investor.email || undefined}
      onClose={onClose}>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? (
        <MetroBanner tone="success" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      {/* v1's Investor View tab, as a way out of the admin page: what they see,
          including documents and reports, without borrowing their login. */}
      <View style={styles.previewRow}>
        <MetroButton
          label="View their portal"
          variant="ghost"
          onPress={() => {
            onClose();
            router.push({
              pathname: '/admin/investors/[userId]/view',
              params: { userId: investor.userId, name: investor.name },
            });
          }}
        />
        <Text style={[styles.value, { color: theme.textDim }]}>
          Their portfolio, documents and reports, exactly as they see them.
        </Text>
      </View>

      {loading ? (
        <MetroLoading label="Loading holdings" />
      ) : (
        <MetroFigures figures={figures} size="medium" />
      )}

      <View style={styles.section}>
        <MetroHeading>Holdings by property</MetroHeading>
        {loading ? null : view && view.holdings.length ? (
          <MetroList>
            {view.holdings.map((holding) => (
              <MetroListRow
                key={holding.locationId || holding.locationName}
                title={holding.locationName}
                value={formatMoney(holding.amount)}
                emphasis
              />
            ))}
          </MetroList>
        ) : (
          <Text style={[styles.value, { color: theme.textDim }]}>
            Nothing invested through their current accounts.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <MetroHeading
          accessory={<MetroLabel>{`${selectedIds.length} selected`}</MetroLabel>}>
          Equity accounts
        </MetroHeading>
        <Text style={[styles.value, { color: theme.textDim }]}>
          The QuickBooks equity accounts that belong to this investor.
        </Text>
        <MetroField
          label="Find an account"
          value={filter}
          onChangeText={setFilter}
          placeholder="Search equity accounts"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {accounts.length === 0 ? (
          <Text style={[styles.value, { color: theme.textDim }]}>
            No equity accounts are loaded. Check the QuickBooks connection first.
          </Text>
        ) : visibleAccounts.length === 0 ? (
          <Text style={[styles.value, { color: theme.textDim }]}>
            No account matches “{filter}”.
          </Text>
        ) : (
          <MetroList>
            {visibleAccounts.map((account) => (
              <MetroCheckbox
                key={account.id}
                label={account.name}
                checked={selectedIds.includes(account.id)}
                onChange={(checked) => toggle(account.id, checked)}
                disabled={saving}
              />
            ))}
          </MetroList>
        )}
      </View>

      {selectedIds.length ? (
        <View style={styles.section}>
          <MetroHeading>Associated accounts</MetroHeading>
          <Text style={[styles.value, { color: theme.textDim }]}>
            {selectedIds.map(accountName).join(', ')}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <MetroButton
          label="Save associations"
          loading={saving}
          disabled={!isDirty && !saving}
          onPress={() => void save()}
        />
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
  section: {
    gap: Spacing.two,
  },
  previewRow: {
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
  },
  value: {
    fontSize: 14,
  },
});
