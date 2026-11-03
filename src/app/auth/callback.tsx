import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MetroButton, useMetro } from '@/components/metro';
import { MetroType, Metrics } from '@/constants/metro';
import { ApiError } from '@/lib/auth/api';
import { useAuth } from '@/lib/auth/session';
import { AppName } from '@/constants/app';

/**
 * Landing route for the magic link.
 *
 * app.json declares the `inssappv2` scheme, and expo-router maps everything
 * after `inssappv2://` onto file routes, so the emailed link
 * `inssappv2://auth/callback?token=…` opens this screen. The token is traded
 * for a session and the app moves on to the signed-in tabs.
 */
export default function AuthCallbackScreen() {
  const theme = useMetro();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const { completeMagicLink, status } = useAuth();

  const raw = Array.isArray(params.token) ? params.token[0] : params.token;
  const [error, setError] = useState<string | null>(null);
  const redeemed = useRef(false);

  useEffect(() => {
    if (redeemed.current) return;

    if (!raw) {
      redeemed.current = true;
      setError('This sign-in link is incomplete. Request a new one from the sign-in screen.');
      return;
    }

    redeemed.current = true;
    completeMagicLink(raw).catch((caught) => {
      setError(
        caught instanceof ApiError && caught.status !== 0
          ? 'This sign-in link has expired or was already used. Request a new one from the sign-in screen.'
          : 'We could not finish signing you in. Check your connection and try again.',
      );
    });
  }, [raw, completeMagicLink]);

  // The session provider owns the state change; once it is signed in, leave the callback.
  useEffect(() => {
    if (status === 'signedIn') {
      router.replace('/');
    }
  }, [status]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.column}>
          <View style={[styles.accentBar, { backgroundColor: error ? theme.danger : theme.accent }]} />
          <Text style={[styles.eyebrow, { color: theme.textDim }]}>{AppName}</Text>

          {error ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Link didn&apos;t work</Text>
              <Text style={[styles.body, { color: theme.textDim }]}>{error}</Text>
              <MetroButton label="Back to sign in" onPress={() => router.replace('/sign-in')} />
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: theme.text }]}>Signing you in</Text>
              <Text style={[styles.body, { color: theme.textDim }]}>
                One moment while we finish setting up your session.
              </Text>
              <ActivityIndicator color={theme.accent} style={styles.spinner} />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Metrics.gutter * 2,
  },
  column: {
    width: '100%',
    maxWidth: 440,
    gap: 14,
  },
  accentBar: {
    height: 8,
  },
  eyebrow: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  title: {
    fontSize: MetroType.title.fontSize,
    lineHeight: MetroType.title.lineHeight,
    fontWeight: MetroType.title.fontWeight,
  },
  body: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: MetroType.body.fontWeight,
  },
  spinner: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
});