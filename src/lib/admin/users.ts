import { apiFetch } from '@/lib/api/client';
import type { PickedImage } from '@/lib/media/pick-image';
import { putBlob } from '@/lib/media/put-blob';

/**
 * The admin user console's data layer.
 *
 * Mirrors v1's Users panel: every user comes back (active and inactive, never
 * with password material) and search, sort and filtering happen on the device,
 * exactly as they do in the web app.
 */

export interface AdminUser {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  phone?: string;
  photoUrl?: string;
  roles: string[];
  active: boolean;
  locked: boolean;
  lastLogin: string | null;
  /** Notification tag slugs: what this account is told about. */
  notificationTags: string[];
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email?: string;
  roles: string[];
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  roles?: string[];
  active?: boolean;
  /** Replaces the list. The server re-registers each of their devices. */
  notificationTags?: string[];
}

/** The roles an administrator may assign, in the order v1 lists them. */
export const ASSIGNABLE_ROLES = [
  'administrator',
  'developer',
  'manager',
  'supervisor',
  'investor',
] as const;

export function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function displayName(user: Pick<AdminUser, 'firstName' | 'lastName'>): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unnamed user';
}

export async function listUsers(): Promise<AdminUser[]> {
  const { users } = await apiFetch<{ users: AdminUser[] }>('/api/mobile/admin/users');
  return users;
}

export async function fetchUser(userId: string): Promise<AdminUser> {
  const { user } = await apiFetch<{ user: AdminUser }>(
    `/api/mobile/admin/users/${encodeURIComponent(userId)}`,
  );
  return user;
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  const { user } = await apiFetch<{ user: AdminUser }>('/api/mobile/admin/users', {
    method: 'POST',
    body: input,
  });
  return user;
}

/** A write-only SAS for one blob, handed out by v1. */
export interface PhotoUploadTicket {
  uploadUrl: string;
  blobUrl: string;
  blobName: string;
  headers: Record<string, string>;
}

/** Step 1: ask v1 for somewhere to put the photo. */
export async function requestPhotoUpload(
  userId: string,
  contentType: string,
): Promise<PhotoUploadTicket> {
  const { upload } = await apiFetch<{ upload: PhotoUploadTicket }>(
    `/api/mobile/admin/users/${encodeURIComponent(userId)}/photo`,
    { method: 'POST', body: { contentType } },
  );
  return upload;
}

/** Step 3: tell v1 the upload finished, and get the user back with its new URL. */
export async function confirmPhotoUpload(userId: string, blobName: string): Promise<AdminUser> {
  const { user } = await apiFetch<{ user: AdminUser }>(
    `/api/mobile/admin/users/${encodeURIComponent(userId)}/photo`,
    { method: 'PATCH', body: { blobName } },
  );
  return user;
}

/**
 * Uploads a new profile photo and returns the user with its new `photoUrl`.
 *
 * The bytes go from the device straight to Azure with a write-only SAS; v1 only
 * signs the URL and records the result, so photo data never passes through it.
 */
export async function uploadUserPhoto(userId: string, image: PickedImage): Promise<AdminUser> {
  const ticket = await requestPhotoUpload(userId, image.type);

  // Step 2: the actual upload.
  await putBlob(ticket.uploadUrl, image, ticket.headers);

  return confirmPhotoUpload(userId, ticket.blobName);
}

export async function updateUser(userId: string, patch: UpdateUserInput): Promise<AdminUser> {
  const { user } = await apiFetch<{ user: AdminUser }>(
    `/api/mobile/admin/users/${encodeURIComponent(userId)}`,
    { method: 'PATCH', body: patch },
  );
  return user;
}

export type UserFilter = 'all' | 'administrator' | 'supervisor' | 'manager' | 'investor' | 'inactive';
export type UserSort = 'lastNameAZ' | 'lastNameZA';

export const FILTER_OPTIONS: { value: UserFilter; label: string }[] = [
  { value: 'all', label: 'All users' },
  { value: 'administrator', label: 'Administrators' },
  { value: 'supervisor', label: 'Supervisors' },
  { value: 'manager', label: 'Managers' },
  { value: 'investor', label: 'Investors' },
  { value: 'inactive', label: 'Inactive' },
];

export const SORT_OPTIONS: { value: UserSort; label: string }[] = [
  { value: 'lastNameAZ', label: 'Last name (A–Z)' },
  { value: 'lastNameZA', label: 'Last name (Z–A)' },
];

/**
 * v1's list rules, kept behaviour-for-behaviour:
 *
 * - everything except "Inactive" shows only active users
 * - "Inactive" ignores the role filter
 * - search matches first+last or last+first, ignoring spaces and case
 */
export function sortAndFilterUsers(
  users: AdminUser[],
  { query = '', filter = 'all', sort = 'lastNameAZ' }: { query?: string; filter?: UserFilter; sort?: UserSort },
): AdminUser[] {
  const clean = query.replace(/\s+/g, '').toLowerCase();

  return users
    .filter((user) => (filter === 'inactive' ? !user.active : user.active))
    .filter((user) => {
      if (filter === 'inactive' || filter === 'all') return true;
      return user.roles.includes(filter);
    })
    .filter((user) => {
      if (!clean) return true;
      const first = (user.firstName ?? '').toLowerCase();
      const last = (user.lastName ?? '').toLowerCase();
      return `${first}${last}`.includes(clean) || `${last}${first}`.includes(clean);
    })
    .sort((a, b) => {
      const left = (a.lastName ?? '').toLowerCase();
      const right = (b.lastName ?? '').toLowerCase();
      if (left === right) return 0;
      const ascending = left < right ? -1 : 1;
      return sort === 'lastNameAZ' ? ascending : -ascending;
    });
}
