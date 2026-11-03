import { apiFetch } from '@/lib/api/client';

/**
 * The investor reports, as the API builds them.
 *
 * The API returns a document — title, ranges and tables of already-formatted
 * cells — and the same document as printable HTML. The screen draws the tables;
 * the PDF button posts the HTML to the one PDF endpoint, so the printed report
 * and the one on screen never disagree.
 */

export const REPORT_KINDS = ['profit-loss', 'budget-vs-actual'] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_TITLES: Record<ReportKind, string> = {
  'profit-loss': 'Profit & Loss',
  'budget-vs-actual': 'Budget vs Actuals',
};

/**
 * The report buttons on a property. v1 also offered a Management Summary; it
 * read from SiteLink, which is gone, and its replacement (the Cubby API) is not
 * wired up yet — see MIGRATION.md.
 */
export const REPORT_MENU: { kind: ReportKind; label: string }[] = [
  { kind: 'profit-loss', label: 'Profit And Loss' },
  { kind: 'budget-vs-actual', label: 'Budget Vs Actuals' },
];

export function isReportKind(value: unknown): value is ReportKind {
  return typeof value === 'string' && (REPORT_KINDS as readonly string[]).includes(value);
}

export interface ReportRow {
  label: string;
  /** One per column of its table, formatted by the API. */
  values: string[];
  /** Summary lines print heavier; the bottom line gets the heaviest rule. */
  emphasis?: 'strong' | 'final';
  /** 1 for an account inside a group, so it indents under it. */
  level?: number;
}

export interface ReportTable {
  title?: string;
  columns: string[];
  rows: ReportRow[];
}

export interface ReportDocument {
  kind: ReportKind;
  title: string;
  company: string;
  property: string;
  /** `YYYY-MM-DD` */
  start: string;
  end: string;
  generatedAt: string;
  tables: ReportTable[];
  /** The printable page, for the PDF endpoint. */
  html: string;
}

export interface ReportRange {
  start: string;
  end: string;
}

/**
 * One report, for one property the investor holds.
 *
 * Without a range the API answers with v1's default window for that report and
 * the dates it used, which is what fills the two date fields on first open.
 *
 * `asUserId` asks for the same report through the admin preview of that
 * investor's portfolio, which is how an administrator sees what they see.
 */
export async function loadReport(
  locationId: string,
  kind: ReportKind,
  range?: ReportRange,
  asUserId?: string,
): Promise<ReportDocument> {
  const query = range ? `?start=${range.start}&end=${range.end}` : '';
  const base = asUserId
    ? `/api/mobile/admin/investors/${encodeURIComponent(asUserId)}`
    : '/api/mobile/investor';

  const body = await apiFetch<{ report: ReportDocument }>(
    `${base}/locations/${encodeURIComponent(locationId)}/reports/${kind}${query}`,
  );
  return body.report;
}

/** v1's date format for the fields and the header: `2025-09-30`. */
export function reportDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function reportRangeLabel(document: Pick<ReportDocument, 'start' | 'end'>): string {
  return `${reportDate(document.start)} – ${reportDate(document.end)}`;
}

/** A file name the PDF endpoint accepts and a share sheet can show. */
export function reportFileName(document: Pick<ReportDocument, 'property' | 'title'>): string {
  return `${document.property} - ${document.title}`.replace(/[\\/:*?"<>|]/g, '-');
}
