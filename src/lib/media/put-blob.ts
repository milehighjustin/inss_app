import * as FileSystem from 'expo-file-system/legacy';

import type { UploadBody } from './upload';

/**
 * PUT the bytes straight to Azure Blob Storage from the device.
 *
 * `uploadAsync` streams the file from its `file://` URI natively — React
 * Native's fetch cannot read local files as a request body — and the SAS in the
 * URL is the only credential involved. Photos, investor documents and kiosk
 * media all come through here.
 */
export async function putBlob(
  url: string,
  file: UploadBody,
  headers: Record<string, string>,
): Promise<void> {
  const result = await FileSystem.uploadAsync(url, file.uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers,
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`The file could not be uploaded (${result.status}). Try again.`);
  }
}
