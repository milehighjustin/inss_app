import { apiFetch } from '@/lib/api/client';

/**
 * The Investor Portal's admin data.
 *
 * Mirrors v1's `lib/ip/*` actions: who is an investor, which QuickBooks equity
 * accounts they are associated with, how that money is spread across properties,
 * and every investment in the book for the Equity tab.
 */

export interface AdminInvestor {
  userId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  active: boolean;
  lastLogin: string | null;
  /** QuickBooks equity account ids this investor is associated with. */
  investments: string[];
  investmentCount: number;
}

export interface EquityAccount {
  id: string;
  name: string;
}

export interface AdminInvestment {
  account: string;
  accountName: string;
  locationId: string;
  locationName: string;
  amount: number;
}

export interface InvestorHolding {
  locationId: string;
  locationName: string;
  amount: number;
}

export interface InvestorView {
  investor: AdminInvestor;
  holdings: InvestorHolding[];
  totalInvested: number;
}

export async function listInvestors(): Promise<AdminInvestor[]> {
  const { investors } = await apiFetch<{ investors: AdminInvestor[] }>(
    '/api/mobile/admin/investors',
  );
  return investors;
}

export async function listEquityAccounts(): Promise<EquityAccount[]> {
  const { accounts } = await apiFetch<{ accounts: EquityAccount[] }>(
    '/api/mobile/admin/investors/equity-accounts',
  );
  return accounts;
}

export async function fetchInvestorView(userId: string): Promise<InvestorView> {
  const { view } = await apiFetch<{ view: InvestorView }>(
    `/api/mobile/admin/investors/${encodeURIComponent(userId)}`,
  );
  return view;
}

/**
 * Replaces an investor's association list.
 *
 * The API creates the investor's record on first save, so an account can be
 * given the investor role before its equity is set up.
 */
export async function saveInvestments(
  userId: string,
  investments: string[],
): Promise<AdminInvestor> {
  const { investor } = await apiFetch<{ investor: AdminInvestor }>(
    `/api/mobile/admin/investors/${encodeURIComponent(userId)}/investments`,
    { method: 'PUT', body: { investments } },
  );
  return investor;
}

export async function listInvestments(): Promise<AdminInvestment[]> {
  const { investments } = await apiFetch<{ investments: AdminInvestment[] }>(
    '/api/mobile/admin/investments',
  );
  return investments;
}

/** "$1,234,567" — the admin screens show amounts, not raw numbers. */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}
