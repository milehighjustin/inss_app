/**
 * Desktop alerts — the phone build's answer.
 *
 * Alerts are delivered by web push to a browser, which is how v2 runs on Windows,
 * macOS and Linux. iOS and Android have no implementation yet, so this file
 * reports `supported: false` and the Account screen draws nothing at all: no
 * permission prompt, no dead button. Phone push grows the same three functions
 * here when it lands — the screen does not change.
 */

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

/** False on a phone: there is no browser to subscribe. */
export function desktopPushSupported(): boolean {
  return false;
}

export async function desktopPushStatus(): Promise<DesktopPushStatus> {
  return UNSUPPORTED;
}

/** Nothing to re-register when there is no subscription. */
export async function syncDesktopPush(_userId: string): Promise<DesktopPushStatus> {
  return UNSUPPORTED;
}

export async function enableDesktopPush(_userId: string): Promise<DesktopPushStatus> {
  throw new Error('Desktop alerts are only available in a browser.');
}

export async function disableDesktopPush(): Promise<void> {}

export async function sendTestDesktopPush(): Promise<void> {
  throw new Error('Desktop alerts are only available in a browser.');
}
