import { useLocalSearchParams } from 'expo-router';

import { InvestorFiles } from '@/components/investor/files-screen';

/** `/admin/investors/[userId]/files` — the documents that investor can see. */
export default function AdminInvestorFilesScreen() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();

  return (
    <InvestorFiles
      actingAs={{
        userId: String(userId),
        name: typeof name === 'string' && name ? name : 'this investor',
      }}
    />
  );
}
