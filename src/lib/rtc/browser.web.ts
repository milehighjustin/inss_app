/**
 * The browser side of Kiosk Connect.
 *
 * The screens and the signaling are shared with the native build; what differs
 * is how a device is opened. Metro loads this file for the web build and
 * `browser.ts` for iOS and Android.
 */

export function callingSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** A browser can draw the stream into a canvas, so the photo tool lives here. */
export function photoCaptureSupported(): boolean {
  return typeof document !== 'undefined';
}

/**
 * Camera and microphone.
 *
 * A kiosk with a dead microphone should still be able to show its camera, so a
 * failed audio request falls back to video only; if that fails too, the caller
 * gets the original error to report.
 */
export async function openCamera(): Promise<MediaStream> {
  const media = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
  if (!media?.getUserMedia) throw new Error('This browser cannot open a camera.');

  try {
    return await media.getUserMedia({ audio: true, video: true });
  } catch (cause) {
    try {
      return await media.getUserMedia({ video: true });
    } catch {
      throw cause;
    }
  }
}

/** The screen/tab picker. Only ever called from a click, as browsers require. */
export async function openScreen(): Promise<MediaStream> {
  const media = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
  if (!media?.getDisplayMedia) throw new Error('This browser cannot share a screen.');
  return media.getDisplayMedia({ video: true });
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** A human sentence for a getUserMedia rejection. */
export function mediaErrorMessage(cause: unknown): string {
  const name = cause instanceof Error ? cause.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera and microphone access was refused. Allow it in the browser, then try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera or microphone was found on this device.';
  }
  if (name === 'NotReadableError') {
    return 'Another program is using the camera. Close it and try again.';
  }
  return cause instanceof Error && cause.message
    ? cause.message
    : 'The camera and microphone could not be opened.';
}

/**
 * One PNG frame from a live stream, as a data URL.
 *
 * The frame is drawn through an off-screen video element so the caller does not
 * have to hand over the element it is displaying — the frame is the same
 * whatever view the operator is looking at.
 */
export async function captureFrame(stream: MediaStream): Promise<string> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  // Some browsers will not decode a stream in a detached element, so the
  // capture element is in the document but invisible and out of the way.
  Object.assign(video.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '2px',
    height: '2px',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(video);
  video.srcObject = stream;

  try {
    await video.play().catch(() => undefined);

    // Poll rather than wait on one event: the frame can become ready between
    // the check and the listener, which would otherwise wait out the timeout.
    const deadline = Date.now() + 5000;
    while (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      if (Date.now() > deadline) {
        throw new Error('The camera frame was not ready. Try again.');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot capture images.');

    context.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    video.pause();
    video.srcObject = null;
    video.remove();
  }
}

/** Saves a data URL as a file, the way v1's "Save Photo Locally" did. */
export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${fileName}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** The kiosk's own recovery path: a fresh page, a fresh token, a fresh call. */
export function reloadPage(): void {
  window.location.reload();
}
