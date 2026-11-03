import { Platform } from 'react-native';

/**
 * The ringtone for a loud alert, when the app is open.
 *
 * Synthesised rather than shipped as a file: a 20 KB mp3 is one more asset to
 * cache and version, and a call tone is two sine waves. This is the classic
 * ringback pair — 440 Hz and 480 Hz together — at a volume that turns heads
 * without being a fire alarm.
 *
 * Only the web runs this. A phone already rings for a loud push through APNs or
 * FCM, where the sound is the notification's own; a browser cannot do that, so
 * the page makes the noise instead.
 *
 * Returns a `stop` function, always — a caller that cannot ring must still be
 * able to clean up.
 */

type AudioContextConstructor = new () => AudioContext;

/** How long the bell sounds, and how long until it sounds again. */
const BELL_SECONDS = 1.2;
const PAUSE_MS = 3000;
/** Two frequencies an octave apart in behaviour, a fifth in effect. */
const TONES = [440, 480];

function createContext(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  const scope = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  const Constructor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Constructor) return null;

  try {
    return new Constructor();
  } catch {
    // No audio available: the notification still arrives, it just will not ring.
    return null;
  }
}

export function startRinging(): () => void {
  const context = createContext();
  if (!context) {
    return () => {};
  }

  // Browsers start an audio context suspended unless it was created in a
  // gesture. Try immediately — the page is signed in, so it has usually been
  // interacted with — and again on the first interaction, so an alert that
  // arrives on an untouched page starts ringing as soon as anyone touches it.
  const resume = () => {
    if (context.state === 'suspended') void context.resume().catch(() => {});
  };
  resume();

  const onGesture = () => resume();
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', onGesture);
    document.addEventListener('keydown', onGesture);
  }

  const bell = () => {
    if (context.state !== 'running') return;

    const start = context.currentTime;

    for (const frequency of TONES) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;

      // Fading in and out rather than switching on: a square start clicks.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.06, start + 0.03);
      gain.gain.setValueAtTime(0.06, start + BELL_SECONDS - 0.06);
      gain.gain.linearRampToValueAtTime(0, start + BELL_SECONDS);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + BELL_SECONDS + 0.02);
    }
  };

  bell();
  const timer = setInterval(bell, PAUSE_MS);

  return () => {
    clearInterval(timer);

    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', onGesture);
      document.removeEventListener('keydown', onGesture);
    }

    void context.close().catch(() => {});
  };
}
