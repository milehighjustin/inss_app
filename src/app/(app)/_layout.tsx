import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { BootScreen } from '@/components/boot-screen';
import { AppShell } from '@/components/nav';
import { useAuth } from '@/lib/auth/session';
import { usePhonePushRegistration } from '@/lib/push/phone';

/** Everything under (app) requires a session. */
export default function AppLayout() {
  const { status } = useAuth();
  const router = useRouter();

  // Keeps this phone registered for alerts while someone is signed in: it
  // registers when the account has tags, unregisters when it has none, and
  // re-registers when the OS rotates the push token. On the web this is a no-op.
  usePhonePushRegistration();

  useEffect(() => {
    if (status === 'signedOut') {
      router.replace('/sign-in');
    }
  }, [status, router]);

  if (status !== 'signedIn') {
    return <BootScreen />;
  }

  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false }} />
    </AppShell>
  );
}
