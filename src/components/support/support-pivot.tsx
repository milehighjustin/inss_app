import { router, usePathname, type Href } from 'expo-router';

import { MetroPivot } from '@/components/metro';
import { SESSION_STAFF_ROLES, hasAnyRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/session';

/**
 * The Support panel's sections, as one tab row.
 *
 * Session is the person's own shift — the reason the tile is on their home
 * screen. Sessions and Performance are the desk's view of everyone, so they are
 * hidden from an account that is only in the support group: the API refuses those
 * lists to them anyway, and a tab that always errors is worse than no tab.
 */
const TABS = [
  { value: '/support', label: 'Session' },
  { value: '/support/sessions', label: 'Sessions' },
  { value: '/support/performance', label: 'Performance' },
];

export function SupportPivot() {
  const pathname = usePathname();
  const { user } = useAuth();
  const staff = hasAnyRole(user?.roles, SESSION_STAFF_ROLES);
  const tabs = staff ? TABS : TABS.filter((tab) => tab.value === '/support');

  // `/support/session/<id>` belongs to Sessions, so a session's detail keeps the
  // tab it was opened from.
  const current =
    tabs.filter(
      (tab) => tab.value !== '/support' && pathname.startsWith(`${tab.value}`),
    )[0]?.value ??
    (pathname.startsWith('/support/session') ? '/support/sessions' : '/support');

  return (
    <MetroPivot tabs={tabs} value={current} onChange={(value) => router.navigate(value as Href)} />
  );
}
