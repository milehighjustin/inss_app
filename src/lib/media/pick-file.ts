import * as DocumentPicker from 'expo-document-picker';

import type { PickedFile } from './upload';

/**
 * Pick a file with the platform's own document browser.
 *
 * `mimeTypes` narrows what the browser will offer (a PDF picker for documents,
 * `image/*` and `video/*` for kiosk media). The platform reports the type it
 * knows; when it does not, `application/octet-stream` is passed on so the API
 * can fall back to the file name, exactly as the browser does.
 */
export async function pickFile(mimeTypes: string[]): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: mimeTypes,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) return null;

  return {
    uri: asset.uri,
    name: asset.name || 'file',
    type: asset.mimeType || 'application/octet-stream',
    size: asset.size,
  };
}
