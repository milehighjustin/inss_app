import { apiFetch } from '@/lib/api/client';

/**
 * Admin → Notifications: the tag registry and the send history.
 *
 * A tag is the name an alert is addressed to. Users carry tags (Users → a
 * person), QR codes choose them, and this screen creates and sends. The registry
 * is what keeps a typo from becoming a silent, empty audience.
 */

export type NotificationPriority = 'loud' | 'quiet';

export interface NotificationTag {
  slug: string;
  label: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Accounts carrying it — only present on the list. */
  users?: number;
  /** QR codes that send to it — only present on the list. */
  codes?: number;
}

export type NotificationChannel = 'browser' | 'apns' | 'fcmv1' | 'wns';

export interface NotificationSend {
  channel: NotificationChannel;
  ok: boolean;
  error?: string;
}

export interface NotificationRecord {
  _id: string;
  kind: 'qr-scan' | 'manual';
  qrCodeId?: string;
  qrCodeName?: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  tags: string[];
  /** Named accounts from codes configured before tags existed. */
  recipients: string[];
  expression?: string;
  sends: NotificationSend[];
  createdAt: string;
  /**
   * `suppressed` is a scan that landed inside a code's quiet window: recorded,
   * deliberately not sent again.
   */
  status: 'pending' | 'delivered' | 'failed' | 'suppressed';
  deliveredAt?: string;
  note?: string;
}

export interface NotificationAudience {
  /** Accounts carrying any of the tags. */
  users: number;
  /** Phone installations those accounts have between them. */
  devices: number;
}

export async function listNotificationTags(): Promise<NotificationTag[]> {
  const { tags } = await apiFetch<{ tags: NotificationTag[] }>(
    '/api/mobile/admin/notification-tags',
  );
  return tags;
}

export async function createNotificationTag(input: {
  label: string;
  description?: string;
}): Promise<NotificationTag> {
  const { tag } = await apiFetch<{ tag: NotificationTag }>(
    '/api/mobile/admin/notification-tags',
    { method: 'POST', body: input },
  );
  return tag;
}

export async function updateNotificationTag(
  slug: string,
  patch: { label?: string; description?: string; active?: boolean },
): Promise<NotificationTag> {
  const { tag } = await apiFetch<{ tag: NotificationTag }>(
    `/api/mobile/admin/notification-tags/${encodeURIComponent(slug)}`,
    { method: 'PATCH', body: patch },
  );
  return tag;
}

export async function deleteNotificationTag(slug: string): Promise<void> {
  await apiFetch(`/api/mobile/admin/notification-tags/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  });
}

/** How many people, and phones, a send to these tags would reach. */
export async function previewAudience(tags: string[]): Promise<NotificationAudience> {
  return apiFetch<NotificationAudience>(
    `/api/mobile/admin/notifications/preview?tags=${encodeURIComponent(tags.join(','))}`,
  );
}

export async function sendNotification(input: {
  tags: string[];
  title: string;
  body: string;
  priority: NotificationPriority;
}): Promise<NotificationRecord> {
  const { notification } = await apiFetch<{ notification: NotificationRecord }>(
    '/api/mobile/admin/notifications/send',
    { method: 'POST', body: input },
  );
  return notification;
}

/** The alerts one QR code raised, newest first — the panel under the code. */
export async function codeNotifications(
  codeId: string,
  limit = 8,
): Promise<NotificationRecord[]> {
  const { notifications } = await apiFetch<{ notifications: NotificationRecord[] }>(
    `/api/mobile/admin/qr-codes/${encodeURIComponent(codeId)}/notifications?limit=${limit}`,
  );
  return notifications;
}

export async function listNotifications(limit = 50): Promise<NotificationRecord[]> {
  const { notifications } = await apiFetch<{ notifications: NotificationRecord[] }>(
    `/api/mobile/admin/notifications?limit=${limit}`,
  );
  return notifications;
}

/** "3 browsers, 2 phones" — the channels a log row actually reached. */
export function channelSummary(sends: NotificationSend[]): string {
  const names: Record<NotificationChannel, string> = {
    browser: 'browser',
    apns: 'Apple',
    fcmv1: 'Android',
    wns: 'Windows',
  };

  const reached = sends.filter((send) => send.ok).map((send) => names[send.channel]);
  return reached.length > 0 ? reached.join(', ') : 'nothing';
}

/** A status as the console says it. */
export function statusLabel(record: NotificationRecord): string {
  if (record.status === 'delivered') return 'Sent';
  if (record.status === 'failed') return 'Failed';
  if (record.status === 'suppressed') return 'Repeated';
  return 'Waiting';
}

/** What a failed row should say, in one line. */
export function failureReason(record: NotificationRecord): string | null {
  if (record.status !== 'failed') return null;

  const reason = record.sends.find((send) => send.error)?.error;
  return reason ? `${reason}` : (record.note ?? 'Nothing could be reached.');
}
