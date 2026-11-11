import { apiFetch } from '@/lib/api/client';

/**
 * Desktop alerts — the browser build's implementation.
 *
 * This is what makes alerts reach Windows, macOS and Linux: the web build
 * subscribes to web push, the service worker at `/sw.js` shows what arrives, and
 * the API remembers the subscription against whoever is signed in.
 *
 * The browser asks for notification permission once and it must be from a click,
 * so `enableDesktopPush` is only ever called by the Account button and it asks
 * for permission before it awaits anything else — Safari and Firefox drop the
 * gesture otherwise, and no prompt appears.
 *
 * Nothing here runs on the server: `desktopPushSupported` guards every entry
 * point, so a server render sees `unsupported` rather than a missing `window`.
 */

const WORKER_URL = '/sw.js';

/**
 * Which account this browser's subscription was turned on for.
 *
 * A shared machine must not hand one person's alerts to the next, and an
 * investor must not inherit an employee's subscription by signing in: alerts are
 * switched on by pressing Enable, per browser. This records who did that, so a
 * sign-in alone can never claim an existing subscription.
 */
const OWNER_KEY = 'inssappv2.desktopPushUser';

function storedOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function rememberOwner(userId: string | null): void {
  try {
    if (userId) window.localStorage.setItem(OWNER_KEY, userId);
    else window.localStorage.removeItem(OWNER_KEY);
  } catch {
    // Private mode or a full quota: the subscription still works, it is just not
    // remembered — which at worst means the next visit offers Enable again.
  }
}

export interface DesktopPushStatus {
  /** Whether this build can receive browser alerts at all. */
  supported: boolean;
  /** The browser's answer to "may we show notifications". */
  permission: 'granted' | 'denied' | 'default' | 'unsupported';
  /** Whether this browser is already registered with the API. */
  subscribed: boolean;
}

const UNSUPPORTED: DesktopPushStatus = {
  supported: false,
  permission: 'unsupported',
  subscribed: false,
};

/** True when this browser has the three pieces web push needs. */
export function desktopPushSupported(): boolean {
  if (typeof window === 'undefined') return false;

  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function currentPermission(): DesktopPushStatus['permission'] {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/** A promise that cannot leave a screen waiting forever. */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The registration whose scope covers this page.
 *
 * Not `getRegistration('/sw.js')`: that asks for a registration whose scope
 * contains the *script* URL, which engines resolve differently, and an installed
 * web app (Safari on iOS, a browser app window on the desktop) can still be
 * activating its worker when this runs. Either failure made this return nothing,
 * which read as "alerts are off" on a browser that had them on. The scope walk
 * covers what is already registered; `ready` covers the one that is not yet.
 */
async function scopeRegistration(): Promise<ServiceWorkerRegistration | null> {
  const all = await navigator.serviceWorker.getRegistrations().catch(() => []);
  const scoped = all.find((entry) =>
    window.location.href.startsWith(entry.scope.replace(/\/$/, '')),
  );
  if (scoped) return scoped;

  return await withTimeout(
    navigator.serviceWorker.ready.catch(() => null),
    4000,
  );
}

/** The worker's registration, registering it the first time. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!desktopPushSupported()) return null;

  const existing = await scopeRegistration();
  if (existing) return existing;

  return navigator.serviceWorker.register(WORKER_URL, { scope: '/' });
}

/** This browser's subscription, if it has one — without creating it. */
async function currentSubscription(): Promise<PushSubscription | null> {
  if (!desktopPushSupported()) return null;

  const existing = await scopeRegistration();
  if (!existing) return null;

  return existing.pushManager.getSubscription().catch(() => null);
}

export async function desktopPushStatus(): Promise<DesktopPushStatus> {
  if (!desktopPushSupported()) return UNSUPPORTED;

  const subscription = await currentSubscription();

  return {
    supported: true,
    permission: currentPermission(),
    subscribed: Boolean(subscription),
  };
}

/**
 * Refreshes a subscription **this account** turned on, and never adopts one it
 * did not.
 *
 * Opening Account is not enabling: an investor who signs in on a browser where
 * somebody else once enabled alerts must not start receiving alerts because of it.
 * So the subscription is re-saved only when the recorded owner is this account (or
 * unknown, for a subscription made before owners were recorded). Otherwise the
 * screen simply offers Enable, and pressing it takes the browser over.
 */
export async function syncDesktopPush(userId: string): Promise<DesktopPushStatus> {
  if (!desktopPushSupported()) return UNSUPPORTED;

  const subscription = await currentSubscription();
  const owner = storedOwner();
  let claimed = false;
  let saveFailed = false;

  if (subscription && (!owner || owner === userId)) {
    // A subscription is this browser's own proof that alerts were allowed here,
    // and it is the only proof that survives everything else. The permission
    // answer is deliberately not required: an installed web app reports `denied`
    // (iOS) or `default` (Safari) for permissions the person has granted, and
    // gating on it is what made this screen offer Enable to somebody who had
    // already pressed it.
    try {
      await save(subscription);
      rememberOwner(userId);
      claimed = true;
    } catch {
      // The server did not take it this time. The subscription is still live, so
      // it stays on here and the next launch retries the save.
      saveFailed = true;
    }
  }

  return {
    supported: true,
    permission: currentPermission(),
    // Subscribed means this browser has a subscription for this account — not
    // that the last save round-tripped. An unclaimed subscription (owned by
    // somebody else) is the one case that reads as off, because it is theirs.
    subscribed: Boolean(subscription) && (claimed || saveFailed),
  };
}

/**
 * Asks the browser, subscribes, and tells the API.
 *
 * Call from a press handler. The permission request is the first thing that
 * happens, before any network call, because that is the only way the prompt is
 * allowed to appear.
 */
export async function enableDesktopPush(userId: string): Promise<DesktopPushStatus> {
  if (!desktopPushSupported()) {
    throw new Error('This browser cannot show alerts.');
  }

  const answer = await Notification.requestPermission();
  if (answer !== 'granted') {
    // WebKit in an installed web app can answer `default` — and iOS `denied` —
    // for a permission the person did just grant. A live subscription is the
    // proof that matters, so it is checked before this reports failure.
    const already = await currentSubscription();
    if (!already) return { supported: true, permission: answer, subscribed: false };
  }

  const { publicKey } = await apiFetch<{ publicKey: string | null }>('/api/mobile/push/key');
  if (!publicKey) {
    throw new Error('Alerts are not configured on the server yet.');
  }

  await registration();

  // `ready` is a worker that can actually subscribe; a just-registered one is not
  // until it has activated. Bounded, so a worker that never activates is an error
  // the person can act on rather than a button spinning forever.
  const active =
    (await withTimeout(navigator.serviceWorker.ready, 8000)) ?? (await scopeRegistration());
  if (!active) {
    throw new Error('This browser has not finished installing its offline worker. Reload and try again.');
  }
  const existing = await active.pushManager.getSubscription();

  const subscription =
    existing ??
    (await active.pushManager.subscribe({
      // Every browser requires this, and it is a promise we keep: a received
      // push always shows something.
      userVisibleOnly: true,
      applicationServerKey: decodeKey(publicKey),
    }));

  await save(subscription);
  rememberOwner(userId);

  return { supported: true, permission: 'granted', subscribed: true };
}

/** Stops alerts to this browser, here and on the server. */
export async function disableDesktopPush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;

  const { endpoint } = subscription;

  // The server first: a browser that unsubscribes locally still has a row
  // pointing at a dead endpoint until the next prune.
  await apiFetch('/api/mobile/push/unsubscribe', {
    method: 'POST',
    body: { endpoint },
  }).catch(() => {});

  await subscription.unsubscribe().catch(() => {});
  rememberOwner(null);
}

/** One alert to this browser, so someone can prove it works. */
export async function sendTestDesktopPush(): Promise<void> {
  await apiFetch('/api/mobile/push/test', { method: 'POST' });
}

async function save(subscription: PushSubscription): Promise<void> {
  const keys = subscription.toJSON().keys;

  if (!keys?.p256dh || !keys.auth) {
    throw new Error('This browser did not hand back its push keys.');
  }

  await apiFetch('/api/mobile/push/subscribe', {
    method: 'POST',
    body: {
      endpoint: subscription.endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      device: describeDevice(),
    },
  });
}

/**
 * `applicationServerKey` takes bytes, and the key arrives base64url-encoded.
 */
function decodeKey(value: string): BufferSource {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const raw = atob(padded);

  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return bytes;
}

/** Enough to recognise the device in a list later, no fingerprinting. */
function describeDevice(): string {
  const agent = navigator.userAgent;

  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /OPR\//.test(agent)
      ? 'Opera'
      : /Firefox\//.test(agent)
        ? 'Firefox'
        : /Chrome\//.test(agent)
          ? 'Chrome'
          : /Safari\//.test(agent)
            ? 'Safari'
            : 'Browser';

  const platform = /Windows/.test(agent)
    ? 'Windows'
    : /Mac OS X|Macintosh/.test(agent)
      ? 'macOS'
      : /Android/.test(agent)
        ? 'Android'
        : /Linux/.test(agent)
          ? 'Linux'
          : /iPhone|iPad/.test(agent)
            ? 'iOS'
            : 'Desktop';

  // An installed web app is a different client from the Safari tab that added it:
  // its subscriptions are its own, so the account's device list should say which
  // is which rather than showing two identical lines.
  const installed =
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return `${browser} on ${platform}${installed ? ' (installed app)' : ''}`;
}
