import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  MetroButton,
  MetroError,
  MetroLoading,
  MetroPanel,
  MetroPivot,
  MetroScreen,
  useMetro,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import {
  loadInvestor,
  portfolioAsOf,
  type InvestorData,
  type InvestorLocation,
  type InvestorTarget,
} from '@/lib/investor';
import { ActingAsNotice } from './acting-as';
import { LocationDetail } from './location-detail';
import { PortfolioReport } from './portfolio-report';
import { PortfolioSnapshot } from './snapshot';

type Tab = 'snapshot' | 'report';

const TABS = [
  { value: 'snapshot', label: 'Portfolio Snapshot' },
  { value: 'report', label: 'Portfolio Report' },
];

/** `Sep 30, 2025`, read in UTC so a valuation date never slips a day. */
function asOfLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Portfolio, as v1 lays it out.
 *
 * The two tabs are v1's `NavigationHorizontal`: Snapshot (the equity allocation
 * and the totals) and Report (every property beside this investor's portfolio
 * and the organization's). Tapping a property in either one opens the same
 * detail that v1 shows in its big modal.
 *
 * Both tabs are fed by one call, so switching does not refetch.
 *
 * `actingAs` is v1's "Investor View": an administrator reading this same screen
 * for one investor. Nothing about the layout changes — a preview that rearranged
 * itself would not answer the question it exists for — so the only difference is
 * whose portfolio is fetched and the strip that says so.
 */
export function InvestorScreen({ actingAs }: { actingAs?: InvestorTarget }) {
  const theme = useMetro();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('snapshot');
  const [data, setData] = useState<InvestorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);

    loadInvestor(actingAs?.userId)
      .then(setData)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Could not load your portfolio'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  /** Preview only: their files and the way back to their admin page. */
  const openFiles = () => {
    if (!actingAs) return;
    router.push({
      pathname: '/admin/investors/[userId]/files',
      params: { userId: actingAs.userId, name: actingAs.name },
    });
  };

  const active = useMemo(
    () => data?.locations.find((location) => location.id === activeId) ?? null,
    [data, activeId],
  );

  // How big the portfolio is and how fresh it is — the two facts an investor
  // checks before reading a number, kept in the page header rather than buried
  // in a property panel.
  const subtitle = useMemo(() => {
    if (!data) return undefined;
    const count = data.locations.length;
    const asOf = portfolioAsOf(data);
    return [
      `${count} ${count === 1 ? 'property' : 'properties'}`,
      asOf ? `As of ${asOfLabel(asOf)}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }, [data]);

  return (
    <MetroScreen
      eyebrow={actingAs ? 'Investor Portal · Preview' : 'Investor Portal'}
      title="Portfolio"
      subtitle={subtitle}
      width="wide"
      scroll={false}
      padding="compact"
      contentStyle={{ flex: 1, gap: Spacing.three }}>
      {actingAs ? (
        <ActingAsNotice
          target={actingAs}
          actions={
            <>
              <MetroButton label="Files" variant="ghost" size="compact" onPress={openFiles} />
              <MetroButton
                label="Back to investors"
                variant="ghost"
                size="compact"
                onPress={() => router.back()}
              />
            </>
          }
        />
      ) : null}

      <MetroPivot tabs={TABS} value={tab} onChange={(value) => setTab(value as Tab)} />

      {loading ? (
        <View style={styles.centre}>
          <MetroLoading label="Loading your portfolio" />
        </View>
      ) : error ? (
        <MetroError message={error} onRetry={load} />
      ) : !data ? null : tab === 'snapshot' ? (
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.snapshotBody}
          showsVerticalScrollIndicator>
          <PortfolioSnapshot
            data={data}
            onOpenLocation={(location) => setActiveId(location.id)}
          />
        </ScrollView>
      ) : (
        <PortfolioReport data={data} onOpenLocation={(location) => setActiveId(location.id)} />
      )}

      <MetroPanel
        visible={active !== null}
        title={active?.departmentName ?? ''}
        subtitle={
          active
            ? [active.address.city, active.address.region].filter(Boolean).join(', ')
            : undefined
        }
        onClose={() => setActiveId(null)}>
        {active && data ? (
          <LocationDetail
            location={active}
            investorPortfolio={data.portfolio}
            organizationPortfolio={data.organizationPortfolio}
            onOpenReport={(kind) => {
              // The report is its own screen, so the property panel closes
              // first: going back lands on the portfolio, not over it.
              setActiveId(null);

              // A preview stays under the admin routes: the portal's own report
              // screen is behind the investor role gate, which an administrator
              // need not have.
              router.push(
                actingAs
                  ? {
                      pathname: '/admin/investors/[userId]/report',
                      params: {
                        userId: actingAs.userId,
                        name: actingAs.name,
                        locationId: active.id,
                        kind,
                      },
                    }
                  : {
                      pathname: '/investor/report',
                      params: { locationId: active.id, kind },
                    },
              );
            }}
          />
        ) : null}
      </MetroPanel>
    </MetroScreen>
  );
}

export type { InvestorLocation };

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    justifyContent: 'center',
  },
  snapshotBody: {
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
});
