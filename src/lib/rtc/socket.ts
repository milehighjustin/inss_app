import { io, type Socket } from 'socket.io-client';

import { API_URL } from '@/lib/api/client';

/**
 * The signaling socket, on the API's own origin.
 *
 * This used to be `cooperrtc`, a separate service, and the protocol has not
 * changed: JSON-string payloads, every message naming the peer socket the
 * sender wants to reach. Only the host moved, which is why the kiosk and the
 * console speak the same events they always did.
 *
 * The token travels in the socket's `auth` payload rather than a custom header:
 * a browser sends it on the handshake either way, a native client can only use
 * `auth`, and the server accepts both.
 */
export function connectSignaling(token: string): Socket {
  return io(API_URL, {
    auth: { token },
    // Keep retrying if the API restarts; a kiosk is unattended for weeks.
    reconnectionDelayMax: 10_000,
  });
}

/**
 * One signaling payload, parsed whether the peer sent an object or its JSON.
 *
 * The server stringifies everything, matching the client it replaced, so
 * screens read through this rather than calling `JSON.parse` unguarded.
 */
export function signalPayload(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

/** A `connectSocketId` / `candidate` / `offer` field, as the wire sends it. */
export function signalField<T>(payload: Record<string, unknown>, field: string): T | null {
  const value = payload[field];
  return value === undefined || value === null ? null : (value as T);
}
