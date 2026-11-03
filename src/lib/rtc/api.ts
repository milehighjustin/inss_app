import { apiFetch } from '@/lib/api/client';

/**
 * Kiosk Connect's two ways in.
 *
 * The API mints the socket tokens — the same ones `cooperrtc` used to hand out
 * from v1's server components. An operator asks for theirs with their session;
 * a kiosk asks with nothing but the device id a programmed screen already has,
 * which is why this endpoint is public and deactivated devices are refused.
 */

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CallSession {
  token: string;
  expiresOn: string;
  iceServers: IceServer[];
}

export type MediaType = 'image' | 'video' | 'audio';

export interface ScheduledMedia {
  id: string;
  name: string;
  url: string;
  mediaType: MediaType;
  duration: number | null;
  priority: number;
}

export interface KioskDevice {
  id: string;
  name: string;
  active: boolean;
  onHoldImageUrl: string | null;
  callStartToneUrl: string | null;
  mediaSchedule: ScheduledMedia[];
}

export interface KioskSession extends CallSession {
  device: KioskDevice;
}

/** A device as the signaling server reports it: online only with a live socket. */
export interface ConsoleDevice {
  id: string;
  name: string;
  socketId: string | null;
  status: 'connected' | 'disconnected';
}

/** POST /api/mobile/rtc/token — one hour, administrator and up. */
export function operatorSession(): Promise<CallSession> {
  return apiFetch<CallSession>('/api/mobile/rtc/token', { method: 'POST' });
}

/** GET /api/mobile/rtc/kiosk/:deviceId — four days, no session required. */
export function kioskSession(deviceId: string): Promise<KioskSession> {
  return apiFetch<KioskSession>(`/api/mobile/rtc/kiosk/${encodeURIComponent(deviceId)}`, {
    anonymous: true,
  });
}

/** The console's device list from a `devicesRefresh` event (a JSON array). */
export function consoleDeviceList(raw: unknown): ConsoleDevice[] {
  if (typeof raw === 'string') {
    try {
      return consoleDevices(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  return consoleDevices(raw);
}

/**
 * The console's device list, out of a `devicesRefresh` event.
 *
 * The socket sends Mongo-shaped rows (`_id`), so the app's own shape is built
 * here once instead of in the screen.
 */
export function consoleDevices(raw: unknown): ConsoleDevice[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((row): ConsoleDevice | null => {
      if (!row || typeof row !== 'object') return null;
      const value = row as Record<string, unknown>;
      const id = typeof value._id === 'string' ? value._id : '';
      if (!id) return null;
      const socketId = typeof value.socketId === 'string' && value.socketId ? value.socketId : null;

      return {
        id,
        name: typeof value.name === 'string' ? value.name : 'Unnamed kiosk',
        socketId,
        status: socketId ? 'connected' : 'disconnected',
      };
    })
    .filter((device): device is ConsoleDevice => device !== null);
}
