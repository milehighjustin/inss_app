import { useLocalSearchParams } from 'expo-router';

import { InvestorScreen } from '@/components/investor/investor-screen';

/**
 * `/admin/investors/[userId]/view` — v1's "Investor View" tab.
 *
 * The portfolio exactly as that investor sees it, reached from their page in the
 * admin portal. It lives under `/admin` rather than `/investor` because the
 * portal's own screens are behind the investor role, which an administrator
 * previewing someone else need not have.
 */
export default function AdminInvestorViewScreen() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();

  return (
    <InvestorScreen
      actingAs={{
        userId: String(userId),
        name: typeof name === 'string' && name ? name : 'this investor',
      }}
    />
  );
}
