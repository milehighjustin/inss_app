import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { BootScreen } from '@/components/boot-screen';
import { CONNECT_ROLES, hasAnyRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/session';

/**
 * Kiosk Connect is the operators' console — the people who sit at a desk and
 * answer calls — plus the roles that maintain the devices.
 *
 * The nav and the home tile hide it from everyone else; this covers a deep link
 * or a role change mid-session. A kiosk is not a user at all: it opens a device
 * link at `/kioskconnect/kiosk/[id]`, which is outside this group and needs no
 * role.
 */
export default function KioskConnectLayout() {
  const { user, status } = useAuth();
  const router = useRouter();
  const allowed = hasAnyRole(user?.roles, CONNECT_ROLES);

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
