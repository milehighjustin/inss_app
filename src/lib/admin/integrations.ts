import { apiFetch } from '@/lib/api/client';

/**
 * The admin panel's integrations.
 *
 * Two of them, and they connect in different ways, which the panel does not try
 * to hide:
 *
 * - **QuickBooks** is a browser errand. The API answers with Intuit's authorize
 *   URL (carrying a short-lived signed state), the browser finishes the flow, and
 *   the callback stores the tokens. The app only ever sees status.
 * - **PDK** is deployment configuration: the API client credentials live in the
 *   server's environment, so there is nothing to click. The app reads the system
 *   and, when it is connected, the doors and holders.
 */

export interface IntegrationSummary {
  id: string;
  name: string;
  /** One line: what the integration is for. */
  summary: string;
  connected: boolean;
  /** The company or system name, when there is one. */
  detail: string | null;
  needsAttention: string | null;
  checkedAt: string;
}

export async function listIntegrations(): Promise<IntegrationSummary[]> {
  const { integrations } = await apiFetch<{ integrations: IntegrationSummary[] }>(
    '/api/mobile/admin/integrations',
  );
  return integrations;
}

export interface IntegrationStatus {
  id: string;
  name: string;
  /** A stored connection exists; `needsAttention` says whether it still works. */
  connected: boolean;
  realmId: string | null;
  /** Read live from QuickBooks, so it also proves the tokens still work. */
  companyName: string | null;
  connectedAt: string | null;
  connectedBy: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  /** A sentence to show when something needs doing, otherwise null. */
  needsAttention: string | null;
  checkedAt: string;
}

export interface ConnectLink {
  url: string;
  expiresOn: string;
}

export async function fetchQuickBooks(): Promise<IntegrationStatus> {
  const { integration } = await apiFetch<{ integration: IntegrationStatus }>(
    '/api/mobile/admin/integrations/quickbooks',
  );
  return integration;
}

/** Where to send the browser to connect (or renew) the QuickBooks link. */
export function requestQuickBooksConnect(): Promise<ConnectLink> {
  return apiFetch<ConnectLink>('/api/mobile/admin/integrations/quickbooks/connect', {
    method: 'POST',
  });
}

export interface PdkStatus {
  id: string;
  name: string;
  /** The deployment variables are present. */
  configured: boolean;
  /** An administrator has chosen which system to work on. */
  systemSelected: boolean;
  /** PDK answered with a system token and a system record. */
  connected: boolean;
  systemId: string | null;
  systemName: string | null;
  organizationId: string | null;
  selectedBy: string | null;
  selectedAt: string | null;
  doors: { shown: number; total: number | null };
  holders: { shown: number; total: number | null };
  needsAttention: string | null;
  checkedAt: string;
}

/** One system the API client can reach, as PDK lists it. */
export interface PdkSystemChoice {
  systemId: string;
  name: string;
  organizationId: string | null;
  cloudNodes: number;
}

/** A door's live state, as its cloud node last reported it. */
export interface PdkDoorState {
  relayOpen?: boolean;
  dpsOpen?: boolean;
  forcedAlarmOn?: boolean;
  propAlarmOn?: boolean;
  communicationLost?: boolean;
  controllerIssues?: boolean;
}

export interface PdkDoor {
  id: string;
  name?: string;
  type?: string;
  publicIcon?: string;
  cloudNodeId: string | null;
  cloudNodeName: string | null;
  /** Null when the node did not answer. */
  state: PdkDoorState | null;
}

export interface PdkHolder {
  id: string;
  name: string;
  email: string | null;
  enabled: boolean;
  expireDate: string | null;
  groups: string[];
  credentials: number;
}

export async function fetchPdk(): Promise<PdkStatus> {
  const { integration } = await apiFetch<{ integration: PdkStatus }>(
    '/api/mobile/admin/integrations/pdk',
  );
  return integration;
}

/** The systems this API client can reach, for the picker. */
export async function fetchPdkSystems(): Promise<PdkSystemChoice[]> {
  const { systems } = await apiFetch<{ systems: PdkSystemChoice[] }>(
    '/api/mobile/admin/integrations/pdk/systems',
  );
  return systems;
}

/** Remembers the choice on the server; confirmed against PDK first. */
export async function selectPdkSystem(systemId: string): Promise<PdkStatus> {
  const { integration } = await apiFetch<{ integration: PdkStatus }>(
    '/api/mobile/admin/integrations/pdk/system',
    { method: 'POST', body: JSON.stringify({ systemId }) },
  );
  return integration;
}

export function fetchPdkDoors(): Promise<{ doors: PdkDoor[]; total: number | null }> {
  return apiFetch<{ doors: PdkDoor[]; total: number | null }>(
    '/api/mobile/admin/integrations/pdk/doors',
  );
}

/** Opens one door now. The server derives the cloud node from the door. */
export function openPdkDoor(deviceId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(
    `/api/mobile/admin/integrations/pdk/doors/${encodeURIComponent(deviceId)}/open`,
    { method: 'POST' },
  );
}

export function fetchPdkHolders(search = ''): Promise<{ holders: PdkHolder[]; total: number | null }> {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return apiFetch<{ holders: PdkHolder[]; total: number | null }>(
    `/api/mobile/admin/integrations/pdk/holders${query}`,
  );
}

/**
 * A door's state in one word, for a badge.
 *
 * `Open` is the relay being energised; `Held open` is the door position sensor,
 * which is the one somebody left propped. Unreachable is its own state: a node
 * that has stopped answering is not a closed door.
 */
export function doorStateLabel(door: PdkDoor): { label: string; tone: 'accent' | 'danger' | 'neutral' } {
  const state = door.state;
  if (!state) return { label: 'No report', tone: 'neutral' };
  if (state.communicationLost) return { label: 'Offline', tone: 'danger' };
  if (state.forcedAlarmOn) return { label: 'Forced', tone: 'danger' };
  if (state.propAlarmOn) return { label: 'Held open', tone: 'danger' };
  if (state.relayOpen) return { label: 'Open', tone: 'accent' };
  if (state.controllerIssues) return { label: 'Issue', tone: 'danger' };
  return { label: 'Closed', tone: 'neutral' };
}
