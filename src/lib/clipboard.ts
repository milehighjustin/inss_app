import * as Clipboard from 'expo-clipboard';

/**
 * Copy text to the clipboard on every platform.
 *
 * expo-clipboard uses the real clipboard natively and the browser's own API on
 * the web, so a copied device URL or QR link behaves the same wherever the
 * console is running. It returns `false` when the platform refused (a browser
 * without a secure context), which the caller can report rather than lie about.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(value);
    return true;
  } catch {
    return false;
  }
}
