import * as SecureStore from 'expo-secure-store';

/**
 * Preference storage for iOS and Android.
 *
 * It reuses expo-secure-store because that is the key/value store the app
 * already ships — the value here is a UI preference, not a secret. Web uses
 * `storage.web.ts`.
 */

const KEY = 'inssappv2.accent';
const ALLOCATION_KEY = 'inssappv2.allocationView';

export async function getStoredAccent(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    // A failed keychain read should never stop the app from painting.
    return null;
  }
}

export async function setStoredAccent(accentId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, accentId);
  } catch {
    // Preference only: keep the in-memory choice if the write fails.
  }
}

/** How the investor portfolio draws its allocation: v1's pie, or the flat bar. */
export async function getStoredAllocationView(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ALLOCATION_KEY);
  } catch {
    return null;
  }
}

export async function setStoredAllocationView(view: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(ALLOCATION_KEY, view);
  } catch {
    // Preference only: keep the in-memory choice if the write fails.
  }
}
