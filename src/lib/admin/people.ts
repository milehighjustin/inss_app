import { apiFetch } from '@/lib/api/client';

/**
 * One person's desk work, and the people they work beside.
 *
 * The same source as the performance report — the activity log — narrowed to one
 * account: what was offered to them, what they answered and how fast, what the
 * calls lasted, and how much of the window they were actually on duty. The team
 * block is what makes the numbers mean something: an answer rate on its own says
 * nothing about whether the desk is well covered.
 */

export interface PersonActivitySummary {
  userId: string;
  offered: number;
  held: number;
  answered: number;
  ignored: number;
  missed: number;
  answerRate: number | null;
  medianAnswerSeconds: number | null;
  averageAnswerSeconds: number | null;
  calls: number;
  talkSeconds: number;
  /** Distinct alerts that reached them, offered or held. */
  notifications: number;
  /** Answered or ignored — a tap is a tap, whatever came of it. */
  clicked: number;
  claimed: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
}

export interface PersonDayRow {
  /** `YYYY-MM-DD`, in UTC. */
  date: string;
  offered: number;
  held: number;
  answered: number;
  ignored: number;
  missed: number;
  answerRate: number | null;
  medianAnswerSeconds: number | null;
  calls: number;
  talkSeconds: number;
  notifications: number;
  clicked: number;
}

export interface PersonReport {
  from: string;
  to: string;
  days: number;
  person: {
    userId: string;
    name: string;
    roles: string[];
    activity: PersonActivitySummary;
  };
  daily: PersonDayRow[];
  shifts: {
    count: number;
    seconds: number;
    active: boolean;
    lastStartedAt: string | null;
  };
  team: {
    people: number;
    peers: number;
    totals: {
      offered: number;
      held: number;
      answered: number;
      ignored: number;
      missed: number;
      answerRate: number | null;
      medianAnswerSeconds: number | null;
      calls: number;
      talkSeconds: number;
    };
    /** Peer averages: one person, one vote. */
    perPerson: {
      offered: number;
      held: number;
      answered: number;
      ignored: number;
      missed: number;
      calls: number;
      talkSeconds: number;
      answerRate: number;
    };
    rank: { answerRate: number | null; of: number };
  };
}

export function fetchPersonReport(userId: string, days: number): Promise<PersonReport> {
  return apiFetch<PersonReport>(
    `/api/mobile/admin/support/people/${encodeURIComponent(userId)}?days=${days}`,
  );
}

/** `1st`, `2nd`, `3rd`, `4th` … */
export function ordinal(value: number): string {
  const rest = value % 100;
  if (rest >= 11 && rest <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

/** `12` from `12.4` — peer averages read better as whole alerts. */
export function averageCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return String(Math.round(value * 10) / 10);
}
