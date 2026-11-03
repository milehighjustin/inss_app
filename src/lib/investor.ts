import { apiFetch } from '@/lib/api/client';

/**
 * The investor portal's data layer.
 *
 * The API sends the same numbers v1's `prepareInvestor` computed on the server —
 * one payload with the investor's properties, their own totals and the
 * organization-wide totals that sit beside them in v1's tables.
 */

export interface InvestorEquityAccount {
  name: string;
  amount: number;
}

export interface InvestorLocation {
  id: string;
  internalId: string;
  name: string;
  departmentName: string;
  departmentId: string;
  address: { city?: string; region?: string };
  acquisitionDate: string;
  status: string;
  valuationDate: string;
  loanInterestRate: number;
  loanMaturityDate: string;
  storageSF: number;
  totalArea: number;
  closingCostPct: number;
  issPromote: number;
  propertyValue: number;
  loanBalance: number;
  operatingCashReserves: number;
  projectedCapitalCalls: number;
  budgetOccupancy: number;
  occupiedAreaPct: number;
  occupiedStorageSfPct: number;
  occupancyPct: number;
  absorption30: number;
  gt30delinquent: number;
  incomeVsBudgetPct: number;
  expensesVsBudgetPct: number;
  noiVsBudgetPct: number;
  noiVsBudgetDol: number;
  notes: { content: string; createdAt: string }[];
  equity: {
    initialInvestmentDol: number;
    changeInEquity: number;
    investorInvestedTotal: number;
    investorInvestmentValueDol: number;
    totalDividendsPaid: number;
    lastDividendAnn: number;
    lastDividendDol: number;
    lastDividendPct: number;
    investorSharePct: number;
    pctTotalInvestment: number;
    equityExposure: number;
    netSalesProceeds: number;
    netInvestorProceeds: number;
    projectedCapitalCallsDol: number;
    totalInvested: number;
    cumulativeByAccount: InvestorEquityAccount[];
  };
}

export interface InvestorPortfolio {
  budgetOccupancy: number;
  storageSfOcc: number;
  occupiedStorageSfPct: number;
  totalUnitOcc: number;
  absorption30: number;
  gt30delinquent: number;
  incomeVsBudgetPct: number;
  expensesVsBudgetPct: number;
  noiVsBudgetPct: number;
  noiVsBudgetDol: number;
  totalDealEquity: number;
  initialInvestmentDol: number;
  investorSharePct: number;
  investorInvestedTotal: number;
  pctTotalInvestment: number;
  projectedCapitalCalls: number;
  propertyValue: number;
  loanBalance: number;
  estimatedClosingCosts: number;
  netSalesProceeds: number;
  issPromote: number;
  netInvestorProceeds: number;
  investorInvestmentValueDol: number;
  equityExposure: number;
  totalDividendsPaid: number;
  lastDividendDol: number;
  storageSF: number;
  totalArea: number;
}

export interface InvestorData {
  locations: InvestorLocation[];
  portfolio: InvestorPortfolio;
  organizationPortfolio: InvestorPortfolio;
}

export interface InvestorFile {
  id: string;
  name: string;
  folder: string;
  blobName: string;
  container: string;
  createdAt: string | null;
}

/**
 * An administrator looking at someone else's portal, as v1's "Investor View"
 * tab did from the investor's admin page.
 *
 * Only the id is needed to fetch; the name is carried along so every preview
 * screen can say whose portal it is showing.
 */
export interface InvestorTarget {
  userId: string;
  name: string;
}

/**
 * Where a portal read goes: the signed-in investor's own routes, or the admin
 * preview of one investor's portal.
 *
 * The two sets return the same shapes from the same functions on the API; only
 * the gate differs, which is why nothing below has to know who is asking.
 */
function portalBase(asUserId?: string): string {
  return asUserId
    ? `/api/mobile/admin/investors/${encodeURIComponent(asUserId)}`
    : '/api/mobile/investor';
}

export function loadInvestor(asUserId?: string): Promise<InvestorData> {
  return apiFetch<InvestorData>(asUserId ? `${portalBase(asUserId)}/portfolio` : portalBase());
}

export async function loadInvestorFiles(asUserId?: string): Promise<InvestorFile[]> {
  const body = await apiFetch<{ files: InvestorFile[] }>(`${portalBase(asUserId)}/files`);
  return body.files;
}

/**
 * A short-lived signed URL for one document.
 *
 * The API checks the file is one this investor may see before signing, so the
 * app never holds a container-wide or long-lived URL.
 */
export function investorFileUrl(
  fileId: string,
  asUserId?: string,
): Promise<{ url: string; expiresOn: string }> {
  return apiFetch<{ url: string; expiresOn: string }>(
    `${portalBase(asUserId)}/files/${encodeURIComponent(fileId)}/url`,
  );
}

/**
 * v1's number formatting, kept so the portal reads the same as the website.
 *
 * Zero and missing values print as a dash rather than `$0`: in this portal a
 * dash means "no figure for this property", which is not the same as zero money.
 */

export function investorMoney(value: number | string | null | undefined): string {
  const amount = Number(value);
  if (!value || Number.isNaN(amount)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function investorPct(value: number | string | null | undefined, digits = 1): string {
  const amount = Number(value);
  if (!value || Number.isNaN(amount)) return '-';
  return `${amount.toFixed(digits)}%`;
}

export function investorNumber(value: number | string | null | undefined): string {
  const amount = Number(value);
  if (!value || Number.isNaN(amount)) return '-';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

/**
 * Money with an explicit sign, for a change rather than a balance: `+$12,345`.
 *
 * A zero change prints as a dash like every other missing figure, so a line
 * that did not move does not read as a gain.
 */
export function investorSignedMoney(value: number | string | null | undefined): string {
  const amount = Number(value);
  if (!value || Number.isNaN(amount) || amount === 0) return '-';
  return `${amount > 0 ? '+' : '−'}${investorMoney(Math.abs(amount))}`;
}

/** `+12.3%` — a change in percent, with the same signing rules as money. */
export function investorSignedPct(value: number | string | null | undefined, digits = 1): string {
  const amount = Number(value);
  if (!value || Number.isNaN(amount) || amount === 0) return '-';
  return `${amount > 0 ? '+' : '−'}${Math.abs(amount).toFixed(digits)}%`;
}

/** `-` + money, as v1 prints closing costs and the ISS promote. */
export function investorNegatedMoney(value: number | string | null | undefined): string {
  const formatted = investorMoney(value);
  return formatted === '-' ? formatted : `-${formatted}`;
}

export function investorDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
}

/**
 * The date the portfolio's values were struck: the latest valuation date
 * across its properties, or null when none is recorded.
 *
 * An investor needs to know how fresh these figures are before they read them,
 * so the portfolio header says it once rather than leaving it to per-property
 * detail.
 */
export function portfolioAsOf(data: InvestorData): string | null {
  const dated = data.locations
    .filter((location) => location.valuationDate)
    .map((location) => ({ value: location.valuationDate, time: new Date(location.valuationDate).getTime() }))
    .filter((entry) => !Number.isNaN(entry.time));

  if (dated.length === 0) return null;
  return dated.sort((left, right) => right.time - left.time)[0].value;
}

/** The share of the portfolio a property represents, as a whole percent. */
export function allocationShare(location: InvestorLocation): number {
  return Number(location.equity.pctTotalInvestment) || 0;
}
