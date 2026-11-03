import { apiFetchBytes } from '@/lib/api/client';

/**
 * Ask the API to print a document and download the file.
 *
 * The browser has no share sheet for a file it did not author, so this saves the
 * PDF through an object URL. The URL is revoked once the download has started,
 * or the bytes would stay in memory for the life of the page.
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

  const url = URL.createObjectURL(
    new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
