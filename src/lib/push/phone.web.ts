import { useEffect } from 'react';

/**
 * Phone alerts in a browser: nothing.
 *
 * The browser's channel is web push, implemented beside this in `browser.web.ts`.
 * This file exists so the Account screen and the app shell can ask the same
 * questions on every platform without branching — `phonePushSupported()` is false
 * here, so nothing native is ever imported or drawn.
 */

export type PhonePushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface PhonePushStatus {
  supported: boolean;
  permission: PhonePushPermission;
  registered: boolean;
  pending: boolean;
  error?: string;
}

const UNSUPPORTED: PhonePushStatus = {
  supported: false,
  permission: 'unsupported',
  registered: false,
  pending: false,
};

export function phonePushSupported(): boolean {
  return false;
}

/** Why phone push cannot work here, in a sentence, or null when it can. */
export function phonePushLimitation(): string | null {
  return 'Phone alerts are not available in a browser. Desktop alerts are below.';
}

export async function phonePushStatus(): Promise<PhonePushStatus> {
  return UNSUPPORTED;
}

export async function syncPhonePush(): Promise<PhonePushStatus> {
  return UNSUPPORTED;
}

export async function enablePhonePush(): Promise<PhonePushStatus> {
  throw new Error('Phone alerts are only available in the iOS and Android app.');
}

export async function disablePhonePush(): Promise<void> {}

export async function sendTestPhonePush(): Promise<void> {
  throw new Error('Phone alerts are only available in the iOS and Android app.');
}

export function installForegroundHandler(): void {}

/** Registration is a native concern; there is nothing to keep in step here. */
export function usePhonePushRegistration(): void {
  useEffect(() => {}, []);
}
