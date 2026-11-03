import { Platform } from 'react-native';
import { mediaDevices } from 'react-native-webrtc';

import type { Stream } from '@/lib/rtc/types';

/**
 * The device side of Kiosk Connect on iOS and Android.
 *
 * Same shape as `browser.web.ts`: the console and the kiosk call these names
 * and Metro picks the implementation for the platform. Camera and microphone
 * come from react-native-webrtc, which asks for the OS permissions itself.
 */

export function callingSupported(): boolean {
  return true;
}

/**
 * Whether this build can turn a call frame into a PNG.
 *
 * A browser draws the stream into a canvas; native WebRTC has no frame API, so
 * the photo tool stays in the browser console and the app hides the button
 * instead of offering one that produces a black image.
 */
export function photoCaptureSupported(): boolean {
  return false;
}

/**
 * Camera and microphone, falling back to video only.
 *
 * A kiosk with a dead microphone should still be able to show its camera; if
 * that request fails too, the caller gets the original error to report.
 */
export async function openCamera(): Promise<Stream> {
  try {
    const stream = await mediaDevices.getUserMedia({ audio: true, video: true });
    return stream as unknown as Stream;
  } catch (cause) {
    try {
      const stream = await mediaDevices.getUserMedia({ video: true });
      return stream as unknown as Stream;
    } catch {
      throw cause;
    }
  }
}

/**
 * Screen sharing.
 *
 * Android captures the display through MediaProjection. iOS needs a broadcast
 * extension bundled with the app before the system will hand a screen over, so
 * on a phone the console says where screen sharing lives instead.
 */
export async function openScreen(): Promise<Stream> {
  if (Platform.OS !== 'android') {
    throw new Error('Screen sharing is available in the browser console.');
  }

  const stream = await mediaDevices.getDisplayMedia({});
  return stream as unknown as Stream;
}

export function stopStream(stream: Stream | null): void {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // A track already released by a closed peer connection.
    }
  });
}

/** A human sentence for a getUserMedia rejection. */
export function mediaErrorMessage(cause: unknown): string {
  const error = cause as { name?: string; message?: string } | null;
  const name = error?.name ?? '';

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera and microphone access was refused. Allow INSS to use them in Settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera or microphone was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Another app is using the camera. Close it and try again.';
  }

  return error?.message ? error.message : 'The camera and microphone could not be opened.';
}

/** Browser only: native WebRTC exposes no frame to draw. */
export async function captureFrame(_stream: Stream): Promise<string> {
  throw new Error('Photos are captured from the browser console.');
}

/** Browser only, for the same reason. */
export function downloadDataUrl(_dataUrl: string, _fileName: string): void {
  throw new Error('Photos are downloaded from the browser console.');
}
