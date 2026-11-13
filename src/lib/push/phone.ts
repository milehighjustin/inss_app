import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import { receivesAlerts } from '@/lib/push/audience';

/**
 * Phone alerts.
 *
 * A phone is reached through Azure Notification Hubs: this device registers its
 * APNs (iOS) or FCM (Android) token, the server stores it against the account
 * with the account's notification tags, and a send finds it by tag. No Expo push
 * token is involved — the hub talks to Apple and Google directly.
 *
 * Three rules are worth stating because they are easy to get wrong:
 *
 * 1. **Nothing is addressed, nothing is asked.** An account with no notification
 *    tags that is not an investor never sees the OS dialog, and any installation
 *    it had is removed, so the hub is not spending sends on a person nothing is
 *    addressed to.
 * 2. **Turning alerts on is the person's own act, per device.** The dialog is
 *    raised from the Account button and nowhere else, and this module keeps a
 *    local opt-in flag: a launch never registers a device that has not been
 *    switched on, even where the OS would have granted permission silently. A
 *    second phone is a second decision.
 * 3. **The channels exist before the prompt.** Android 13 will not show the
 *    permission dialog until the app has created a channel, and a channel's
 *    importance cannot be changed after it is created — so the two channels are
 *    made once, with their final settings, on the first launch.
 *
 * Web is a different channel entirely; `phone.web.ts` is the no-op this module
 * becomes in a browser.
 */

/** Where this device's installation id lives between launches. */
const INSTALLATION_KEY = 'inssappv2.pushInstallation';

/**
 * Whether alerts were switched on **on this device**.
 *
 * The installation id alone is not enough: it is written the moment a sync
 * succeeds, and permission can be granted by the OS without the person visiting
 * Account (older Android grants it at install). This flag is only set by pressing
 * Enable, so a fresh device stays silent until its owner asks for alerts.
 */
const OPT_IN_KEY = 'inssappv2.pushOptIn';

export const LOUD_CHANNEL = 'alerts-loud';
export const QUIET_CHANNEL = 'alerts-quiet';

export type PhonePushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface PhonePushStatus {
  supported: boolean;
  permission: PhonePushPermission;
  /** This device is registered with the API. */
  registered: boolean;
  /** Registered here, but the hub has not accepted it yet. */
  pending: boolean;
  /** What the hub said, when it refused. */
  error?: string;
}

const UNSUPPORTED: PhonePushStatus = {
  supported: false,
  permission: 'unsupported',
  registered: false,
  pending: false,
};

/** Push needs iOS or Android — and a real device, not a simulator. */
export function phonePushSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Why push cannot work here, in a sentence, or null when it can. */
export function phonePushLimitation(): string | null {
  if (!phonePushSupported()) return 'Alerts are not available on this device.';
  if (!Device.isDevice) {
    return 'Push needs a real phone or tablet: an emulator has no Apple or Google push token.';
  }
  return null;
}

async function storedInstallationId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(INSTALLATION_KEY);
  } catch {
    return null;
  }
}

async function storeInstallationId(id: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(INSTALLATION_KEY, id);
  } catch {
    // Without the id the next launch registers a new installation; the old row
    // is pruned by the reconcile cron.
  }
}

async function forgetInstallationId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(INSTALLATION_KEY);
  } catch {
    // Nothing to do: an unreachable keychain is not worth failing a sign-out.
  }
}

/**
 * Whether this device was deliberately switched on.
 *
 * A stored installation id counts too: it means a sync already happened on this
 * device, which only the Enable button (or a launch before this rule existed)
 * could have caused, and refusing to refresh its token would break alerts that
 * are already working.
 */
async function deviceOptedIn(): Promise<boolean> {
  try {
    if ((await SecureStore.getItemAsync(OPT_IN_KEY)) === 'yes') return true;
  } catch {
    // Fall through to the installation id.
  }

  return Boolean(await storedInstallationId());
}

async function rememberOptIn(optedIn: boolean): Promise<void> {
  try {
    if (optedIn) await SecureStore.setItemAsync(OPT_IN_KEY, 'yes');
    else await SecureStore.deleteItemAsync(OPT_IN_KEY);
  } catch {
    // The installation id still decides; a failed write only means a launch
    // behaves as it did before the button was pressed.
  }
}

/**
 * An id for this install, generated once.
 *
 * It is not a secret and does not identify the person — only the container the
 * hub routes to — so a random string is enough. It must survive launches, which
 * is why it is stored rather than derived.
 */
function newInstallationId(): string {
  const random = () => Math.random().toString(36).slice(2, 10);

  return `inss-${Date.now().toString(36)}-${random()}${random()}`;
}

/**
 * The two channels, created before anyone is asked anything.
 *
 * Loud is a high-importance channel with a sound and vibration. Quiet is low
 * importance: it appears in the shade without a sound, which is what "quiet"
 * has to mean on Android — there is no per-message sound switch.
 */
async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(LOUD_CHANNEL, {
    name: 'Alerts',
    description: 'A scan of a code you watch that needs attention.',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
    enableVibrate: true,
  }).catch(() => null);

  await Notifications.setNotificationChannelAsync(QUIET_CHANNEL, {
    name: 'Quiet alerts',
    description: 'Worth knowing about, not worth interrupting for.',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    showBadge: false,
    enableVibrate: false,
  }).catch(() => null);
}

/*
 * There is deliberately no `setNotificationHandler` here.
 *
 * It used to be installed from an effect, and it re-implemented what the
 * notification already says about itself: show it, and play the sound it
 * carries. A quiet alert is sent without a sound, so iOS plays nothing for it
 * anyway — the handler only decided something the payload had already decided.
 *
 * What it cost was a native round trip on every arriving notification, on the
 * code path where expo-notifications' own iOS delegate calls back into JS and
 * waits for an answer. That path has crashed the app in release builds; 58.1.3
 * fixed one such crash (a late answer racing a timeout or a second notification),
 * and a handler that does not exist cannot race anything. Since SDK 58 a
 * foreground notification is presented by default, exactly as the handler asked
 * for, so nothing is lost by leaving the decision to the library.
 */

function permissionOf(status: Notifications.PermissionStatus): PhonePushPermission {
  if (status === 'granted' || status === 'denied') return status;
  return 'undetermined';
}

export async function phonePushStatus(): Promise<PhonePushStatus> {
  if (!phonePushSupported()) return UNSUPPORTED;

  const permission = permissionOf((await Notifications.getPermissionsAsync()).status);
  const id = await storedInstallationId();

  return {
    supported: true,
    permission,
    registered: permission === 'granted' && Boolean(id),
    pending: false,
  };
}

/**
 * What this process last sent, so the same registration is not sent again.
 *
 * `getDevicePushTokenAsync()` asks iOS to register for remote notifications, and
 * iOS answers by announcing the token again — through `addPushTokenListener`,
 * whose handler calls back into here. Token → register → token is a loop, and it
 * is a loop that costs one API request each time round: that is what flooded the
 * server. The token is remembered, so the re-announcement of a token we already
 * sent is not news.
 */
let lastAttemptToken: string | null = null;
let lastAttemptAt = 0;
let lastAttemptOk = false;

/** How long a token is trusted as sent, when a launch or a remount asks again. */
const RESYNC_AFTER_MS = 60_000;

/** The registration already in flight, so two callers share one request. */
let syncing: Promise<PhonePushStatus> | null = null;

/**
 * Registers this device, or refreshes its token.
 *
 * Idempotent: the installation id is stable, so a foreground, a token rollover
 * and a tag change all land on the same row. `pending: true` means the hub has
 * not accepted it yet — the reconcile cron retries, so the app tells the truth
 * rather than claiming alerts work.
 *
 * Coalesced and deduplicated: concurrent callers await the same request, and the
 * same token is not sent again within `RESYNC_AFTER_MS`. `force` is for the one
 * caller that has a reason to re-send anyway — the Enable button, where the tags
 * may have changed since the last sync.
 */
export async function syncPhonePush(options: { force?: boolean } = {}): Promise<PhonePushStatus> {
  if (!phonePushSupported()) return UNSUPPORTED;
  if (syncing) return syncing;

  const run = async (): Promise<PhonePushStatus> => {
    const permission = permissionOf((await Notifications.getPermissionsAsync()).status);
    if (permission !== 'granted') {
      return { supported: true, permission, registered: false, pending: false };
    }

    const installationId = (await storedInstallationId()) ?? newInstallationId();
    await storeInstallationId(installationId);

    let token: string;
    try {
      const device = await Notifications.getDevicePushTokenAsync();
      token = String(device.data);
    } catch (cause) {
      return {
        supported: true,
        permission,
        registered: Boolean(await storedInstallationId()),
        pending: false,
        error:
          cause instanceof Error
            ? cause.message
            : 'This device has no push token yet. Try again in a moment.',
      };
    }

    // Recorded before the request, not after it: a registration that fails still
    // asked iOS for the token, which is what re-announces it. Leaving the record
    // to the success path would let a failing API produce the same loop as a
    // working one, only slower.
    if (
      !options.force &&
      token === lastAttemptToken &&
      Date.now() - lastAttemptAt < RESYNC_AFTER_MS
    ) {
      return {
        supported: true,
        permission,
        registered: lastAttemptOk,
        pending: !lastAttemptOk,
        error: lastAttemptOk ? undefined : 'The push service has not accepted this device yet.',
      };
    }

    lastAttemptToken = token;
    lastAttemptAt = Date.now();
    lastAttemptOk = false;

    try {
      const result = await apiFetch<{
        installation: { installationId: string };
        synced: boolean;
        error?: string;
      }>('/api/mobile/notifications/installations', {
        method: 'POST',
        body: {
          installationId,
          platform: Platform.OS,
          pushChannel: token,
          appVersion: Constants.expoConfig?.version ?? '',
          deviceLabel: `${Device.modelName ?? 'Device'} · ${Platform.OS === 'ios' ? 'iOS' : 'Android'}`,
        },
      });

      lastAttemptOk = result.synced;

      return {
        supported: true,
        permission,
        registered: true,
        pending: !result.synced,
        error: result.synced ? undefined : result.error,
      };
    } catch (cause) {
      return {
        supported: true,
        permission,
        registered: true,
        pending: true,
        error: cause instanceof Error ? cause.message : 'The device could not be registered.',
      };
    }
  };

  syncing = run().finally(() => {
    syncing = null;
  });

  return syncing;
}

/**
 * Asks for permission and registers — call from a press.
 *
 * Unlike the browser, iOS and Android only show the dialog once in the app's
 * lifetime, so this is deliberately not raised on launch.
 */
export async function enablePhonePush(): Promise<PhonePushStatus> {
  const limitation = phonePushLimitation();
  if (limitation) throw new Error(limitation);

  // The channel must exist before the dialog, or Android 13 shows nothing.
  await ensureChannels();

  const answer = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });

  const permission = permissionOf(answer.status);
  if (permission !== 'granted') {
    return { supported: true, permission, registered: false, pending: false };
  }

  // The device is switched on from here: this is the press every later launch
  // looks for before it re-registers a rotated token.
  await rememberOptIn(true);

  // Forced: pressing Enable says "this device, with these tags, now".
  return syncPhonePush({ force: true });
}

/** Removes this device, here and in the hub. */
export async function disablePhonePush(): Promise<void> {
  const installationId = await storedInstallationId();
  if (!installationId) {
    await rememberOptIn(false);
    return;
  }

  await apiFetch(
    `/api/mobile/notifications/installations/${encodeURIComponent(installationId)}`,
    { method: 'DELETE' },
  ).catch(() => {});

  await forgetInstallationId();
  await rememberOptIn(false);

  // A device that is switched off has nothing registered; switching it back on
  // must be able to send again.
  lastAttemptToken = null;
  lastAttemptAt = 0;
  lastAttemptOk = false;
}

/** One alert to this phone, from the same endpoint the browser uses. */
export async function sendTestPhonePush(): Promise<void> {
  await apiFetch('/api/mobile/push/test', { method: 'POST' });
}

/**
 * Keeps this device registered for as long as someone is signed in.
 *
 * Mounted once, beside the navigation shell. It reacts to the account rather
 * than to a screen: an account nothing is addressed to unregisters, and a device
 * that was switched on keeps its token fresh without anyone opening Account.
 *
 * "Addressed" is not only tags: investor documents are posted to the investors
 * who can read them, so an investor's phone belongs here even with no tags. That
 * makes it eligible — not enrolled. **A launch never registers a device its owner
 * has not switched on**, which is why every path here asks `deviceOptedIn` first: a
 * second phone, or a fresh install, waits for Account like the first one did.
 */
export function usePhonePushRegistration(): void {
  const { status, user } = useAuth();
  const userId = user?.userId;
  const addressed = receivesAlerts(user);

  useEffect(() => {
    if (status !== 'signedIn' || !userId) return;

    if (!addressed) {
      // Nothing will ever be addressed to them, so this device should not be
      // holding a registration open.
      void disablePhonePush().catch(() => {});
      return;
    }

    let cancelled = false;

    void (async () => {
      if (!(await deviceOptedIn()) || cancelled) return;
      await ensureChannels().catch(() => {});
      await syncPhonePush().catch(() => {});
    })();

    const subscription = Notifications.addPushTokenListener((device) => {
      // iOS re-announces the same token every time registration is requested, so
      // this event is not a change on its own. Registering again because of it
      // is the loop that flooded the API: only a token we have not sent is news.
      const token = String(device?.data ?? '');
      if (!token || token === lastAttemptToken || syncing) return;

      // A rotated token only matters for a device that is switched on.
      void (async () => {
        if (await deviceOptedIn()) await syncPhonePush().catch(() => {});
      })();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [status, userId, addressed]);
}
