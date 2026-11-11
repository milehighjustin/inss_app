import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Socket } from 'socket.io-client';

import { MetroButton, MetroLabel } from '@/components/metro';
import { useMetro } from '@/components/metro/use-metro';
import { Spacing } from '@/constants/metro';
import { apiFetch } from '@/lib/api/client';
import { hasRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/session';
import { useKiosk } from '@/lib/kiosk/kiosk';
import { operatorSession } from '@/lib/rtc/api';
import { connectSignaling, signalPayload } from '@/lib/rtc/socket';
import { startRinging } from './rings';

/**
 * A loud alert, treated as a call.
 *
 * A push notification cannot ring: the sound belongs to the OS, the sender
 * cannot supply one, and a closed browser receives nothing at all. The socket can
 * — it is already the transport for Kiosk Connect, and a signed-in person has a
 * connection the moment the app opens.
 *
 * So the alert arrives twice, for two different situations. The socket rings
 * whatever window is open, whether or not notifications were ever allowed, and
 * waits to be answered the way a call does. The push is what covers somebody who
 * has the app closed — it does not ring, but it is there in the tray.
 *
 * Quiet alerts never come through here. The server sends only loud ones, and
 * `readAlert` would drop the rest: a quiet alert is something to notice later,
 * not something to interrupt a meeting for.
 */

/** The roles that can carry a notification tag, and therefore be rung. */
const RINGABLE_ROLES = ['administrator', 'developer', 'manager', 'supervisor'] as const;

export interface IncomingAlert {
  id: string;
  title: string;
  body: string;
  qrCodeId: string | null;
  qrCodeName: string | null;
  destination: string | null;
  /** Where the sign is — the first thing anyone answering wants to know. */
  locationName: string | null;
  /** The screen beside that sign, and so the call this alert can start. */
  rtcDeviceId: string | null;
  rtcDeviceName: string | null;
  createdAt: string;
}

/**
 * Tell the server what happened to the alert.
 *
 * This is the difference between "six people were told" and "answered in nine
 * seconds": the offer was written when it rang, so the answer closes the
 * interval. Best-effort — the ring is already over, and a failed write must not
 * trap the person in the modal.
 */
async function acknowledge(alertId: string, outcome: 'answered' | 'ignored'): Promise<void> {
  try {
    await apiFetch(`/api/mobile/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
      method: 'POST',
      body: { outcome },
    });
  } catch {
    // Nothing to retry: the notification log keeps what was sent either way.
  }
}

/** One socket payload, or null when it is not a loud alert we should ring for. */
function readAlert(raw: unknown): IncomingAlert | null {
  const payload = signalPayload(raw);

  const id = typeof payload.id === 'string' ? payload.id : '';
  if (!id) return null;
  if (payload.priority !== 'loud') return null;

  return {
    id,
    title: typeof payload.title === 'string' && payload.title ? payload.title : 'Someone needs you',
    body: typeof payload.body === 'string' ? payload.body : '',
    qrCodeId: typeof payload.qrCodeId === 'string' ? payload.qrCodeId : null,
    qrCodeName: typeof payload.qrCodeName === 'string' ? payload.qrCodeName : null,
    destination: typeof payload.destination === 'string' ? payload.destination : null,
    locationName: typeof payload.locationName === 'string' ? payload.locationName : null,
    rtcDeviceId: typeof payload.rtcDeviceId === 'string' ? payload.rtcDeviceId : null,
    rtcDeviceName: typeof payload.rtcDeviceName === 'string' ? payload.rtcDeviceName : null,
    createdAt:
      typeof payload.createdAt === 'string' ? payload.createdAt : new Date().toISOString(),
  };
}

export function IncomingAlertsProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const kiosk = useKiosk();
  const router = useRouter();
  const [calls, setCalls] = useState<IncomingAlert[]>([]);

  const userId = user?.userId ?? '';
  const inKioskMode = Boolean(kiosk.deviceId);
  // Asking the API for a socket token is a 403 for anyone who cannot hold a tag,
  // so the connection is not even attempted for them.
  const canBeRung = RINGABLE_ROLES.some((role) => hasRole(user?.roles, role));

  useEffect(() => {
    if (status !== 'signedIn' || inKioskMode || !canBeRung) return;

    let socket: Socket | null = null;
    let cancelled = false;
    let renewing = false;

    const listen = (token: string) => {
      socket = connectSignaling(token);

      socket.on('incomingAlert', (raw: unknown) => {
        const alert = readAlert(raw);
        if (!alert) return;

        setCalls((current) =>
          // The same alert twice is one call: the row id is the identity, so a
          // reconnect that replays it cannot double-ring.
          current.some((call) => call.id === alert.id) ? current : [...current, alert].slice(-5),
        );
      });

      // The token lasts an hour, and socket.io will keep retrying a dead one.
      // Ask for a fresh token once rather than going deaf until a reload.
      socket.on('connect_error', () => {
        if (cancelled || renewing) return;
        renewing = true;

        void (async () => {
          try {
            const fresh = await operatorSession();
            if (cancelled || !socket) return;
            socket.auth = { token: fresh.token };
            socket.connect();
          } catch {
            // Nothing to renew with; the existing retries continue.
          } finally {
            renewing = false;
          }
        })();
      });
    };

    void (async () => {
      try {
        const session = await operatorSession();
        if (cancelled) return;
        listen(session.token);
      } catch {
        // Offline, or no role for the console: alerts still arrive as
        // notifications, they just cannot ring this window.
      }
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [status, inKioskMode, canBeRung, userId]);

  const active = calls[0] ?? null;

  // Ringing is a property of the call being on screen: answering or ignoring
  // changes which one is active, which stops the tone.
  useEffect(() => {
    if (!active) return;
    return startRinging();
  }, [active?.id]);

  const drop = useCallback((alert: IncomingAlert) => {
    setCalls((current) => current.filter((call) => call.id !== alert.id));
  }, []);

  /**
   * Answering opens the console on the kiosk beside the sign.
   *
   * That is the whole point of pairing the two: whoever scanned is standing in
   * front of a screen, so the answer to "someone is at the gate" is to look at
   * the gate. A code with no kiosk still answers — it just has no call to offer,
   * and falls back to the admin QR panel for an administrator.
   */
  const answer = useCallback(
    (alert: IncomingAlert) => {
      drop(alert);
      void acknowledge(alert.id, 'answered');

      if (alert.rtcDeviceId) {
        router.push({
          pathname: '/kioskconnect',
          params: { device: alert.rtcDeviceId, alert: alert.id },
        });
        return;
      }

      if (hasRole(user?.roles, 'administrator')) router.push('/admin/qr');
    },
    [drop, router, user?.roles],
  );

  const ignore = useCallback(
    (alert: IncomingAlert) => {
      drop(alert);
      void acknowledge(alert.id, 'ignored');
    },
    [drop],
  );

  return (
    <>
      {children}
      <IncomingCall
        alert={active}
        waiting={Math.max(calls.length - 1, 0)}
        onAnswer={() => active && answer(active)}
        onIgnore={() => active && ignore(active)}
      />
    </>
  );
}

/** The takeover: what rang, when, and the two ways out of it. */
function IncomingCall({
  alert,
  waiting,
  onAnswer,
  onIgnore,
}: {
  alert: IncomingAlert | null;
  waiting: number;
  onAnswer: () => void;
  onIgnore: () => void;
}) {
  const theme = useMetro();

  return (
    <Modal
      visible={alert !== null}
      animationType="fade"
      transparent={false}
      onRequestClose={onIgnore}>
      {alert ? (
        <View style={[styles.page, { backgroundColor: theme.background }]}>
          {/* A takeover fills the window, so its content scrolls: a long message
              on a small phone must not put Answer and Ignore off the screen. */}
          <ScrollView
            style={styles.pageScroll}
            contentContainerStyle={styles.column}
            showsVerticalScrollIndicator>
            <MetroLabel>Incoming alert</MetroLabel>

            <Text style={[styles.title, { color: theme.text }]}>{alert.title}</Text>

            <Text style={[styles.meta, { color: theme.textDim }]}>
              {[alert.locationName ?? alert.qrCodeName, alert.qrCodeName && alert.locationName ? alert.qrCodeName : null, when(alert.createdAt)]
                .filter(Boolean)
                .join(' · ')}
            </Text>

            {alert.body ? (
              <Text style={[styles.body, { color: theme.text }]}>{alert.body}</Text>
            ) : null}

            {alert.destination ? (
              <Text style={[styles.meta, { color: theme.textDim }]} numberOfLines={1}>
                Heading to {hostOf(alert.destination)}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <MetroButton
                label={alert.rtcDeviceId ? 'Answer and call' : 'Answer'}
                onPress={onAnswer}
              />
              <MetroButton label="Ignore" variant="ghost" onPress={onIgnore} />
            </View>

            <Text style={[styles.meta, { color: theme.textDim }]}>
              {alert.rtcDeviceId
                ? `Answering opens the console on ${alert.rtcDeviceName ?? 'the kiosk beside this sign'}.`
                : 'Answering opens the console; this code has no kiosk to call.'}
            </Text>

            {waiting > 0 ? (
              <Text style={[styles.meta, { color: theme.textDim }]}>
                {waiting === 1 ? '1 more is waiting.' : `${waiting} more are waiting.`}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

/** The bare hostname, so the line reads as a place rather than a URL. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** A short, unambiguous timestamp: “31 Oct, 14:05”. */
function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 24,
  },
  pageScroll: {
    flex: 1,
    width: '100%',
  },
  column: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    // Centred while it fits, scrolling once it does not.
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 600,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
  },
  meta: {
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
