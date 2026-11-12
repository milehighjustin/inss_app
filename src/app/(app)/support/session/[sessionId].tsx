import { useLocalSearchParams } from 'expo-router';

import { SessionDetail } from '@/components/support/session-detail';

export default function SupportSessionDetailRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  return <SessionDetail sessionId={String(sessionId)} />;
}
