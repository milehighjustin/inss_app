import * as SecureStore from 'expo-secure-store';

/**
 * Kiosk mode on iOS and Android.
 *
 * A kiosk is a device that only ever shows one screen, so the chosen device id
 * is kept on the device itself and read before the first screen paints. It
 * reuses expo-secure-store because that is the key/value store the app already
 * ships; the value is configuration, not a secret.
 *
 * A browser tab cannot be a kiosk, so the web build has no kiosk mode at all —
 * `storage.web.ts` says so.
 */

const KEY = 'inssappv2.kioskDevice';

export function kioskModeSupported(): boolean {
  return true;
}

export async function readKioskDeviceId(): Promise<string | null> {
  try {
    const value = await SecureStore.getItemAsync(KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    // A failed keychain read must not stop the app from starting.
    return null;
  }
}

export async function writeKioskDeviceId(deviceId: string | null): Promise<void> {
  try {
    if (deviceId) await SecureStore.setItemAsync(KEY, deviceId);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Configuration only: the in-memory choice still applies for this launch.
  }
}
