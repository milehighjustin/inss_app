import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  ApiError,
  fetchSessionUser,
  requestMagicLink as requestMagicLinkRequest,
  signInWithPassword,
  type AuthUser,
} from './api';
import { setUnauthorizedHandler } from '@/lib/api/client';

import { clearToken, getToken, setToken } from './storage';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Why an existing session could not be restored, shown once on the sign-in screen. */
  notice: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: (username: string, password: string) => Promise<void>;
  /** Finishes the magic-link flow with the token handed over by the deep link. */
  completeMagicLink: (token: string) => Promise<void>;
  requestMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, notice: null });

  // Restore a stored session on launch, and drop it if the server no longer accepts it.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await getToken();
      if (!stored) {
        if (!cancelled) setState({ status: 'signedOut', user: null, notice: null });
        return;
      }

      try {
        const user = await fetchSessionUser(stored);
        if (!cancelled) setState({ status: 'signedIn', user, notice: null });
      } catch (error) {
        const rejected = error instanceof ApiError && error.status === 401;
        if (rejected) await clearToken();
        if (!cancelled) {
          setState({
            status: 'signedOut',
            user: null,
            notice: rejected
              ? 'Your session has expired. Please sign in again.'
              : 'We could not reach the server. Sign in to continue.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Any authenticated request that comes back 401 ends the session here, so no
  // screen has to handle an expired/deactivated user itself.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearToken();
      setState({
        status: 'signedOut',
        user: null,
        notice: 'Your session has expired. Please sign in again.',
      });
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const session = await signInWithPassword(username.trim(), password);
    await setToken(session.token);
    setState({ status: 'signedIn', user: session.user, notice: null });
  }, []);

  const completeMagicLink = useCallback(async (token: string) => {
    const user = await fetchSessionUser(token);
    await setToken(token);
    setState({ status: 'signedIn', user, notice: null });
  }, []);

  const requestMagicLink = useCallback(async (email: string) => {
    await requestMagicLinkRequest(email.trim());
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setState({ status: 'signedOut', user: null, notice: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, completeMagicLink, requestMagicLink, signOut }),
    [state, signIn, completeMagicLink, requestMagicLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
