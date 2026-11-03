/**
 * Session token storage for the web build. expo-secure-store has no web
 * implementation, so the browser keeps the token in localStorage instead.
 */

const KEY = 'inssappv2.session';

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Private mode / blocked storage.
    return null;
  }
}

export async function getToken(): Promise<string | null> {
  return storage()?.getItem(KEY) ?? null;
}

export async function setToken(token: string): Promise<void> {
  storage()?.setItem(KEY, token);
}

export async function clearToken(): Promise<void> {
  storage()?.removeItem(KEY);
}
