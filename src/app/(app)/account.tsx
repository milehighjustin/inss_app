import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import {
  MetroBadge,
  MetroBanner,
  MetroButton,
  MetroField,
  MetroHeading,
  MetroScreen,
  MetroSwatches,
  useMetro,
} from '@/components/metro';
import { AppName } from '@/constants/app';
import { MetroType, Radius, Spacing } from '@/constants/metro';
import { useAuth } from '@/lib/auth/session';
import { useKiosk } from '@/lib/kiosk/kiosk';
import { ACCENT_PRESETS, useAccent } from '@/lib/preferences/accent';
import { receivesAlerts } from '@/lib/push/audience';
import { useInstallState } from '@/lib/pwa/install';
import {
  desktopPushStatus,
  desktopPushSupported,
  disableDesktopPush,
  enableDesktopPush,
  sendTestDesktopPush,
  syncDesktopPush,
  type DesktopPushStatus,
} from '@/lib/push/browser';
import {
  disablePhonePush,
  enablePhonePush,
  phonePushLimitation,
  phonePushStatus,
  phonePushSupported,
  sendTestPhonePush,
  syncPhonePush,
  type PhonePushStatus,
} from '@/lib/push/phone';

/**
 * Who you are signed in as, the one colour you own, and the way out.
 *
 * The page opens with the person — a portrait, their name and their roles — then
 * the same quiet, hairline-separated blocks the rest of the app uses. Nothing
 * here is a setting you change every day, so nothing gets a box; the accent
 * swatches and kiosk mode are the two things you actually come to do.
 */
export default function AccountScreen() {
  const theme = useMetro();
  const { user, signOut } = useAuth();
  const { accentId, setAccent } = useAccent();
  const kiosk = useKiosk();

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() ||
    (user?.username?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  const details = [
    { label: 'Username', value: user?.username || '—' },
    { label: 'Email', value: user?.email || '—' },
  ];

  return (
    <MetroScreen eyebrow={AppName} title="Account" width="column">
      <View style={styles.identity}>
        {user?.photoUrl ? (
          <Image
            source={{ uri: user.photoUrl }}
            contentFit="cover"
            style={[styles.avatar, styles.avatarPhoto, { borderColor: theme.border }]}
            accessibilityLabel={name ? `Photo of ${name}` : 'Profile photo'}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.accent }]}>
            <Text style={[styles.initials, { color: theme.onAccent }]}>{initials}</Text>
          </View>
        )}

        <View style={styles.identityText}>
          <Text style={[styles.name, { color: theme.text }]}>{name || 'Signed in'}</Text>
          <Text style={[styles.email, { color: theme.textDim }]}>
            {user?.email || user?.username || '—'}
          </Text>
          <View style={styles.badges}>
            {user?.roles?.length ? (
              user.roles.map((role) => <MetroBadge key={role} label={role} />)
            ) : (
              <Text style={[styles.note, { color: theme.textDim }]}>No roles assigned</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.block}>
        <MetroHeading>Profile</MetroHeading>
        <View>
          {details.map((detail, index) => (
            <View
              key={detail.label}
              style={[
                styles.detailRow,
                index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
              ]}>
              <Text style={[styles.detailLabel, { color: theme.textDim }]}>{detail.label}</Text>
              <Text numberOfLines={1} style={[styles.detailValue, { color: theme.text }]}>
                {detail.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <MetroHeading>Appearance</MetroHeading>
        <MetroSwatches
          label="Accent colour"
          options={ACCENT_PRESETS.map((preset) => ({
            value: preset.id,
            label: preset.name,
            color: preset.value,
          }))}
          value={accentId}
          onChange={setAccent}
          description="The app's one accent colour. It paints the top bar, avatars, buttons and selected controls."
        />
      </View>

      <AlertTagsSection tags={user?.notificationTags ?? []} />

      {/*
        Alerts are offered only to an account that has a tag. Without one nothing
        is ever addressed to this person, so the OS permission dialog is never
        raised and no channel is registered.
      */}
      {receivesAlerts(user) && phonePushSupported() ? <PhoneAlertsSection /> : null}

      {receivesAlerts(user) && desktopPushSupported() ? <DesktopAlertsSection /> : null}

      <InstallSection />

      {kiosk.supported ? <KioskModeSection /> : null}

      <View style={styles.block}>
        <MetroHeading>Session</MetroHeading>
        <Text style={[styles.note, { color: theme.textDim }]}>
          This device stays signed in until you sign out. Signing in again needs your email and
          password, or a magic link from an administrator.
        </Text>
        <View style={styles.actions}>
          <MetroButton
            label="Sign out"
            variant="ghost"
            onPress={() => {
              // A shared browser or phone must not keep alerting the person who
              // left. The device is unregistered here as well as on the server,
              // and it does not hold up the sign-out.
              void disableDesktopPush().catch(() => {});
              void disablePhonePush().catch(() => {});
              signOut();
            }}
          />
        </View>
      </View>
    </MetroScreen>
  );
}

/**
 * Installing the web build on this device.
 *
 * Chrome, Edge and Samsung Internet offer a real install prompt; Safari has no
 * event for it and expects Share → Add to Home Screen (iOS) or File → Add to
 * Dock (macOS), so the same block explains whichever applies rather than
 * showing a button that would do nothing. A native build has nothing to add —
 * it is already installed — and the hook reports that, so this renders empty.
 */
function InstallSection() {
  const theme = useMetro();
  const install = useInstallState();
  const [notice, setNotice] = useState<string | null>(null);

  if (!install.available) return null;

  return (
    <View style={styles.block}>
      <MetroHeading>Install</MetroHeading>

      {install.installed ? (
        <Text style={[styles.note, { color: theme.textDim }]}>
          This is the installed app. It opens on its own without browser chrome, and it still
          opens — as far as it can — when the connection drops.
        </Text>
      ) : (
        <>
          <Text style={[styles.note, { color: theme.textDim }]}>
            {install.canPrompt
              ? 'Install INSS to put it in your dock or on your home screen, opening without the browser around it.'
              : (install.steps ?? '')}
          </Text>

          {install.canPrompt ? (
            <View style={styles.actions}>
              <MetroButton
                label="Install this app"
                onPress={() => {
                  void install.prompt().then((outcome) => {
                    if (outcome === 'dismissed') {
                      setNotice(
                        'The install prompt was dismissed. You can install it from the browser menu later.',
                      );
                    }
                  });
                }}
              />
            </View>
          ) : null}

          {notice ? (
            <MetroBanner message={notice} onDismiss={() => setNotice(null)} />
          ) : null}
        </>
      )}
    </View>
  );
}

/**
 * Kiosk mode, set on the device itself.
 *
 * The id is typed in rather than picked from a list, so a device can be set up
 * without the administrator signing in on it. Turning it on opens the player at
 * once and every later launch starts there; the way out is the long press on
 * the kiosk screen, which is explained here while it can still be read.
 */
function KioskModeSection() {
  const theme = useMetro();
  const kiosk = useKiosk();
  const [draft, setDraft] = useState(kiosk.deviceId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(kiosk.deviceId ?? '');
  }, [kiosk.deviceId]);

  const enter = async () => {
    const deviceId = draft.trim();
    if (!deviceId) {
      setError('Type the kiosk device ID first.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await kiosk.setDevice(deviceId);
    } catch {
      setError('Kiosk mode could not be saved on this device.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.block}>
      <MetroHeading
        accessory={kiosk.deviceId ? <MetroBadge label="Active" tone="accent" /> : undefined}>
        Kiosk mode
      </MetroHeading>

      <Text style={[styles.note, { color: theme.textDim }]}>
        {kiosk.deviceId
          ? `This device opens kiosk ${kiosk.deviceId} on every launch, without signing in.`
          : 'Turn this device into a kiosk screen: type the ID from Admin → Kiosk Connect and the app opens straight into that kiosk from now on.'}
      </Text>

      <MetroField
        label="Kiosk device ID"
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="e.g. ZQKBYLI8"
      />

      <View style={styles.actions}>
        <MetroButton
          label={kiosk.deviceId ? 'Use this ID' : 'Enter kiosk mode'}
          onPress={() => void enter()}
          loading={saving}
        />
      </View>

      <Text style={[styles.note, { color: theme.textDim }]}>
        To leave kiosk mode, press and hold the top-left corner of the kiosk screen for three
        seconds.
      </Text>

      {error ? <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} /> : null}
    </View>
  );
}

/**
 * What this account is told about.
 *
 * Tags are assigned by an administrator, never chosen here: they decide which
 * scans and messages reach this person. Seeing them is the point — someone can
 * tell whether they are on the support list without asking, and the two alert
 * channels below only appear once there is something to be told about.
 */
function AlertTagsSection({ tags }: { tags: string[] }) {
  const theme = useMetro();

  return (
    <View style={styles.block}>
      <MetroHeading
        accessory={
          tags.length > 0 ? <MetroBadge label={`${tags.length}`} tone="accent" /> : undefined
        }>
        Alert tags
      </MetroHeading>

      {tags.length > 0 ? (
        <>
          <Text style={[styles.note, { color: theme.textDim }]}>
            You are told when something needs these. An administrator assigns them; nobody can add
            themselves.
          </Text>
          <View style={styles.badges}>
            {tags.map((tag) => (
              <MetroBadge key={tag} label={tag} />
            ))}
          </View>
        </>
      ) : (
        <Text style={[styles.note, { color: theme.textDim }]}>
          No alert tags yet. An administrator assigns them. Posted documents still appear in
          Files, and you can turn alerts on below if you want to hear about them.
        </Text>
      )}
    </View>
  );
}

/**
 * Phone alerts.
 *
 * A real device only: an emulator has no Apple or Google token, and saying so is
 * better than a button that silently fails. The permission dialog is raised from
 * here and nowhere else, because iOS shows it once in the app's life.
 */
function PhoneAlertsSection() {
  const theme = useMetro();
  const { user } = useAuth();
  const tags = user?.notificationTags ?? [];
  const [status, setStatus] = useState<PhonePushStatus | null>(null);
  const [busy, setBusy] = useState<'enable' | 'disable' | 'test' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const limitation = phonePushLimitation();

  useEffect(() => {
    let live = true;

    // Read the state, do not change it: opening Account is not enabling, and a
    // device that was never switched on must not register just because this page
    // was visited. The button below is the only thing that asks for permission
    // and registers.
    void phonePushStatus()
      .then((next) => {
        if (live) setStatus(next);
      })
      .catch(() => {
        if (live) setStatus(null);
      });

    return () => {
      live = false;
    };
  }, []);

  const run = async (kind: 'enable' | 'disable' | 'test') => {
    setBusy(kind);
    setError(null);
    setNote(null);

    try {
      if (kind === 'enable') {
        const next = await enablePhonePush();
        setStatus(next);

        if (next.permission === 'denied') {
          setError('Notifications are off for this app in the phone\u2019s settings.');
        } else if (next.pending) {
          setNote('Registered. The push service has not confirmed it yet — we will keep trying.');
        } else if (next.registered) {
          setNote('This phone will now be told when something arrives for you.');
        }
      } else if (kind === 'disable') {
        await disablePhonePush();
        setStatus(await phonePushStatus());
        setNote('Alerts are off on this phone.');
      } else {
        await sendTestPhonePush();
        setNote('Sent. It should arrive in a moment, even if this screen is closed.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work. Try again.');
      setStatus(await phonePushStatus().catch(() => null));
    } finally {
      setBusy(null);
    }
  };

  const registered = status?.registered ?? false;
  const blocked = status?.permission === 'denied';

  const description = limitation
    ? limitation
    : blocked
      ? 'Notifications are off for this app. Turn them back on in the phone\u2019s settings.'
      : registered
        ? 'This phone is registered. Alerts arrive even when the app is not open.'
        : tags.length > 0
          ? 'Be told on this phone when a scan, a document or a message arrives for you.'
          : 'Turn this on to hear about a document posted for you — on this phone only. Nothing is asked until you do.';

  return (
    <View style={styles.block}>
      <MetroHeading
        accessory={registered ? <MetroBadge label="On" tone="accent" /> : undefined}>
        Phone alerts
      </MetroHeading>

      <Text style={[styles.note, { color: theme.textDim }]}>{description}</Text>

      {limitation ? null : (
        <View style={styles.actions}>
          {blocked ? (
            <MetroButton
              label="Open settings"
              variant="ghost"
              onPress={() => void Linking.openSettings().catch(() => {})}
            />
          ) : registered ? (
            <>
              <MetroButton
                label="Send a test"
                variant="ghost"
                loading={busy === 'test'}
                disabled={busy !== null}
                onPress={() => void run('test')}
              />
              <MetroButton
                label="Turn off"
                variant="ghost"
                loading={busy === 'disable'}
                disabled={busy !== null}
                onPress={() => void run('disable')}
              />
            </>
          ) : (
            <MetroButton
              label="Enable alerts"
              loading={busy === 'enable'}
              disabled={busy !== null}
              onPress={() => void run('enable')}
            />
          )}
        </View>
      )}

      {note ? (
        <MetroBanner message={note} tone="info" onDismiss={() => setNote(null)} />
      ) : null}
      {error ? (
        <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} />
      ) : null}
    </View>
  );
}

/**
 * Desktop alerts.
 *
 * A browser only — which is how v2 runs on Windows, macOS and Linux. The browser
 * owns the permission, so this block is the one place it is asked for, and only
 * from a press: an OS prompt that appears on its own is the prompt people refuse.
 * Blocked is a state of its own, because nothing this app can do will undo it and
 * a button that keeps failing is worse than a sentence saying where to look.
 */
function DesktopAlertsSection() {
  const theme = useMetro();
  const { user } = useAuth();
  const [status, setStatus] = useState<DesktopPushStatus | null>(null);
  const [busy, setBusy] = useState<'enable' | 'disable' | 'test' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Claim whatever the browser already had: a second person signing in on this
  // browser should get the alerts, not the first one.
  useEffect(() => {
    let live = true;

    // Only refreshes a subscription this account turned on — it never adopts one
    // that belongs to somebody else.
    void syncDesktopPush(user?.userId ?? '')
      .then((next) => {
        if (live) setStatus(next);
      })
      .catch(async () => {
        const next = await desktopPushStatus().catch(() => null);
        if (live) setStatus(next);
      });

    return () => {
      live = false;
    };
  }, [user?.userId]);

  const run = async (kind: 'enable' | 'disable' | 'test') => {
    setBusy(kind);
    setError(null);
    setNote(null);

    try {
      if (kind === 'enable') {
        const next = await enableDesktopPush(user?.userId ?? '');
        setStatus(next);

        if (next.permission === 'denied') {
          setError('Alerts are blocked for this site. Allow notifications in the browser first.');
        } else if (!next.subscribed) {
          setNote('Alerts were not turned on.');
        } else {
          setNote('This browser will now be told when a scanned code asks for it.');
        }
      } else if (kind === 'disable') {
        await disableDesktopPush();
        setStatus(await desktopPushStatus());
        setNote('Alerts are off in this browser.');
      } else {
        await sendTestDesktopPush();
        setNote('Sent. It should appear in a moment, outside this tab.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work. Try again.');
      setStatus(await desktopPushStatus().catch(() => null));
    } finally {
      setBusy(null);
    }
  };

  const subscribed = status?.subscribed ?? false;
  // A live subscription outranks the permission answer. An installed Safari web
  // app reports `denied` (iOS) or `default` for a permission the person granted,
  // and telling somebody to turn on what is already on is the one thing this
  // block must never do — so only an unsubscribed, denied browser is blocked.
  const blocked = !subscribed && status?.permission === 'denied';

  const description = blocked
    ? "Alerts are blocked for this site. Allow notifications in this browser's site settings, then reload this page."
    : subscribed
      ? 'This browser is subscribed. Alerts arrive even when this tab is closed.'
      : 'Turn alerts on in this browser to be told when a scan, a document or a message arrives for you. Works on Windows, macOS and Linux, and is per browser.';

  return (
    <View style={styles.block}>
      <MetroHeading accessory={subscribed ? <MetroBadge label="On" tone="accent" /> : undefined}>
        Desktop alerts
      </MetroHeading>

      <Text style={[styles.note, { color: theme.textDim }]}>{description}</Text>

      {status === null ? null : (
        <View style={styles.actions}>
          {blocked ? null : subscribed ? (
            <>
              <MetroButton
                label="Send a test"
                variant="ghost"
                loading={busy === 'test'}
                disabled={busy !== null}
                onPress={() => void run('test')}
              />
              <MetroButton
                label="Turn off"
                variant="ghost"
                loading={busy === 'disable'}
                disabled={busy !== null}
                onPress={() => void run('disable')}
              />
            </>
          ) : (
            <MetroButton
              label="Enable alerts"
              loading={busy === 'enable'}
              disabled={busy !== null}
              onPress={() => void run('enable')}
            />
          )}
        </View>
      )}

      {note ? (
        <MetroBanner message={note} tone="info" onDismiss={() => setNote(null)} />
      ) : null}
      {error ? (
        <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.round,
    overflow: 'hidden',
  },
  // Only the photograph needs an edge; the initials sit on their own colour.
  avatarPhoto: {
    borderWidth: 1,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: MetroType.subheader.fontSize,
    fontWeight: 600,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  email: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 4,
  },
  block: {
    gap: Spacing.two,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 500,
  },
  detailValue: {
    flexShrink: 1,
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 600,
    textAlign: 'right',
  },
  note: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: MetroType.subtle.fontWeight,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
