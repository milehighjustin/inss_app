import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroButton,
  MetroError,
  MetroFigures,
  MetroHeading,
  MetroLoading,
  MetroScreen,
  useMetro,
  type MetroFigure,
} from '@/components/metro';
import { MetroType, Spacing } from '@/constants/metro';
import {
  findFacility,
  formatCompactMoney,
  formatCount,
  formatMoney,
  formatPercent,
  formatRatio,
  type KpiFacility,
} from '@/lib/kpi';

interface Metric {
  label: string;
  value: string;
  hint?: string;
  /** A number that needs attention reads in the danger colour. */
  tone?: 'danger';
}

interface MetricGroup {
  title: string;
  metrics: Metric[];
}

/**
 * The whole metric set v1's table shows, grouped so it can be read on a phone.
 *
 * Labels carry v1's meaning; the notes are v1's column tooltips, shortened.
 */
function groupsFor(facility: KpiFacility): MetricGroup[] {
  const { occupancy, movement, delinquency, revenue, leads, protection, budget } = facility;

  return [
    {
      title: 'Occupancy',
      metrics: [
        { label: 'Storage unit occupancy', value: formatPercent(occupancy.storagePct) },
        { label: 'Parking unit occupancy', value: formatPercent(occupancy.parkingPct) },
        { label: 'Total unit occupancy', value: formatPercent(occupancy.totalPct) },
        {
          label: 'Economic occupancy',
          value: formatPercent(occupancy.economicPct),
          hint: 'Rented unit rates against gross potential rates',
        },
        { label: 'Rented units', value: formatCount(occupancy.rentedUnits) },
        { label: 'Unrentable units', value: formatCount(occupancy.unrentableUnits) },
      ],
    },
    {
      title: 'Movement',
      metrics: [
        { label: 'Move-ins', value: formatCount(movement.moveIns30d), hint: 'Last 30 days' },
        { label: 'Move-outs', value: formatCount(movement.moveOuts30d), hint: 'Last 30 days' },
        { label: 'Overlocked units', value: formatCount(movement.overlockedUnits) },
      ],
    },
    {
      title: 'Delinquency',
      metrics: [
        {
          label: 'Delinquent rent 30+',
          value: formatMoney(delinquency.amountOver30),
          tone: delinquency.amountOver30 > 0 ? 'danger' : undefined,
        },
        { label: 'Units 30–60 days late', value: formatCount(delinquency.units30to60) },
        { label: 'Units 60+ days late', value: formatCount(delinquency.unitsOver60) },
        {
          label: 'Occupied but 30+ late',
          value: formatPercent(delinquency.occupiedOver30Pct),
        },
      ],
    },
    {
      title: 'Revenue',
      metrics: [
        {
          label: 'Vacant unrentable rent',
          value: formatMoney(revenue.vacantUnrentableRent),
          hint: 'Monthly rent tied up in units that cannot be leased',
        },
        { label: 'Concessions', value: formatMoney(revenue.concessions30d), hint: 'Last 30 days' },
        { label: 'Waived rent', value: formatMoney(revenue.waivedRent30d), hint: 'Last 30 days' },
        { label: 'Waived fees', value: formatMoney(revenue.waivedFees30d), hint: 'Last 30 days' },
        {
          label: 'Contracted rent vs budget',
          value: formatPercent(revenue.contractedVsBudgetRentPct),
          hint: 'Rented unit value against the month rent budget',
        },
      ],
    },
    {
      title: 'Leads',
      metrics: [
        { label: 'Reservations', value: formatCount(leads.reservations30d), hint: 'Last 30 days' },
        { label: 'Inquiries', value: formatCount(leads.inquiries30d), hint: 'Last 30 days' },
        {
          label: 'Converted / inquiries',
          value: formatRatio(leads.converted30d, leads.inquiries30d),
          hint: 'Last 30 days',
        },
      ],
    },
    {
      title: 'Autopay and insurance',
      metrics: [
        { label: 'Occupied on autopay', value: formatPercent(protection.autopayPct) },
        { label: 'Occupied and insured', value: formatPercent(protection.insuredPct) },
        {
          label: 'Insurance sold',
          value: formatCount(protection.insuranceSold30d),
          hint: 'Last 30 days',
        },
      ],
    },
    {
      title: 'Budget',
      metrics: [
        { label: 'Income vs budget', value: formatPercent(budget.incomeVsBudgetPct) },
        { label: 'Expenses vs budget', value: formatPercent(budget.expensesVsBudgetPct) },
        {
          label: 'NOI vs budget',
          value: formatPercent(budget.noiVsBudgetPct),
          hint: 'Net operating income against budget',
        },
        {
          label: 'NOI vs budget, dollars',
          value: formatCompactMoney(budget.noiVsBudgetDol),
          hint: budget.noiVsBudgetDol < 0 ? 'Behind budget' : 'At or ahead of budget',
          tone: budget.noiVsBudgetDol < 0 ? 'danger' : undefined,
        },
      ],
    },
  ];
}

/**
 * KPI → one facility.
 *
 * The four numbers people open this screen for sit at the top as v1's headline
 * metrics; everything else is grouped underneath as a metric sheet rather than
 * laid out as a wide table. Labels stay quiet and the values carry the weight, so
 * the screen reads top to bottom instead of across forty columns.
 */
export function FacilityDetail({ facilityId }: { facilityId: string }) {
  const router = useRouter();
  const theme = useMetro();
  const [facility, setFacility] = useState<KpiFacility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const back = () => router.back();

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      setFacility(await findFacility(facilityId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this facility');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    findFacility(facilityId)
      .then((found) => {
        if (!cancelled) setFacility(found);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load this facility');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [facilityId]);

  const groups = facility ? groupsFor(facility) : [];

  const figures: MetroFigure[] = facility
    ? [
        {
          label: 'Occupancy',
          value: formatPercent(facility.occupancy.totalPct),
          hint: `${formatCount(facility.occupancy.rentedUnits)} units rented`,
        },
        {
          label: 'Economic occ.',
          value: formatPercent(facility.occupancy.economicPct),
          hint: `${formatPercent(facility.occupancy.totalPct)} physical`,
        },
        {
          label: 'Delinquent 30+',
          value: formatCompactMoney(facility.delinquency.amountOver30),
          hint: `${formatCount(facility.delinquency.unitsOver60)} units 60+ days late`,
          tone: facility.delinquency.amountOver30 > 0 ? 'danger' : 'neutral',
        },
        {
          label: 'NOI vs budget',
          value: formatPercent(facility.budget.noiVsBudgetPct),
          hint: formatCompactMoney(facility.budget.noiVsBudgetDol),
          tone: facility.budget.noiVsBudgetDol < 0 ? 'danger' : 'neutral',
        },
      ]
    : [];

  return (
    <MetroScreen
      eyebrow="KPI · Facility"
      title={facility?.name ?? 'Facility'}
      subtitle={facility ? `OER score ${facility.oerScore || '—'}` : undefined}
      action={<MetroButton label="‹ Facilities" variant="ghost" onPress={back} />}>
      {loading ? (
        <MetroLoading label="Loading facility" />
      ) : error ? (
        <MetroError message={error} onRetry={load} />
      ) : !facility ? (
        <MetroError
          message="This facility is no longer on the board."
          onRetry={back}
          retryLabel="Back to facilities"
        />
      ) : (
        <>
          <MetroFigures figures={figures} size="medium" />

          {groups.map((group) => (
            <View key={group.title} style={styles.section}>
              <MetroHeading>{group.title}</MetroHeading>
              <View>
                {group.metrics.map((metric, index) => (
                  <View
                    key={metric.label}
                    style={[
                      styles.row,
                      index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                    ]}>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowLabel, { color: theme.text }]}>{metric.label}</Text>
                      {metric.hint ? (
                        <Text style={[styles.rowHint, { color: theme.textDim }]}>{metric.hint}</Text>
                      ) : null}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.rowValue,
                        styles.numbers,
                        { color: metric.tone === 'danger' ? theme.danger : theme.text },
                      ]}>
                      {metric.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </>
      )}
    </MetroScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabel: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: 500,
  },
  rowHint: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  rowValue: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: 600,
    textAlign: 'right',
  },
  /** Fixed-width digits so a column of money lines up. */
  numbers: {
    fontVariant: ['tabular-nums'],
  },
});
