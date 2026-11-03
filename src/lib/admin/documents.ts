import { apiFetch } from '@/lib/api/client';
import type {
  NotificationPriority,
  NotificationRecord,
} from '@/lib/admin/notifications';
import { putBlob } from '@/lib/media/put-blob';
import type { PickedFile } from '@/lib/media/upload';

/**
 * The investor portal's documents, as the admin console manages them.
 *
 * Uploading is two steps, the same dance as user photos: the API signs one
 * write-only blob, the app PUTs the bytes straight to Azure, and the API records
 * the document once it can see that the bytes arrived. Nothing is written until
 * then, so a cancelled upload leaves no half-made document.
 */

export const DOCUMENT_AUDIENCES = ['allInvestors', 'investor', 'locationSpecific'] as const;

export type DocumentAudience = (typeof DOCUMENT_AUDIENCES)[number];

export const AUDIENCE_OPTIONS: { value: DocumentAudience; label: string }[] = [
  { value: 'allInvestors', label: 'All investors' },
  { value: 'investor', label: 'One investor' },
  { value: 'locationSpecific', label: 'One property' },
];

export interface AdminDocument {
  id: string;
  name: string;
  folder: string;
  audience: DocumentAudience;
  investorId: string | null;
  locationId: string | null;
  container: string;
  blobName: string;
  size: number | null;
  createdAt: string | null;
}

export interface DocumentUploadTicket {
  blobName: string;
  blobUrl: string;
  uploadUrl: string;
  expiresOn: string;
  headers: Record<string, string>;
}

/**
 * The alert a post can send to the people the file is for.
 *
 * There is no audience to choose: the file's own audience decides who is told,
 * which is the point — an investor is told about the statements they can read,
 * and nobody else is. Left off, the file is simply posted.
 */
export interface DocumentNotificationInput {
  title: string;
  body: string;
  priority: NotificationPriority;
}

export interface CreateDocumentInput {
  blobName: string;
  name: string;
  audience: DocumentAudience;
  investorId?: string;
  locationId?: string;
  folderName?: string;
  notify?: DocumentNotificationInput;
}

/** What a post produced: the document, and the alert if one was asked for. */
export interface DocumentUploadResult {
  document: AdminDocument;
  notification: NotificationRecord | null;
}

/** What v1's file picker accepted, as MIME types for the platform pickers. */
export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

export async function listDocuments(): Promise<AdminDocument[]> {
  const { documents } = await apiFetch<{ documents: AdminDocument[] }>(
    '/api/mobile/admin/documents',
  );
  return documents;
}

/** Step 1: ask for somewhere to put the bytes. */
export async function requestDocumentUpload(
  contentType: string,
  fileName?: string,
): Promise<DocumentUploadTicket> {
  const { upload } = await apiFetch<{ upload: DocumentUploadTicket }>(
    '/api/mobile/admin/documents/upload',
    { method: 'POST', body: { contentType, fileName } },
  );
  return upload;
}

/** Step 3: record the document. The API checks the blob's real size first. */
export async function createDocument(
  input: CreateDocumentInput,
): Promise<DocumentUploadResult> {
  return apiFetch<DocumentUploadResult>('/api/mobile/admin/documents', {
    method: 'POST',
    body: input,
  });
}

/** Step 2 and 3 together: PUT the bytes, then record them. */
export async function uploadDocument(
  file: PickedFile,
  meta: Omit<CreateDocumentInput, 'blobName'>,
): Promise<DocumentUploadResult> {
  const ticket = await requestDocumentUpload(file.type, file.name);
  await putBlob(ticket.uploadUrl, file, ticket.headers);
  return createDocument({ ...meta, blobName: ticket.blobName });
}

/**
 * How many investors will see a file filed this way.
 *
 * The same audience the notification would go to, so the upload form can name a
 * number instead of promising "everyone" — a property with no investors on its
 * books answers zero.
 */
export async function countDocumentAudience(input: {
  audience: DocumentAudience;
  investorId?: string;
  locationId?: string;
}): Promise<number> {
  const params = new URLSearchParams({ audience: input.audience });
  if (input.investorId) params.set('investorId', input.investorId);
  if (input.locationId) params.set('locationId', input.locationId);

  const { users } = await apiFetch<{ users: number }>(
    `/api/mobile/admin/documents/audience?${params.toString()}`,
  );

  return users;
}

/** A short-lived read URL for one document. */
export async function documentUrl(documentId: string): Promise<{ url: string; expiresOn: string }> {
  return apiFetch<{ url: string; expiresOn: string }>(
    `/api/mobile/admin/documents/${encodeURIComponent(documentId)}/url`,
  );
}

export async function deleteDocument(documentId: string): Promise<void> {
  await apiFetch(`/api/mobile/admin/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  });
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
}
