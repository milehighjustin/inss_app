/*
 * The service worker: what makes the installed app open offline, and what
 * delivers desktop alerts.
 *
 * A browser only receives a push if a service worker is registered for the site,
 * and the worker — not the page — is what shows the notification. This file is
 * served from the site root (`/sw.js`) so its scope is the whole app, and it is
 * plain JavaScript on purpose: it is copied to the build as-is and never goes
 * through Metro.
 *
 * It does two jobs:
 *
 * 1. **The app shell.** An installed app must open with no network. The build is
 *    a single-page app, so every route is the same document; the newest one
 *    fetched is kept and served when a navigation fails. `offline.html` is the
 *    last resort for a first visit that never got through.
 * 2. **Push.** The payload comes from `src/push/browser.ts` on the API:
 *
 *      { title, body, priority: 'loud' | 'quiet', silent, tag, renotify, url, … }
 *
 *    Nothing here talks to the API: the server already decided who to tell.
 */

const DEFAULT_TITLE = 'INSS';

/** Where the shell and the fallback page are kept. Bump to drop old copies. */
const SHELL_CACHE = 'inss-shell-v2';

/**
 * The build's own files: the JS bundle, its CSS, fonts.
 *
 * They are content-hashed by Expo (`entry-<hash>.js`), so a URL never changes
 * meaning and cache-first is safe. Without them an offline launch renders an
 * empty page — the document arrives and the bundle does not.
 */
const STATIC_CACHE = 'inss-static-v1';

/** A cache entry that records which build the static cache belongs to. */
const ENTRY_MARKER = '/__build-entry';

/**
 * What is fetched during install.
 *
 * The document and the offline page are the two that matter for opening with no
 * network; the manifest and icons are small and make the installed window
 * complete on its first frame.
 */
const PRECACHE = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/splash-logo.png',
];

/**
 * A path in the payload turned into an absolute URL on this origin.
 *
 * The API sends `/notification-icon.png` because it does not know where the app
 * is hosted; the worker does, so it does the resolving. `undefined` when there is
 * nothing to resolve, so the browser falls back to its own mark rather than
 * requesting a file that may not exist.
 */
function asset(path) {
  if (!path || typeof path !== 'string') return undefined;

  try {
    return new URL(path, self.location.origin).href;
  } catch {
    return undefined;
  }
}

/** The payload, whether it arrived as JSON or as a plain string. */
function readMessage(event) {
  if (!event.data) return {};

  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}

/**
 * Keeps the newest copy of the app shell.
 *
 * Any navigation response for this origin is the app document — it is a
 * single-page build — so it is stored under `/` as well as its own URL. That is
 * what makes the *last* build the one that opens offline, however the person
 * happened to reach it.
 */
async function rememberShell(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return;

  try {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put('/', response.clone());
    await cache.put(request, response.clone());

    // A new build means a new bundle. The old hashed files can never be used
    // again, so drop them rather than accumulating a megabyte per deploy.
    const html = await response.clone().text();
    const entry = html.match(/entry-[0-9a-f]+\.js/)?.[0];
    if (entry) {
      const marker = await cache.match(ENTRY_MARKER);
      const known = marker ? await marker.text() : '';
      if (known !== entry) {
        await caches.delete(STATIC_CACHE);
        await cache.put(ENTRY_MARKER, new Response(entry));
      }
    }
  } catch {
    // Storage full or unavailable: the app still works, it just will not open
    // offline. Never turn that into a failed page load.
  }
}

/** The build's files: the copy already kept, else the network and keep that. */
async function staticResponse(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

/**
 * Only the build's own content-hashed files — never an API call, and never the
 * development server's bundle.
 *
 * `expo export` names everything after its contents (`entry-<hash>.js`,
 * `arrow_down.<hash>.png`), so a URL can never mean something new and cache-first
 * is safe. `expo start --web` serves the same paths *without* a hash
 * (`entry.bundle?platform=web&dev=true`); caching those would pin one dev build
 * across reloads and fight hot reload, so they are left to the network.
 */
function isBuildFile(url) {
  if (!url.pathname.startsWith('/_expo/') && !url.pathname.startsWith('/assets/')) {
    return false;
  }

  return /(?:-|\.)[0-9a-f]{8,}\.[a-z0-9]+$/i.test(url.pathname);
}

/** The app document for a navigation: the network, then the last copy kept. */
async function navigationResponse(request) {
  try {
    const response = await fetch(request);
    await rememberShell(request, response.clone());
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (
      (await cache.match(request)) ||
      (await cache.match('/')) ||
      (await cache.match('/offline.html')) ||
      new Response('You are offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  }
}

// Take over as soon as possible: a worker waiting behind an old one would keep
// showing the previous build's behaviour.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);

      // One at a time and never fatal: a single 404 on a deploy preview must not
      // leave the app with no worker at all.
      await Promise.all(
        PRECACHE.map((path) =>
          cache.add(new Request(path, { cache: 'reload' })).catch(() => {}),
        ),
      );

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('inss-shell-') && name !== SHELL_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Navigations and the build's files. Everything else is left alone.
 *
 * Every API call is untouched: a cached answer about who is signed in or what a
 * KPI row says is worse than no answer.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (isBuildFile(url)) {
    event.respondWith(staticResponse(request));
  }
});

self.addEventListener('push', (event) => {
  const message = readMessage(event);
  const quiet = message.priority === 'quiet' || message.silent === true;

  event.waitUntil(
    self.registration.showNotification(message.title || DEFAULT_TITLE, {
      body: message.body || '',
      // Reusing a tag replaces the earlier alert instead of stacking a second
      // one: two scans of the same sign are one thing to deal with.
      tag: message.tag || 'inss',
      // Quiet is there when you look; loud says so, and waits to be dismissed.
      silent: quiet,
      requireInteraction: !quiet,
      // Only meaningful with a tag, and only for loud: a replaced quiet alert
      // must stay silent.
      renotify: !quiet,
      // The app's own mark instead of the browser's, so the alert is attributed
      // to INSS. Omitted entirely when the payload has none.
      ...(asset(message.icon) ? { icon: asset(message.icon) } : {}),
      ...(asset(message.badge) ? { badge: asset(message.badge) } : {}),
      data: { url: message.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const target = new URL(data.url || '/', self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Prefer a window that is already open, so a click lands in the app the
      // person left rather than a second copy of it.
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;

        if (client.url !== target && 'navigate' in client) {
          await client.navigate(target).catch(() => {});
        }
        return client.focus();
      }

      return self.clients.openWindow(target);
    })(),
  );
});
