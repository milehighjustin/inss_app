import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { MetroBanner, MetroButton, MetroScreen } from '@/components/metro';
import { useMetro } from '@/components/metro/use-metro';
import { scanQrCode } from '@/lib/qr/public';

/**
 * `/qr/:id` — what a printed sign opens.
 *
 * This page is the reason the QR feature belongs to the app rather than the API:
 * a sign encodes one hostname, and that hostname must not move when the backend
 * does. The API is asked where the code points *now* (and records that it was
 * scanned), then the visitor is sent there.
 *
 * It renders without a session and without waiting for one — see
 * `src/app/_layout.tsx`, which skips the session check on this path.
 */
export default function QrScanScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const codeId = typeof params.id === 'string' ? params.id : '';
  const started = useRef(false);
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codeId || started.current) return;
    // One resolve per mount: a second pass would record the same scan twice.
    started.current = true;

    void (async () => {
      try {
        const result = await scanQrCode(codeId);
        setTarget(result.url);
        await leave(result.url);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'This code could not be read.');
      }
    })();
  }, [codeId]);

  const host = hostOf(target);

  if (error) {
    return (
      <MetroScreen eyebrow="INSS Self Storage" title="That code did not open">
        <MetroBanner message={error} />
        <MetroButton label="Try again" onPress={() => reload()} />
      </MetroScreen>
    );
  }

  return (
    <MetroScreen
      eyebrow="INSS Self Storage"
      title="Opening…"
      subtitle={host ? `Taking you to ${host}` : undefined}>
      {target ? (
        <>
          <MetroButton label={`Continue to ${host ?? 'the site'}`} onPress={() => void leave(target)} />
          <Opening note="If nothing happens, tap the button above." />
        </>
      ) : (
        <Opening note="One moment." />
      )}
    </MetroScreen>
  );
}

/** The bare hostname, for a line of copy that does not scare anyone. */
function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Send the visitor on.
 *
 * On the web this replaces the history entry, so the back button returns to
 * wherever they came from rather than to a page that instantly redirects again.
 * Native has no page to leave: the link opens outside the app, and the screen
 * stays with its "Continue" button in case the hand-off was declined.
 */
async function leave(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    const browser = globalThis as { location?: { replace(href: string): void } };
    browser.location?.replace(url);
    return;
  }

  await Linking.openURL(url).catch(() => {
    // Leaving is best-effort; the screen keeps a button for the retry.
  });
}

/** Reload the page under it, which re-runs the resolve. */
function reload(): void {
  if (Platform.OS === 'web') {
    const browser = globalThis as { location?: { reload(): void } };
    browser.location?.reload();
  }
}

/** A small line of reassurance under the button. */
function Opening({ note }: { note: string }) {
  const theme = useMetro();
  return (
    <View style={styles.note}>
      <Text style={[styles.noteText, { color: theme.textDim }]}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    alignItems: 'flex-start',
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
