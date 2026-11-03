import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { apiFetchBytes } from '@/lib/api/client';

/**
 * Ask the API to print a document and hand the file to the OS.
 *
 * The PDF is rendered on the server — one endpoint for every document — and
 * arrives here as bytes. On a device the only useful next step is the share
 * sheet: it saves to Files, prints, or sends the report on, which is what people
 * do with a PDF on a phone. `pdf.web.ts` downloads it instead.
 */

export interface PdfRequest {
  html: string;
  filename: string;
}

export async function openPdf({ html, filename }: PdfRequest): Promise<void> {
  const bytes = await apiFetchBytes('/api/mobile/pdf', {
    method: 'POST',
    body: { html, filename },
  });

  const file = new File(Paths.cache, `${filename}.pdf`);
  if (file.exists) file.delete();
  await file.write(bytes);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('This device cannot open a share sheet.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: filename,
  });
}
