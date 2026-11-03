import {
  formatCompactMoney,
  formatCount,
  formatMoney,
  formatPercent,
  formatRatio,
  type KpiFacility,
} from '@/lib/kpi';

/**
 * The table's columns, in v1's order and with v1's short headers.
 *
 * Each one knows how to render a cell, what to sort by (always the raw number,
 * never the string) and what its footer cell says. v1's footer arithmetic is
 * kept: sums where a total means something, and averages across the facilities
 * that actually report a value (non-zero), which is why `averageOf` skips zeroes.
 */

export type SortValue = number | string;

export interface KpiColumn {
  key: string;
  label: string;
  /**
   * What the column counts, in v1's own words. Shown on demand from the header
   * rather than always, so the board stays numbers.
   */
  hint: string;
  /** The cell text. */
  value: (facility: KpiFacility) => string;
  /** What a header click sorts on. */
  sortValue: (facility: KpiFacility) => SortValue;
  /** True when the cell needs attention and should read in the danger colour. */
  tone?: (facility: KpiFacility) => boolean;
  /** Two lines at most — `S:` then `A:` — or null for no footer cell. */
  footer?: (facilities: KpiFacility[]) => string | null;
}

function sumOf(facilities: KpiFacility[], get: (facility: KpiFacility) => number): number {
  return facilities.reduce((total, facility) => total + get(facility), 0);
}

/** Average across facilities that report a value, the way v1's footer does. */
function averageOf(facilities: KpiFacility[], get: (facility: KpiFacility) => number): number {
  const reported = facilities.filter((facility) => get(facility) !== 0);
  if (reported.length === 0) return 0;
  return sumOf(reported, get) / reported.length;
}

/** `S: sum` over `A: average`, as the two footer lines. */
function both(
  facilities: KpiFacility[],
  get: (facility: KpiFacility) => number,
  render: (value: number) => string,
): string {
  return `S: ${render(sumOf(facilities, get))}\nA: ${render(averageOf(facilities, get))}`;
}

function averageOnly(
  facilities: KpiFacility[],
  get: (facility: KpiFacility) => number,
  render: (value: number) => string,
): string {
  return `A: ${render(averageOf(facilities, get))}`;
}

const percent = (value: number) => formatPercent(value);
const count = (value: number) => formatCount(value);
const money = (value: number) => formatMoney(value);
const compact = (value: number) => formatCompactMoney(value);

export const KPI_COLUMNS: KpiColumn[] = [
  {
    key: 'oer',
    label: 'OER Score',
    hint: 'Total score from the last Operations Excellence Review Audit',
    value: (f) => (f.oerScore ? count(f.oerScore) : '—'),
    sortValue: (f) => f.oerScore,
    footer: (list) => averageOnly(list, (f) => f.oerScore, count),
  },
  {
    key: 'storageOcc',
    label: 'Storage Unit Occ %',
    hint: 'Occupancy % of all rentable storage units',
    value: (f) => percent(f.occupancy.storagePct),
    sortValue: (f) => f.occupancy.storagePct,
    footer: (list) => averageOnly(list, (f) => f.occupancy.storagePct, percent),
  },
  {
    key: 'parkingOcc',
    label: 'Parking Unit Occ %',
    hint: 'Occupancy % of all rentable parking units',
    value: (f) => percent(f.occupancy.parkingPct),
    sortValue: (f) => f.occupancy.parkingPct,
    footer: (list) => averageOnly(list, (f) => f.occupancy.parkingPct, percent),
  },
  {
    key: 'totalOcc',
    label: 'Total Unit Occ %',
    hint: 'Occupancy % of all total rentable units',
    value: (f) => percent(f.occupancy.totalPct),
    sortValue: (f) => f.occupancy.totalPct,
    footer: (list) => averageOnly(list, (f) => f.occupancy.totalPct, percent),
  },
  {
    key: 'moveInOut',
    label: 'Move In / Out < 30',
    hint: 'Quantity of move-ins and move-outs over the last 30 days',
    value: (f) => formatRatio(f.movement.moveIns30d, f.movement.moveOuts30d),
    // v1 sorts this column on the net (in minus out).
    sortValue: (f) => f.movement.moveIns30d - f.movement.moveOuts30d,
    footer: (list) =>
      `S: ${count(sumOf(list, (f) => f.movement.moveIns30d))} / ${count(
        sumOf(list, (f) => f.movement.moveOuts30d),
      )}\nA: ${count(averageOf(list, (f) => f.movement.moveIns30d))} / ${count(
        averageOf(list, (f) => f.movement.moveOuts30d),
      )}`,
  },
  {
    key: 'overlocked',
    label: 'Overlocked Units',
    hint: 'Quantity of currently overlocked units',
    value: (f) => count(f.movement.overlockedUnits),
    sortValue: (f) => f.movement.overlockedUnits,
    footer: (list) => both(list, (f) => f.movement.overlockedUnits, count),
  },
  {
    key: 'delinquentDollars',
    label: '$ Del > 30',
    hint: 'The total of all rent owed by any tenant 30+ days delinquent',
    value: (f) => money(f.delinquency.amountOver30),
    sortValue: (f) => f.delinquency.amountOver30,
    tone: (f) => f.delinquency.amountOver30 > 0,
    footer: (list) => both(list, (f) => f.delinquency.amountOver30, money),
  },
  {
    key: 'delinquent3060',
    label: 'Units Del 30-60',
    hint: 'Total units delinquent on rent for 30-60 days',
    value: (f) => count(f.delinquency.units30to60),
    sortValue: (f) => f.delinquency.units30to60,
    footer: (list) => both(list, (f) => f.delinquency.units30to60, count),
  },
  {
    key: 'delinquent60',
    label: 'Units Del > 60',
    hint: 'Total units delinquent on rent for over 60 days',
    value: (f) => count(f.delinquency.unitsOver60),
    sortValue: (f) => f.delinquency.unitsOver60,
    footer: (list) => both(list, (f) => f.delinquency.unitsOver60, count),
  },
  {
    key: 'delinquentOccupancy',
    label: '% Occupied Del > 30',
    hint: '% of units that are 30+ days delinquent',
    value: (f) => percent(f.delinquency.occupiedOver30Pct),
    sortValue: (f) => f.delinquency.occupiedOver30Pct,
    footer: (list) => averageOnly(list, (f) => f.delinquency.occupiedOver30Pct, percent),
  },
  {
    key: 'vacantUnrentable',
    label: 'Vacant Unrentable',
    hint: 'The sum of monthly rent from all vacant and unrentable units',
    value: (f) => compact(f.revenue.vacantUnrentableRent),
    sortValue: (f) => f.revenue.vacantUnrentableRent,
    footer: (list) => both(list, (f) => f.revenue.vacantUnrentableRent, compact),
  },
  {
    key: 'economicOcc',
    label: 'Econ Occupancy %',
    hint: 'Actual Occupied Units Rates / Gross Potential Rates',
    value: (f) => percent(f.occupancy.economicPct),
    sortValue: (f) => f.occupancy.economicPct,
    footer: (list) => averageOnly(list, (f) => f.occupancy.economicPct, percent),
  },
  {
    key: 'rentVsBudget',
    label: 'Cont/Budgt Rent Delta',
    hint: 'Actual Occupied Units Rates / Month Budget Rent from Annual Budget',
    value: (f) => percent(f.revenue.contractedVsBudgetRentPct),
    sortValue: (f) => f.revenue.contractedVsBudgetRentPct,
    footer: (list) => averageOnly(list, (f) => f.revenue.contractedVsBudgetRentPct, percent),
  },
  {
    key: 'unrentable',
    label: 'Unrentable Units',
    hint: 'Units that currently cannot be leased due to damage or repairs needed',
    value: (f) => count(f.occupancy.unrentableUnits),
    sortValue: (f) => f.occupancy.unrentableUnits,
    footer: (list) => both(list, (f) => f.occupancy.unrentableUnits, count),
  },
  {
    key: 'concessions',
    label: 'Promotional Concessions < 30',
    hint: 'Total promotional concessions given over the last 30 days',
    value: (f) => money(f.revenue.concessions30d),
    sortValue: (f) => f.revenue.concessions30d,
    footer: (list) => both(list, (f) => f.revenue.concessions30d, money),
  },
  {
    key: 'waived',
    label: 'Waived Rent/Fees',
    hint: 'All credits to rent last 30 days / All credits to fees last 30 days. Shown as $ / $',
    value: (f) => `${money(f.revenue.waivedRent30d)} / ${money(f.revenue.waivedFees30d)}`,
    sortValue: (f) => f.revenue.waivedRent30d + f.revenue.waivedFees30d,
    footer: (list) =>
      `S: ${money(sumOf(list, (f) => f.revenue.waivedRent30d))} / ${money(
        sumOf(list, (f) => f.revenue.waivedFees30d),
      )}\nA: ${money(averageOf(list, (f) => f.revenue.waivedRent30d))} / ${money(
        averageOf(list, (f) => f.revenue.waivedFees30d),
      )}`,
  },
  {
    key: 'reservations',
    label: 'Reservations < 30',
    hint: 'Total amount of reservations over the last 30 days',
    value: (f) => count(f.leads.reservations30d),
    sortValue: (f) => f.leads.reservations30d,
    footer: (list) => both(list, (f) => f.leads.reservations30d, count),
  },
  {
    key: 'converted',
    label: 'Converted Leads / Inquiries < 30',
    hint: 'Converted leads over the last 30 days / inquiries over the last 30 days',
    value: (f) => formatRatio(f.leads.converted30d, f.leads.inquiries30d),
    sortValue: (f) => f.leads.converted30d,
    footer: (list) =>
      `S: ${count(sumOf(list, (f) => f.leads.converted30d))} / ${count(
        sumOf(list, (f) => f.leads.inquiries30d),
      )}\nA: ${count(averageOf(list, (f) => f.leads.converted30d))} / ${count(
        averageOf(list, (f) => f.leads.inquiries30d),
      )}`,
  },
  {
    key: 'autopay',
    label: '% Occupied Autopay',
    hint: '# units on auto pay / (Total Units – Unrentable Units)',
    value: (f) => percent(f.protection.autopayPct),
    sortValue: (f) => f.protection.autopayPct,
    footer: (list) => averageOnly(list, (f) => f.protection.autopayPct, percent),
  },
  {
    key: 'insured',
    label: '% Occupied Insured',
    hint: '# units insured / (Total Units – Unrentable Units)',
    value: (f) => percent(f.protection.insuredPct),
    sortValue: (f) => f.protection.insuredPct,
    footer: (list) => averageOnly(list, (f) => f.protection.insuredPct, percent),
  },
  {
    key: 'insuranceSold',
    label: '# Insurance Sold < 30',
    hint: '# units added to insurance over the last 30 days',
    value: (f) => count(f.protection.insuranceSold30d),
    sortValue: (f) => f.protection.insuranceSold30d,
    footer: (list) => both(list, (f) => f.protection.insuranceSold30d, count),
  },
  {
    key: 'incomeVsBudget',
    label: 'Income vs Budget %',
    hint: 'Performance of current income to budget projection',
    value: (f) => percent(f.budget.incomeVsBudgetPct),
    sortValue: (f) => f.budget.incomeVsBudgetPct,
    footer: (list) => averageOnly(list, (f) => f.budget.incomeVsBudgetPct, percent),
  },
  {
    key: 'expenseVsBudget',
    label: 'Expense vs Budget %',
    hint: 'Performance of current expenses to budget projection',
    value: (f) => percent(f.budget.expensesVsBudgetPct),
    sortValue: (f) => f.budget.expensesVsBudgetPct,
    footer: (list) => averageOnly(list, (f) => f.budget.expensesVsBudgetPct, percent),
  },
  {
    key: 'noiVsBudgetPct',
    label: 'NOI vs Budget %',
    hint: 'Performance of current NOI to budget projection',
    value: (f) => percent(f.budget.noiVsBudgetPct),
    sortValue: (f) => f.budget.noiVsBudgetPct,
    footer: (list) => averageOnly(list, (f) => f.budget.noiVsBudgetPct, percent),
  },
  {
    key: 'noiVsBudgetDollars',
    label: 'NOI vs Budget $',
    hint: 'Performance of current NOI to budget projection',
    value: (f) => compact(f.budget.noiVsBudgetDol),
    sortValue: (f) => f.budget.noiVsBudgetDol,
    tone: (f) => f.budget.noiVsBudgetDol < 0,
    footer: (list) => both(list, (f) => f.budget.noiVsBudgetDol, compact),
  },
];

export interface KpiSort {
  /** A column key, or `name` for the facility column. */
  key: string;
  direction: 'asc' | 'desc';
}

export const DEFAULT_SORT: KpiSort = { key: 'name', direction: 'asc' };

/** The rows in display order. Facility names sort as names, everything else by number. */
export function sortFacilities(facilities: KpiFacility[], sort: KpiSort): KpiFacility[] {
  const column = KPI_COLUMNS.find((entry) => entry.key === sort.key);
  const sign = sort.direction === 'asc' ? 1 : -1;

  return [...facilities].sort((a, b) => {
    if (!column) {
      return sign * a.name.localeCompare(b.name, 'en', { numeric: true });
    }

    const left = column.sortValue(a);
    const right = column.sortValue(b);

    if (typeof left === 'string' || typeof right === 'string') {
      return sign * String(left).localeCompare(String(right), 'en', { numeric: true });
    }
    if (left === right) return 0;
    return sign * (left < right ? -1 : 1);
  });
}

/** The next sort when a header is tapped: same column flips, a new one starts ascending. */
export function nextSort(current: KpiSort, key: string): KpiSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'asc' };
}
