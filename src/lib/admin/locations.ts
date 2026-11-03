import { apiFetch } from '@/lib/api/client';

/**
 * Locations, as the admin console edits them.
 *
 * One record feeds both admin areas, so this one client serves the KPI panel
 * (the `kpiActive` switch and the OER score) and the Investor Portal panel (the
 * manual inputs, the QuickBooks department link, the status and the notes).
 * Field names and validation are the API's — it owns `loglady.locations`.
 */

export interface LocationNote {
  id: string;
  content: string;
  createdAt: string;
  createdByName: string | null;
}

export interface AdminLocation {
  id: string;
  internalId: string;
  name: string;
  departmentName: string;
  departmentId: string;
  status: string;
  /** The year's operational excellence review score; `null` when unscored. */
  oerScore: number | null;
  /** On the KPI board and in the app's KPI section. */
  kpiActive: boolean;
  propertyValue: number;
  acquisitionDate: string;
  valuationDate: string;
  budgetOccupancy: number;
  operatingCashReserves: number;
  loanInterestRate: number;
  loanMaturityDate: string;
  issPromote: number;
  projectedCapitalCalls: number;
  closingCostPct: number;
  notes: LocationNote[];
}

/** v1's status list, in its order. */
export const LOCATION_STATUSES = [
  'Stable',
  'Lease Up',
  'In Conversion',
  'In Development',
  'Value Add',
  'Other',
  'Inactive',
] as const;

export const LOCATION_STATUS_OPTIONS = LOCATION_STATUSES.map((status) => ({
  value: status,
  label: status,
}));

export interface Department {
  id: string;
  name: string;
}

/** The bits of a location the console may change. */
export type LocationPatch = Partial<
  Pick<
    AdminLocation,
    | 'internalId'
    | 'acquisitionDate'
    | 'valuationDate'
    | 'budgetOccupancy'
    | 'propertyValue'
    | 'operatingCashReserves'
    | 'loanInterestRate'
    | 'loanMaturityDate'
    | 'issPromote'
    | 'projectedCapitalCalls'
    | 'closingCostPct'
    | 'status'
    | 'kpiActive'
    | 'oerScore'
  >
> & {
  departmentId?: string;
  departmentName?: string;
};

export async function listLocations(): Promise<AdminLocation[]> {
  const { locations } = await apiFetch<{ locations: AdminLocation[] }>(
    '/api/mobile/admin/locations',
  );
  return locations;
}

/** One location with its notes (the list comes back without them). */
export async function fetchLocation(locationId: string): Promise<AdminLocation> {
  const { location } = await apiFetch<{ location: AdminLocation }>(
    `/api/mobile/admin/locations/${encodeURIComponent(locationId)}`,
  );
  return location;
}

export async function updateLocation(
  locationId: string,
  patch: LocationPatch,
): Promise<AdminLocation> {
  const { location } = await apiFetch<{ location: AdminLocation }>(
    `/api/mobile/admin/locations/${encodeURIComponent(locationId)}`,
    { method: 'PATCH', body: patch },
  );
  return location;
}

export async function addLocationNote(locationId: string, content: string): Promise<LocationNote> {
  const { note } = await apiFetch<{ note: LocationNote }>(
    `/api/mobile/admin/locations/${encodeURIComponent(locationId)}/notes`,
    { method: 'POST', body: { content } },
  );
  return note;
}

export async function deleteLocationNote(locationId: string, noteId: string): Promise<void> {
  await apiFetch(
    `/api/mobile/admin/locations/${encodeURIComponent(locationId)}/notes/${encodeURIComponent(noteId)}`,
    { method: 'DELETE' },
  );
}

/** The QuickBooks departments the link picker offers. */
export async function listDepartments(): Promise<Department[]> {
  const { departments } = await apiFetch<{ departments: Department[] }>(
    '/api/mobile/admin/quickbooks/departments',
  );
  return departments;
}

/** "$1,234,567" — the console shows amounts, not raw numbers. */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

/** A stored date as `YYYY-MM-DD`, which is what the date fields expect. */
export function dateValue(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}
