import { getToken } from '@/lib/auth/storage';

/**
 * The one place the app talks to the API.
 *
 * The API is inss-app-backend, not the website: v1 only ever ran in development.
 * Every request carries the session bearer token unless it is explicitly
 * anonymous. A 401 on an authenticated request means the session is no longer
 * good (expired, or the user was deactivated) — the client tells the session
 * provider, which signs the app out.
 */

// `npm run dev` in ../inss-app-backend. Release builds set EXPO_PUBLIC_API_URL.
const FALLBACK_API_URL = 'http://localhost:3001';

/** Set EXPO_PUBLIC_API_URL to point at a different backend (see .env). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || FALLBACK_API_URL).replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  /** True when the server could not be reached at all. */
  get isOffline() {
    return this.status === 0;
  }
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Registered by the session provider so any 401 signs the app out. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Serialized as JSON. */
  body?: unknown;
  /** Do not attach the stored session token (sign-in, magic-link request). */
  anonymous?: boolean;
  /** Use this token instead of the stored one (checking a token before storing it). */
  token?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

function messageForStatus(status: number): string {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have access to this.';
  if (status === 404) return 'We could not find that.';
  if (status >= 500) return 'The server had a problem. Try again in a moment.';
  return 'Something went wrong. Please try again.';
}

/**
 * One request, authenticated, with a failure turned into an `ApiError`.
 *
 * Both JSON and binary callers go through this, so a 401 signs the app out
 * whichever kind of response was expected.
 */
async function send(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, anonymous = false, token, signal, headers } = options;

  const authToken = token ?? (anonymous ? undefined : (await getToken()) ?? undefined);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  if (!response.ok) {
    if (response.status === 401 && !anonymous) {
      unauthorizedHandler?.();
    }
    const payload = await response.json().catch(() => null);
    const serverMessage =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : '';
    throw new ApiError(serverMessage || messageForStatus(response.status), response.status, payload);
  }

  return response;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  return (await response.json().catch(() => null)) as T;
}

/**
 * A request whose answer is bytes rather than JSON — the PDF endpoint.
 *
 * Errors still arrive as JSON, which `send` has already turned into an
 * `ApiError`, so a failed print reads like any other API failure.
 */
export async function apiFetchBytes(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Uint8Array> {
  const response = await send(path, options);
  return new Uint8Array(await response.arrayBuffer());
}
