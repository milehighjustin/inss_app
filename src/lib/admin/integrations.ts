import { apiFetch } from '@/lib/api/client';

/**
 * The admin panel's integrations.
 *
 * QuickBooks connects through the browser: the API answers with Intuit's
 * authorize URL (carrying a short-lived signed state), the browser finishes the
 * flow, and the callback stores the tokens. The app only ever sees status.
 */

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
