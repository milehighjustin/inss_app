import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { IncomingAlertsProvider } from '@/lib/alerts/incoming';
import { BootScreen } from '@/components/boot-screen';
import { KioskMode } from '@/components/kiosk/kiosk-mode';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth/session';
import { KioskProvider, useKiosk } from '@/lib/kiosk/kiosk';
import { AccentProvider } from '@/lib/preferences/accent';
import { registerWebApp } from '@/lib/pwa/register';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Web only, and a no-op elsewhere: the worker is what makes the installed app
  // open offline and what lets a browser offer to install it at all. It used to
  // be registered only when someone turned on desktop alerts, which left a new
  // visitor with nothing installable.
  useEffect(() => {
    registerWebApp();

    // The web shell paints the logo splash in index.html before any JavaScript
    // runs. BootScreen takes over as soon as the tree mounts, so the static copy
    // is faded out and removed rather than left underneath it.
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const splash = document.getElementById('boot-splash');
    if (!splash) return;

    splash.classList.add('is-done');
    const timer = setTimeout(() => splash.remove(), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AccentProvider>
      <KioskProvider>
        <AuthProvider>
          {/* Inside the session, above the navigator: a loud alert has to be
              able to ring over whatever screen is open. */}
          <IncomingAlertsProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <RootNavigator />
            </ThemeProvider>
          </IncomingAlertsProvider>
        </AuthProvider>
      </KioskProvider>
    </AccentProvider>
  );
}

/**
 * The navigator holds the signed-in app, the sign-in screen and the magic-link
 * callback. Access is decided by the screens themselves (see (app)/_layout.tsx
 * and sign-in.tsx) so signing in never rips the focused screen out of the
 * navigator.
 *
 * While a stored token is being checked the navigator is not mounted at all.
 * A device in kiosk mode skips all of it: the player is the whole app, so the
 * kiosk works before — and without — a sign-in.
 *
 * The public QR pages skip the session check too. Someone who scanned a sign has
 * no account and no token, and waiting on a stored session to be revalidated
 * would put an API round trip in front of a redirect.
 */
function RootNavigator() {
  const { status } = useAuth();
  const kiosk = useKiosk();
  const pathname = usePathname();
  const publicPage = pathname.startsWith('/qr/');

  if (!kiosk.ready) {
    return <BootScreen />;
  }

  if (kiosk.deviceId) {
    return <KioskMode deviceId={kiosk.deviceId} />;
  }

  if (status === 'loading' && !publicPage) {
    return <BootScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(app)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="auth/callback" />
      {/* A kiosk is public: it opens on a programmed screen with no account. */}
      <Stack.Screen name="kioskconnect/kiosk/[rtcDeviceId]" />
      {/* A printed sign and the display beside it: no session, no sign-in. */}
      <Stack.Screen name="qr/[id]/index" />
      <Stack.Screen name="qr/[id]/kiosk" />
    </Stack>
  );
}
