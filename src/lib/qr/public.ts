import { API_URL } from '@/lib/api/client';

/**
 * The public ends of a QR code.
 *
 * These two calls carry no session: a printed sign has no account behind it, and
 * someone holding a phone has never heard of this app. They deliberately do not
 * go through `apiFetch`, which attaches the stored token and signs the app out
 * on a 401 — an anonymous scan must never be able to end a session, and a
 * redirect page must not wait on a token check.
 */

export interface QrScanResult {
  /** Where to send the visitor, always an absolute http(s) address. */
  url: string;
  /** False when the code is unknown or switched off, and `url` is the fallback. */
  live: boolean;
  name: string;
}

/**
 * Ask the server where a code points, and let it record that it was scanned.
 *
 * A POST because looking is the event: the server may notify whoever the code
 * names, and a GET could be fired by a link preview that nobody read.
 */
export async function scanQrCode(codeId: string): Promise<QrScanResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/mobile/qr/${encodeURIComponent(codeId)}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  if (!response.ok) throw new Error('This code could not be read.');

  return (await response.json()) as QrScanResult;
}

/**
 * The code as SVG markup, for a display screen.
 *
 * `null` means the code does not exist — a display for one has nothing useful to
 * show, unlike a scan, which falls back to the company site.
 */
export async function qrCodeSvgPublic(codeId: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/mobile/qr/${encodeURIComponent(codeId)}/svg`);
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  if (response.status === 404) return null;
  if (!response.ok) throw new Error('This code could not be drawn.');

  return response.text();
}
