import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Save a document to the device.
 *
 * A phone has no downloads folder the browser can drop a file into, so the saved
 * copy goes to the cache and the share sheet takes it from there: save to Files,
 * send it on, print it. That is the platform's download, and it is the same path
 * `pdf.ts` uses for generated reports.
 *
 * The signed URL is short-lived, which is why this reads the bytes now rather
 * than storing the link: the file outlives it, the URL does not.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download that file (${response.status})`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  const safe = filename.replace(/[^\w.\- ()]+/g, '_') || 'document';

  const file = new File(Paths.cache, safe);
  if (file.exists) file.delete();
  await file.write(bytes);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('This device cannot save files.');
  }

  await Sharing.shareAsync(file.uri, { dialogTitle: safe });
}
