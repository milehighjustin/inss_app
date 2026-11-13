/**
 * Save a document to the browser's downloads folder.
 *
 * The bytes are fetched first so the anchor can carry a `download` name: a
 * cross-origin link with `download` set is ignored by browsers and would open a
 * tab instead of saving. If the storage host refuses the fetch (no CORS on the
 * signed URL), the link is left to the browser, which still gives the reader the
 * file — one extra click is better than a dead button.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not download that file (${response.status})`);

    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename || 'document';
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}
