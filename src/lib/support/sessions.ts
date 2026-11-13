import { apiFetch } from '@/lib/api/client';

/**
 * Support sessions, from the app's side.
 *
 * A session is a shift: it says "I am on the desk now". Two consequences the app
 * cares about — the person hears the alerts their tags address only while one is
 * open, and every number on the panel is cut to the window the session covers.
 *
 * The metrics are read from the activity log on the server, so they are the same
 * figures the performance report shows, not a second count kept beside them.
 */

export interface SessionMetrics {
  offered: number;
  /** Alerts that arrived while they were on a call, and rang afterwards. */
  held: number;
  answered: number;
  ignored: number;
  /** Offered but never answered or ignored. */
  missed: number;
  answerRate: number | null;
  medianAnswerSeconds: number | null;
  averageAnswerSeconds: number | null;
  calls: number;
  talkSeconds: number;
  /** Distinct alerts that reached them during the shift. */
  notifications: number;
  /** Alerts they clicked: answered plus ignored. */
  clicked: number;
  /** Answers picked up from the desk list after the alert had already rung. */
  claimed: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
}

export type SessionEndReason = 'ended' | 'replaced' | 'deactivated' | 'role-removed';

export interface SupportSession {
  sessionId: string;
  userId: string;
  name: string;
  roles: string[];
  /** The tags this person was listening for when the shift began. */
  tags: string[];
  startedAt: string;
  endedAt: string | null;
  endedReason?: SessionEndReason;
  active: boolean;
  /** Seconds so far, or the whole shift once it has ended. */
  durationSeconds: number;
  metrics: SessionMetrics;
}

/** One page of shift history, and how many shifts there are in all. */
export interface SessionPage {
  sessions: SupportSession[];
  total: number;
  page: number;
  pageSize: number;
}

/** The page size the desk and the admin list share. */
export const SESSIONS_PAGE_SIZE = 25;

/** The shift this account has open, or null. */
export async function fetchMySession(): Promise<SupportSession | null> {
  const { session } = await apiFetch<{ session: SupportSession | null }>('/api/mobile/support/session');
  return session;
}

/**
 * Starts a shift, ending any that was already open.
 *
 * `replaced` says a shift was running and this one took over, which the panel
 * reports rather than silently resetting the clock.
 */
export function startSession(): Promise<{ session: SupportSession; replaced: boolean }> {
  return apiFetch<{ session: SupportSession; replaced: boolean }>('/api/mobile/support/sessions', {
    method: 'POST',
  });
}

/** Ends this account's shift. Null when there was nothing to end. */
export async function endSession(): Promise<SupportSession | null> {
  const { session } = await apiFetch<{ session: SupportSession | null }>(
    '/api/mobile/support/sessions/end',
    { method: 'POST' },
  );
  return session;
}

/** Everyone on duty now, longest-serving first. Staff only. */
export async function fetchActiveSessions(): Promise<SupportSession[]> {
  const { sessions } = await apiFetch<{ sessions: SupportSession[] }>(
    '/api/mobile/support/sessions/active',
  );
  return sessions;
}

/**
 * Past and current shifts, newest first, one page at a time.
 *
 * A support account gets its own history whatever it asks for; a manager,
 * supervisor or administrator can narrow the list to one person with `userId`.
 */
export function fetchSessions(
  options: { userId?: string; page?: number; pageSize?: number } = {},
): Promise<SessionPage> {
  const query = new URLSearchParams();
  if (options.userId) query.set('userId', options.userId);
  if (options.page && options.page > 1) query.set('page', String(options.page));
  if (options.pageSize) query.set('pageSize', String(options.pageSize));

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<SessionPage>(`/api/mobile/support/sessions${suffix}`);
}

/** One shift. Staff read anyone's; a support account reads its own. */
export async function fetchSession(sessionId: string): Promise<SupportSession> {
  const { session } = await apiFetch<{ session: SupportSession }>(
    `/api/mobile/support/sessions/${encodeURIComponent(sessionId)}`,
  );
  return session;
}

/** How a shift ended, in a word a supervisor can read. */
export function endReasonLabel(reason: SessionEndReason | undefined): string {
  switch (reason) {
    case 'replaced':
      return 'Replaced by a new session';
    case 'deactivated':
      return 'Account deactivated';
    case 'role-removed':
      return 'Support role removed';
    case 'ended':
    default:
      return 'Ended';
  }
}

/**
 * Seconds between two instants, for a clock that ticks on the device.
 *
 * The server's `durationSeconds` is the answer at fetch time; this is what makes
 * an open shift count up between refreshes.
 */
export function elapsedSeconds(startedAt: string, now: number): number {
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.round((now - start) / 1000));
}
