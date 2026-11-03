import { apiFetch } from '@/lib/api/client';

/**
 * What the desk did, over a window.
 *
 * Every number comes from the activity log — offers, answers, response times,
 * calls — not from the notification rows, which only record what was sent. A
 * quiet code still counts as an offer, so "answered ÷ offered" is honest even
 * when most signage is silent.
 */

export interface PersonPerformance {
  userId: string;
  name: string;
  roles: string[];
  /** Alerts that reached them while they were free. */
  offered: number;
  /** Alerts that arrived while they were on a call, and rang afterwards. */
  held: number;
  answered: number;
  ignored: number;
  /** Offered, never answered or ignored. */
  missed: number;
  /** Answered ÷ offered, or null when they were never offered one. */
  answerRate: number | null;
  medianAnswerSeconds: number | null;
  averageAnswerSeconds: number | null;
  calls: number;
  talkSeconds: number;
  lastActivityAt: string | null;
}

export interface LocationPerformance {
  locationId: string;
  name: string;
  offered: number;
  answered: number;
}

export interface PerformanceReport {
  from: string;
  to: string;
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
  people: PersonPerformance[];
  locations: LocationPerformance[];
}

export function fetchPerformance(days: number): Promise<PerformanceReport> {
  return apiFetch<PerformanceReport>(`/api/mobile/admin/performance?days=${days}`);
}

/** `12s`, `1m 40s`, `2h 5m` — how long something took, at a glance. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** `86%`, or `—` when there was nothing to answer. */
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}
