/**
 * Kiosk mode is for the installed apps only.
 *
 * A browser tab is not a kiosk: whoever holds the machine can open another tab,
 * and the page cannot keep itself in front. So the web build has no kiosk mode,
 * no setting for it, and always starts in the normal app.
 */

export function kioskModeSupported(): boolean {
  return false;
}

export async function readKioskDeviceId(): Promise<string | null> {
  return null;
}

export async function writeKioskDeviceId(_deviceId: string | null): Promise<void> {}
