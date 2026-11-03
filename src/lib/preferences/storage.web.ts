/**
 * Preference storage for the web build. expo-secure-store has no web
 * implementation, so the browser keeps preferences in localStorage.
 */

const KEY = 'inssappv2.accent';
const ALLOCATION_KEY = 'inssappv2.allocationView';

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Private mode / blocked storage.
    return null;
  }
}

export async function getStoredAccent(): Promise<string | null> {
  return storage()?.getItem(KEY) ?? null;
}

export async function setStoredAccent(accentId: string): Promise<void> {
  storage()?.setItem(KEY, accentId);
}

/** How the investor portfolio draws its allocation: v1's pie, or the flat bar. */
export async function getStoredAllocationView(): Promise<string | null> {
  return storage()?.getItem(ALLOCATION_KEY) ?? null;
}

export async function setStoredAllocationView(view: string): Promise<void> {
  storage()?.setItem(ALLOCATION_KEY, view);
}
