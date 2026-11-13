import { router, usePathname, type Href } from 'expo-router';

import { MetroPivot } from '@/components/metro';

/**
 * Admin → Support, as one tab row.
 *
 * The desk's view of everyone, split by the question being asked: who is on
 * right now, what happened on each shift, what happened to each alert, and what
 * the shifts add up to. The person's own page — their shift and their alerts —
 * stays in Support; nothing here appears there and nothing there appears here.
 */
const TABS = [
  { value: '/admin/support', label: 'Active Users' },
  { value: '/admin/support/sessions', label: 'Sessions' },
  { value: '/admin/support/alerts', label: 'Alerts' },
  { value: '/admin/support/performance', label: 'Performance' },
];

export function AdminSupportPivot() {
  const pathname = usePathname();

  // A single session's detail belongs to Sessions, so it keeps the tab it was
  // opened from.
  const current =
    TABS.filter(
      (tab) => tab.value !== '/admin/support' && pathname.startsWith(`${tab.value}`),
    )[0]?.value ??
    (pathname.startsWith('/admin/support/session') ? '/admin/support/sessions' : '/admin/support');

  return (
    <MetroPivot tabs={TABS} value={current} onChange={(value) => router.navigate(value as Href)} />
  );
}
