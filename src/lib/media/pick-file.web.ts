import type { PickedFile } from './upload';

/**
 * Pick a file with the browser's own dialog.
 *
 * Same reasoning as `pick-image.web.ts`: keeping the input element in our hands
 * means a missing file, a cancelled dialog and a successful pick all settle, and
 * the native document picker stays out of the web bundle. The `File` itself is
 * kept so the PUT can send it without reading it back through a URL.
 */
export async function pickFile(mimeTypes: string[]): Promise<PickedFile | null> {
  if (typeof document === 'undefined') return null;

  return new Promise<PickedFile | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = mimeTypes.join(',');
    input.setAttribute('data-file-picker', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';

    let settled = false;

    const finish = (value: PickedFile | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
      resolve(value);
    };

    // Dismissing the dialog fires no event in every browser, so treat the
    // window regaining focus without a chosen file as a cancel.
    const onWindowFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) finish(null);
      }, 300);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      finish({
        file,
        uri: URL.createObjectURL(file),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
      });
    });

    input.addEventListener('cancel', () => finish(null));
    window.addEventListener('focus', onWindowFocus);

    document.body.appendChild(input);
    input.click();
  });
}
