import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { BootScreen } from '@/components/boot-screen';
import { hasRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/session';

/**
 * Admin is administrator-only, matching v1's page, which checks for exactly that
 * role rather than admitting every role its shell would. The nav hides the
 * section too; this covers a deep link or a role change mid-session.
 */
export default function AdminLayout() {
  const { user, status } = useAuth();
  const router = useRouter();
  const allowed = hasRole(user?.roles, 'administrator');

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
