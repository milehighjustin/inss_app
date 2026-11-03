import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MetroBanner, MetroButton, MetroField, MetroRule, useMetro } from '@/components/metro';
import { MetroType, Metrics } from '@/constants/metro';
import { ApiError } from '@/lib/auth/api';
import { useAuth } from '@/lib/auth/session';
import { AppName } from '@/constants/app';

/**
 * Sign-in for the app. Same accounts, same password check as the website: the
 * backend route reuses the site's own login(), and the magic link is sent by
 * the app backend rather than by the browser flow.
 *
 * Layout follows METRO.md — flat fields, square corners, type-led hierarchy,
 * one accent colour.
 */

type Mode = 'password' | 'link';

const MAX_FORM_WIDTH = 440;

export default function SignInScreen() {
  const theme = useMetro();
  const { width } = useWindowDimensions();
  const { signIn, requestMagicLink, notice, status } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'password' | 'link' | null>(null);
  const [error, setError] = useState<string | null>(notice);
  const [linkSent, setLinkSent] = useState(false);

  // The session can end while this screen is already mounted (a 401 anywhere
  // signs the app out), so pick up the reason whenever it changes.
  useEffect(() => {
    if (notice) setError(notice);
  }, [notice]);

  // Hand off to the app once the session exists. A router effect (not a
  // <Redirect>) keeps this to a single navigation instead of re-dispatching on
  // every focus.
  useEffect(() => {
    if (status === 'signedIn') {
      router.replace('/');
    }
  }, [status, router]);

  const submitPassword = async () => {
    if (busy) return;
    if (!username.trim() || !password) {
      setError('Enter your email or username and your password.');
      return;
    }

    setError(null);
    setBusy('password');
    try {
      await signIn(username, password);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const submitMagicLink = async () => {
    if (busy) return;
    if (!email.trim() || !email.includes('@')) {
      setError('Enter the email address on your account.');
      return;
    }

    setError(null);
    setBusy('link');
    try {
      await requestMagicLink(email);
      setLinkSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={[styles.column, { width: Math.min(width - Metrics.gutter * 2, MAX_FORM_WIDTH) }]}>
              <View style={[styles.accentBar, { backgroundColor: theme.accent }]} />

              <View style={styles.header}>
                <Text style={[styles.eyebrow, { color: theme.textDim }]}>{AppName}</Text>
                <Text style={[styles.title, { color: theme.text }]}>Sign in</Text>
                <Text style={[styles.subtitle, { color: theme.textDim }]}>
                  Use your INSS Self Storage account, the same one you use on the website.
                </Text>
              </View>

              {error ? (
                <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} />
              ) : null}

              {linkSent ? (
                <View style={styles.form}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Check your email</Text>
                  <Text style={[styles.subtitle, { color: theme.textDim }]}>
                    If {email.trim()} has an account, a sign-in link is on its way. It works once and
                    expires in 15 minutes.
                  </Text>
                  <MetroButton
                    label="Use a password instead"
                    variant="ghost"
                    onPress={() => {
                      setLinkSent(false);
                      setMode('password');
                      setError(null);
                    }}
                  />
                </View>
              ) : mode === 'password' ? (
                <View style={styles.form}>
                  <MetroField
                    label="Email or username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    keyboardType="email-address"
                    returnKeyType="next"
                    editable={!busy}
                  />
                  <MetroField
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="current-password"
                    returnKeyType="go"
                    onSubmitEditing={submitPassword}
                    editable={!busy}
                  />
                  <MetroButton label="Sign in" onPress={submitPassword} loading={busy === 'password'} />

                  <MetroRule label="or" />

                  <MetroButton
                    label="Email me a sign-in link"
                    variant="ghost"
                    onPress={() => {
                      setMode('link');
                      setError(null);
                    }}
                  />
                </View>
              ) : (
                <View style={styles.form}>
                  <MetroField
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    returnKeyType="send"
                    onSubmitEditing={submitMagicLink}
                    editable={!busy}
                  />
                  <MetroButton
                    label="Send sign-in link"
                    onPress={submitMagicLink}
                    loading={busy === 'link'}
                  />
                  <MetroButton
                    label="Use a password instead"
                    variant="ghost"
                    onPress={() => {
                      setMode('password');
                      setError(null);
                    }}
                  />
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  column: {
    gap: 20,
  },
  accentBar: {
    height: 8,
  },
  header: {
    gap: 6,
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
  sectionTitle: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  subtitle: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight + 4,
    fontWeight: MetroType.subtle.fontWeight,
  },
  form: {
    gap: 16,
  },
});