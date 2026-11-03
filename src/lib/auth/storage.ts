import * as SecureStore from 'expo-secure-store';

/**
 * Session token storage for iOS and Android. The token lives in the device
 * keychain/keystore rather than plain storage. Web uses `storage.web.ts`.
 */

const KEY = 'inssappv2.session';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
