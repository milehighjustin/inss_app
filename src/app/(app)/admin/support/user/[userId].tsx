import { useLocalSearchParams } from 'expo-router';

import { SupportPersonScreen } from '@/components/admin/support/person-screen';

/** Admin → Support → one person: their metrics, by day and against the team. */
export default function AdminSupportPersonRoute() {
  const params = useLocalSearchParams<{ userId?: string; name?: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : '';
  const name = typeof params.name === 'string' && params.name ? params.name : undefined;

  return <SupportPersonScreen userId={userId} name={name} />;
}
