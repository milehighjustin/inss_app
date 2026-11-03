import { useLocalSearchParams } from 'expo-router';

import { UserDetail } from '@/components/admin/user-detail';

export default function AdminUserScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  return <UserDetail userId={String(userId)} />;
}
