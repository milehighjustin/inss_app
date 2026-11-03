import { apiFetch, ApiError } from '@/lib/api/client';

/**
 * Auth endpoints on v1.
 *
 * Sign-in reuses the website's own credential check, so the app and the site
 * accept the same accounts. v1 answers with a bearer token instead of a cookie
 * because a native app cannot hold an httpOnly session cookie.
 */

export { API_URL, ApiError } from '@/lib/api/client';

export interface AuthUser {
  userId: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  roles: string[];
  /**
   * The notification tags this account hears. Empty means no alert is ever
   * addressed to them, so the app never asks for notification permission.
   */
  notificationTags: string[];
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

/** Email/username + password, exactly as the website's sign-in form. */
export function signInWithPassword(username: string, password: string): Promise<AuthSession> {
  return apiFetch<AuthSession>('/api/mobile/auth/signin', {
    method: 'POST',
    body: { username, password },
    anonymous: true,
  });
}

/** Confirms a token is still valid and returns the current profile. */
export async function fetchSessionUser(token?: string): Promise<AuthUser> {
  const body = await apiFetch<{ user: AuthUser }>('/api/mobile/auth/session', { token });
  return body.user;
}

/** Asks the backend to email a one-time sign-in link. */
export function requestMagicLink(email: string): Promise<{ sent: boolean }> {
  return apiFetch<{ sent: boolean }>('/api/mobile/auth/magic-link', {
    method: 'POST',
    body: { email },
    anonymous: true,
  });
}
