import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { BootScreen } from '@/components/boot-screen';
import { hasRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/session';

/**
 * The investor portal is for the `investor` role, which is what v1's
 * `/investor` and `/investor/files` pages each check explicitly.
 *
 * The nav hides the sections from everyone else; this covers a deep link or a
 * role change mid-session. The API enforces the same role, so the screen is the
 * courtesy, not the gate.
 */
export default function InvestorLayout() {
  const { user, status } = useAuth();
  const router = useRouter();
  const allowed = hasRole(user?.roles, 'investor');

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
