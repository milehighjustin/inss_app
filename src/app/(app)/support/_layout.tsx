import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { BootScreen } from '@/components/boot-screen';
import { SUPPORT_ROLES, hasAnyRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/session';

/**
 * Support is the support group's panel, plus the roles that read the performance
 * report. The nav hides the section too; this covers a deep link or a role change
 * mid-session.
 */
export default function SupportLayout() {
  const { user, status } = useAuth();
  const router = useRouter();
  const allowed = hasAnyRole(user?.roles, SUPPORT_ROLES);

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
