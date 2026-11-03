import { router, usePathname, type Href } from 'expo-router';

import { MetroPivot } from '@/components/metro';

/**
 * The admin console's sections, as one tab row.
 *
 * v1 gives its admin panel a side nav with six entries; a phone has no room for
 * one, so the same list becomes the page's tab row and every section keeps its
 * own route. The order is v1's, so a section is where it always was: Users, KPI
 * (location settings and saved lists), the Investor Portal (investors,
 * locations, documents, equity, dividends), Kiosk Connect, QR codes, and the
 * integrations.
 */
const TABS = [
  { value: '/admin', label: 'Users' },
  { value: '/admin/kpi', label: 'KPI' },
  { value: '/admin/investors', label: 'Investor Portal' },
  { value: '/admin/kiosk', label: 'Kiosk Connect' },
  { value: '/admin/qr', label: 'QR Codes' },
  { value: '/admin/notifications', label: 'Notifications' },
  { value: '/admin/performance', label: 'Performance' },
  { value: '/admin/integrations', label: 'Integrations' },
];

export function AdminPivot() {
  const pathname = usePathname();

  // `/admin/user/[id]` belongs to Users, so only the deeper sections match on a
  // prefix and the list stays on the tab it came from.
  const current =
    TABS.filter((tab) => tab.value !== '/admin' && pathname.startsWith(`${tab.value}`))[0]
      ?.value ?? '/admin';

  return (
    <MetroPivot
      tabs={TABS}
      value={current}
      onChange={(value) => router.navigate(value as Href)}
    />
  );
}
