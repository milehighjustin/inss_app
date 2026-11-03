import { apiFetch } from '@/lib/api/client';

/**
 * The KPI board's data layer.
 *
 * One call returns every active facility with the metrics v1's table shows. The
 * API sends numbers, not formatted strings: the app decides how they read on a
 * phone, which is why v1's "S:"/"A:" footer arithmetic has no equivalent here.
 */

export interface KpiFacility {
  id: string;
  name: string;
  oerScore: number;
  occupancy: {
    storagePct: number;
    parkingPct: number;
    totalPct: number;
    economicPct: number;
    rentedUnits: number;
    unrentableUnits: number;
  };
  movement: {
    moveIns30d: number;
    moveOuts30d: number;
    overlockedUnits: number;
  };
  delinquency: {
    amountOver30: number;
    units30to60: number;
    unitsOver60: number;
    occupiedOver30Pct: number;
  };
  revenue: {
    vacantUnrentableRent: number;
    concessions30d: number;
    waivedRent30d: number;
    waivedFees30d: number;
    contractedVsBudgetRentPct: number;
  };
  leads: {
    reservations30d: number;
    inquiries30d: number;
    converted30d: number;
  };
  protection: {
    autopayPct: number;
    insuredPct: number;
    insuranceSold30d: number;
  };
  budget: {
    incomeVsBudgetPct: number;
    expensesVsBudgetPct: number;
    noiVsBudgetPct: number;
    noiVsBudgetDol: number;
  };
}

export async function loadKpi(): Promise<KpiFacility[]> {
  const { facilities } = await apiFetch<{ facilities: KpiFacility[] }>('/api/mobile/kpi');
  return facilities;
}

export async function findFacility(facilityId: string): Promise<KpiFacility | null> {
  const facilities = await loadKpi();
  return facilities.find((facility) => facility.id === facilityId) ?? null;
}

/**
 * A named subset of facilities, the same document v1's board saves in
 * `loglady.savedKpiLists`. Everyone sees the same lists; they are not per user.
 */
export interface SavedKpiList {
  id: string;
  name: string;
  facilityIds: string[];
}

export async function loadSavedLists(): Promise<SavedKpiList[]> {
  const { lists } = await apiFetch<{ lists: SavedKpiList[] }>('/api/mobile/kpi/lists');
  return lists;
}

export async function createSavedList(name: string, facilityIds: string[]): Promise<SavedKpiList> {
  const { list } = await apiFetch<{ list: SavedKpiList }>('/api/mobile/kpi/lists', {
    method: 'POST',
    body: { name, facilityIds },
  });
  return list;
}

export async function deleteSavedList(listId: string): Promise<void> {
  await apiFetch<{ deleted: true }>(`/api/mobile/kpi/lists/${encodeURIComponent(listId)}`, {
    method: 'DELETE',
  });
}

export function searchFacilities(facilities: KpiFacility[], query: string): KpiFacility[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return facilities;
  return facilities.filter((facility) => facility.name.toLowerCase().includes(clean));
}

/**
 * Formatting, done by hand rather than with `Intl` so iOS, Android and web all
 * print the same thing.
 */

/** `1,234` — grouped thousands, no decimals unless asked for. */
function grouped(value: number, digits = 0): string {
  const rounded = Number.isFinite(value) ? value.toFixed(digits) : '0';
  const [whole, fraction] = rounded.split('.');
  const sign = whole.startsWith('-') ? '-' : '';
  const digitsOnly = sign ? whole.slice(1) : whole;
  const withCommas = digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${withCommas}${fraction ? `.${fraction}` : ''}`;
}

/** `84.5%`. Percentages arrive already multiplied by 100. */
export function formatPercent(value: number, digits = 1): string {
  const trimmed = digits === 1 && Number.isInteger(value) ? 0 : digits;
  return `${grouped(value, trimmed)}%`;
}

/** `$5,938` — whole dollars, because cents are noise at this size. */
export function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${grouped(Math.abs(value))}`;
}

/** `$5.9k`, `-$1.6k`, `$2.4m` — for rows where width is tight. */
export function formatCompactMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  const size = Math.abs(value);
  if (size >= 1_000_000) return `${sign}$${grouped(size / 1_000_000, 1)}m`;
  if (size >= 1_000) return `${sign}$${grouped(size / 1_000, 1)}k`;
  return `${sign}$${grouped(size)}`;
}

/** `1,234 units`. */
export function formatCount(value: number): string {
  return grouped(value);
}

/** `1 / 6` — a ratio the way v1 writes it. */
export function formatRatio(part: number, whole: number): string {
  return `${grouped(part)} / ${grouped(whole)}`;
}
