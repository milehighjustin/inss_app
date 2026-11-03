import { apiFetch } from '@/lib/api/client';
import { putBlob } from '@/lib/media/put-blob';
import type { PickedFile } from '@/lib/media/upload';

/**
 * Kiosk Connect's devices, media and playlists.
 *
 * This is the registry the admin console maintains, in v1's collections; the
 * player at `/kioskconnect/kiosk/[rtcDeviceId]` reads the same documents through
 * the public bootstrap route. A device's `kioskUrl` is the page to program a
 * screen to open.
 */

export type MediaType = 'image' | 'video' | 'audio';

export interface RtcMedia {
  id: string;
  name: string;
  url: string;
  mediaType: MediaType;
  active: boolean;
  createdAt: string | null;
}

export interface RtcScheduleItem extends RtcMedia {
  /** The playlist row's own id — what Remove deletes. */
  scheduleId: string;
  priority: number;
  duration: number | null;
}

export interface RtcDevice {
  id: string;
  name: string;
  hardwareMake: string;
  hardwareModel: string;
  hardwareSerial: string;
  active: boolean;
  onHoldImageId: string | null;
  callStartToneId: string | null;
  modified: string | null;
  mediaSchedule: RtcScheduleItem[];
  kioskUrl: string;
}

export interface DeviceInput {
  name: string;
  hardwareMake: string;
  hardwareModel: string;
  hardwareSerial: string;
}

export interface MediaUploadTicket {
  blobName: string;
  uploadUrl: string;
  blobUrl: string;
  expiresOn: string;
  headers: Record<string, string>;
}

/** What the media picker offers, by kind. */
export const MEDIA_MIME_TYPES: Record<MediaType, string[]> = {
  image: ['image/png', 'image/jpeg'],
  video: ['video/mp4', 'video/x-msvideo'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/x-wav'],
};

export function mediaTypeLabel(type: MediaType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export async function listDevices(): Promise<RtcDevice[]> {
  const { devices } = await apiFetch<{ devices: RtcDevice[] }>('/api/mobile/admin/rtc/devices');
  return devices;
}

/** One device with its playlist. */
export async function fetchDevice(deviceId: string): Promise<RtcDevice> {
  const { device } = await apiFetch<{ device: RtcDevice }>(
    `/api/mobile/admin/rtc/devices/${encodeURIComponent(deviceId)}`,
  );
  return device;
}

export async function createDevice(input: DeviceInput): Promise<RtcDevice> {
  const { device } = await apiFetch<{ device: RtcDevice }>('/api/mobile/admin/rtc/devices', {
    method: 'POST',
    body: input,
  });
  return device;
}

export async function updateDevice(
  deviceId: string,
  patch: Partial<DeviceInput> & {
    onHoldImageId?: string | null;
    callStartToneId?: string | null;
    active?: boolean;
  },
): Promise<RtcDevice> {
  const { device } = await apiFetch<{ device: RtcDevice }>(
    `/api/mobile/admin/rtc/devices/${encodeURIComponent(deviceId)}`,
    { method: 'PATCH', body: patch },
  );
  return device;
}

export async function addScheduleItem(
  deviceId: string,
  input: { mediaId: string; priority: number; duration?: number | null },
): Promise<void> {
  await apiFetch(`/api/mobile/admin/rtc/devices/${encodeURIComponent(deviceId)}/schedule`, {
    method: 'POST',
    body: {
      rtcMediaId: input.mediaId,
      priority: input.priority,
      ...(input.duration === undefined || input.duration === null
        ? {}
        : { duration: input.duration }),
    },
  });
}

export async function removeScheduleItem(deviceId: string, scheduleId: string): Promise<void> {
  await apiFetch(
    `/api/mobile/admin/rtc/devices/${encodeURIComponent(deviceId)}/schedule/${encodeURIComponent(scheduleId)}`,
    { method: 'DELETE' },
  );
}

export async function listMedia(): Promise<RtcMedia[]> {
  const { media } = await apiFetch<{ media: RtcMedia[] }>('/api/mobile/admin/rtc/media');
  return media;
}

/** Step 1: ask for somewhere to put the bytes. */
export async function requestMediaUpload(
  contentType: string,
  fileName?: string,
): Promise<MediaUploadTicket> {
  const { upload } = await apiFetch<{ upload: MediaUploadTicket }>(
    '/api/mobile/admin/rtc/media/upload',
    { method: 'POST', body: { contentType, fileName } },
  );
  return upload;
}

/** Step 3: record the media. The API checks the blob before writing the row. */
export async function createMedia(input: {
  blobName: string;
  name: string;
  mediaType: MediaType;
}): Promise<RtcMedia> {
  const { media } = await apiFetch<{ media: RtcMedia }>('/api/mobile/admin/rtc/media', {
    method: 'POST',
    body: input,
  });
  return media;
}

export async function uploadMedia(
  file: PickedFile,
  meta: { name: string; mediaType: MediaType },
): Promise<RtcMedia> {
  const ticket = await requestMediaUpload(file.type, file.name);
  await putBlob(ticket.uploadUrl, file, ticket.headers);
  return createMedia({ ...meta, blobName: ticket.blobName });
}

export async function deleteMedia(mediaId: string): Promise<void> {
  await apiFetch(`/api/mobile/admin/rtc/media/${encodeURIComponent(mediaId)}`, {
    method: 'DELETE',
  });
}
