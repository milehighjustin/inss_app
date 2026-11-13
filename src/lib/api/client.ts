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
 * How long a single attempt may hang before it counts as a failure.
 *
 * React Native's fetch has no timeout of its own: a request to a server that is
 * cold-starting, or to a host whose proxy is waiting on an origin that is not
 * there, hangs until the OS gives up — which is minutes, with no error and no
 * spinner that ever resolves. Screens fetch several endpoints at once, so one
 * such host reads as "extremely slow" rather than "down". A generous ceiling
 * turns that into an answer the app can act on.
 */
const TIMEOUT_MS = 25_000;

/** The one retry given to a read, and the pause before it. */
const RETRY_DELAY_MS = 700;

function timeoutError(): ApiError {
  return new ApiError(
    'The server took too long to answer. Check your connection and try again.',
    0,
  );
}

/**
 * One attempt, bounded by `TIMEOUT_MS` and by the caller's own signal.
 *
 * The two are folded into one controller: a timeout and a screen being left must
 * both cancel the socket, and neither should be mistaken for the other.
 */
async function attempt(
  url: string,
  init: RequestInit,
  callerSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  const cancel = () => controller.abort();
  callerSignal?.addEventListener('abort', cancel);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw timedOut
      ? timeoutError()
      : new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', cancel);
  }
}

/**
 * One request, authenticated, with a failure turned into an `ApiError`.
 *
 * Both JSON and binary callers go through this, so a 401 signs the app out
 * whichever kind of response was expected.
 *
 * A read that fails at the network level is tried once more. That is what a
 * cold backend looks like: the first request wakes it and sometimes loses the
 * race, and the second — sent while it is now warm — answers immediately. Only
 * GET is retried: replaying a write is how a double document upload happens.
 */
async function send(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, anonymous = false, token, signal, headers } = options;

  const authToken = token ?? (anonymous ? undefined : (await getToken()) ?? undefined);

  const url = `${API_URL}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };

  let response: Response;
  try {
    response = await attempt(url, init, signal);
  } catch (error) {
    const canRetry = method === 'GET' && !signal?.aborted;
    if (!canRetry) throw error;

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    response = await attempt(url, init, signal);
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
