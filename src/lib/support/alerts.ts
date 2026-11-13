import { apiFetch } from '@/lib/api/client';

/**
 * Alerts, and what became of each.
 *
 * One row per alert however many people it reached. The desk reads the ones
 * addressed to the person's tags and can still take the ones inside the five
 * minutes; admin Support reads all of them and asks the questions a supervisor
 * asks — who answered, how fast, and whether it became a call.
 *
 * `action` is the verdict, not the raw events: somebody answering outranks
 * somebody dismissing, and an alert nobody touched stops being `waiting` the
 * moment its five minutes are up.
 */

export type AlertAction = 'answered' | 'ignored' | 'expired' | 'waiting';
export type AlertActionFilter = AlertAction | 'all';

export interface AlertCall {
  /** Seconds on the line, or null while it is still running. */
  seconds: number | null;
  startedAt: string;
}

export interface AlertRow {
  notificationId: string;
  title: string;
  body: string;
  priority: 'loud' | 'quiet';
  qrCodeId?: string;
  qrCodeName?: string;
  locationId?: string;
  locationName?: string;
  tags: string[];
  createdAt: string;
  ageSeconds: number;
  action: AlertAction;
  answeredBy?: string;
  answeredById?: string;
  /** Ring to answer, in seconds. */
  answerSeconds?: number | null;
  /** How many accounts it was offered to, and how many were held on a call. */
  offered: number;
  held: number;
  call?: AlertCall;
  /** What the viewer did, when they are a support account. */
  mine: 'answered' | 'ignored' | null;
  /** True when the viewer could still take it. */
  canAccept: boolean;
}

export interface AlertPage {
  alerts: AlertRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Answers per person in the window, for the person filter. */
  people: { userId: string; name: string; answered: number }[];
  /** How many rows each action would show under the current search. */
  counts: Record<AlertActionFilter, number>;
}

/** The page size both alert lists use. */
export const ALERTS_PAGE_SIZE = 25;

/** The list of every alert addressed to this account, newest first. */
export function fetchMyAlerts(
  options: { page?: number; pageSize?: number } = {},
): Promise<AlertPage> {
  const query = new URLSearchParams();
  if (options.page && options.page > 1) query.set('page', String(options.page));
  if (options.pageSize) query.set('pageSize', String(options.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiFetch<AlertPage>(`/api/mobile/support/alerts${suffix}`);
}

/** Every alert, for Admin → Support. Search, action, answerer and range. */
export function fetchAdminAlerts(
  options: {
    page?: number;
    pageSize?: number;
    q?: string;
    action?: AlertActionFilter;
    answeredBy?: string;
    days?: number;
  } = {},
): Promise<AlertPage> {
  const query = new URLSearchParams();
  if (options.page && options.page > 1) query.set('page', String(options.page));
  if (options.pageSize) query.set('pageSize', String(options.pageSize));
  if (options.q) query.set('q', options.q);
  if (options.action && options.action !== 'all') query.set('action', options.action);
  if (options.answeredBy) query.set('answeredBy', options.answeredBy);
  if (options.days) query.set('days', String(options.days));
  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiFetch<AlertPage>(`/api/mobile/admin/support/alerts${suffix}`);
}

/** Takes an alert from the list, recording the answer against this person. */
export async function claimAlert(notificationId: string): Promise<void> {
  await apiFetch<{ alert: unknown }>(
    `/api/mobile/support/alerts/${encodeURIComponent(notificationId)}/claim`,
    { method: 'POST' },
  );
}

/** How an alert ended, in a word a supervisor can read. */
export function actionLabel(action: AlertAction): string {
  switch (action) {
    case 'answered':
      return 'Answered';
    case 'ignored':
      return 'Ignored';
    case 'expired':
      return 'Expired unanswered';
    case 'waiting':
    default:
      return 'Waiting';
  }
}

/** What this person can say about the row: their own action beats anyone's. */
export function alertOutcome(row: AlertRow): string {
  if (row.mine === 'answered') return 'You answered';
  if (row.mine === 'ignored') return 'You ignored it';
  if (row.action === 'answered') {
    return row.answeredBy ? `Answered by ${row.answeredBy}` : 'Answered';
  }
  if (row.action === 'ignored') return 'Ignored by everyone it reached';
  if (row.action === 'expired') return 'Nobody answered in time';
  return 'Nobody has answered yet';
}

/** `just now`, `2m ago`, `1h 5m ago` — how long an alert has been up. */
export function ageLabel(seconds: number): string {
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;

  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}
