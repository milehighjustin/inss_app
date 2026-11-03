const WORKER_URL = '/sw.js';

/**
 * Registers the service worker on every launch.
 *
 * This runs whether or not anyone has asked for alerts: a worker is what makes
 * the app installable and what lets the installed window open with no network.
 * Desktop alerts used to be the only reason one existed, which meant a fresh
 * visitor could not install the app at all.
 *
 * Registering is idempotent — the browser reuses the worker already in scope and
 * checks `sw.js` for changes in the background — so calling it on every mount
 * costs nothing.
 */
export function registerWebApp(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  // A worker only runs on a secure origin. localhost counts, so the installed
  // app can be tried in development.
  const { protocol, hostname } = window.location;
  const secure =
    protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
  if (!secure) return;

  void navigator.serviceWorker.register(WORKER_URL, { scope: '/' }).catch(() => {
    // No worker means no offline shell and no desktop alerts; the app still
    // works. Not worth a failed request on every launch.
  });
}
