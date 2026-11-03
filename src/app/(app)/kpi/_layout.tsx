import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { BootScreen } from '@/components/boot-screen';
import { KPI_ROLES, hasAnyRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/session';

/**
 * KPI is for administrators, managers and supervisors.
 *
 * The nav hides the section from everyone else; this covers a deep link or a role
 * change mid-session. The API enforces the same list, so the screen is the
 * courtesy, not the gate.
 */
export default function KpiLayout() {
  const { user, status } = useAuth();
  const router = useRouter();
  const allowed = hasAnyRole(user?.roles, KPI_ROLES);

  useEffect(() => {
    if (status === 'signedIn' && !allowed) {
      router.replace('/');
    }
  }, [status, allowed, router]);

  if (!allowed) {
    return <BootScreen />;
  }

  return <Slot />;
}
