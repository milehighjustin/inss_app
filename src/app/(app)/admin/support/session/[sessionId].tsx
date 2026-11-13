import { useLocalSearchParams } from 'expo-router';

import { SessionDetail } from '@/components/support/session-detail';

/** Admin → Support → one shift. Same detail as the desk's, reached from the list. */
export default function AdminSupportSessionDetailRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  return (
    <SessionDetail
      sessionId={String(sessionId)}
      backHref="/admin/support/sessions"
      backLabel="‹ Sessions"
    />
  );
}
