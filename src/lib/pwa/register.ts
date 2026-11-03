/**
 * The service worker is a browser thing.
 *
 * A native build is installed by the App Store or a sideload and the OS owns
 * updating it, so there is nothing to register. Web and native share the call
 * site so the root layout does not need a platform check of its own.
 */
export function registerWebApp(): void {}
