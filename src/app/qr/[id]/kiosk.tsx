import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { qrCodeSvgPublic } from '@/lib/qr/public';

/**
 * `/qr/:id/kiosk` — the screen a property displays instead of (or beside) a sign.
 *
 * One code, drawn large on white, nothing else. It lives in the app for the same
 * reason the scan page does: the address is written on a display in a lobby and
 * must not move when the API does. The drawing still comes from the server, so a
 * screen and the printed sign beside it are the same picture from the same id.
 *
 * The background is white in every colour scheme on purpose. A code on a dark
 * page is harder to scan and looks like a fault, and nobody is reading this
 * screen — they are pointing a phone at it.
 */
export default function QrKioskScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const codeId = typeof params.id === 'string' ? params.id : '';
  const { width, height } = useWindowDimensions();

  const [svg, setSvg] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  useEffect(() => {
    if (!codeId) {
      setState('missing');
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const markup = await qrCodeSvgPublic(codeId);
        if (cancelled) return;
        if (!markup) {
          setState('missing');
          return;
        }
        setSvg(markup);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [codeId]);

  // v1 sized the code at min(78vmin, 760px); the same proportion keeps the quiet
  // zone around it large enough to read from across a room.
  const size = Math.min(Math.min(width, height) * 0.78, 760);

  return (
    <View style={styles.page}>
      {state === 'ready' && svg ? (
        <SvgXml xml={svg} width={size} height={size} />
      ) : state === 'loading' ? (
        <ActivityIndicator color="#004F71" />
      ) : (
        <Text style={styles.message}>
          {state === 'missing' ? 'QR code not found' : 'Could not load this code'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  message: {
    color: '#004F71',
    fontSize: 18,
  },
});
