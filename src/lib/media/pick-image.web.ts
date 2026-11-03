/**
 * The web build picks an image with the browser's own file dialog.
 *
 * expo-image-picker works on the web too, but it manages its own throwaway input
 * element; using ours keeps the element in our hands (a missing file, a cancelled
 * dialog and a successful pick all resolve predictably) and keeps the native
 * picker out of the web bundle.
 */

export interface PickedImage {
  uri: string;
  name: string;
  type: string;
  file?: File;
}

const ACCEPT = 'image/png,image/jpeg,image/webp';

export async function pickImage(): Promise<PickedImage | null> {
  if (typeof document === 'undefined') return null;

  return new Promise<PickedImage | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.setAttribute('data-photo-picker', '');
    // Kept in the document (some browsers ignore clicks on detached inputs) but
    // out of sight and out of the layout.
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';

    let settled = false;

    const finish = (value: PickedImage | null) => {
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
        type: file.type,
      });
    });

    input.addEventListener('cancel', () => finish(null));
    window.addEventListener('focus', onWindowFocus);

    document.body.appendChild(input);
    input.click();
  });
}
