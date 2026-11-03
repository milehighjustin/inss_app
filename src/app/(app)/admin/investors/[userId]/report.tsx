import { useLocalSearchParams } from 'expo-router';

import { InvestorReportScreen } from '@/components/investor/report-screen';

/**
 * `/admin/investors/[userId]/report?locationId=…&kind=…`
 *
 * One of that investor's property reports, opened from their portfolio preview.
 */
export default function AdminInvestorReportScreen() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();

  return (
    <InvestorReportScreen
      actingAs={{
        userId: String(userId),
        name: typeof name === 'string' && name ? name : 'this investor',
      }}
    />
  );
}
