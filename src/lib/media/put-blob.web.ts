import type { UploadBody } from './upload';

/**
 * PUT the bytes straight to Azure Blob Storage from the browser.
 *
 * The URL already carries a write-only SAS, so no auth header is involved; the
 * headers come from the API (`x-ms-blob-type` plus the content type).
 */
export async function putBlob(
  url: string,
  file: UploadBody,
  headers: Record<string, string>,
): Promise<void> {
  const body = file.file ?? (await (await fetch(file.uri)).blob());

  const response = await fetch(url, { method: 'PUT', body, headers });

  if (!response.ok) {
    throw new Error(`The file could not be uploaded (${response.status}). Try again.`);
  }
}
