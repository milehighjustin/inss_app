import { useCallback, useEffect, useState } from 'react';

/**
 * Installing the web app, as far as the browser allows.
 *
 * Two paths exist and they are not the same:
 *
 * - **A prompt.** Chrome, Edge and Samsung Internet fire `beforeinstallprompt`
 *   once the app qualifies (manifest, icons, a service worker, HTTPS). The event
 *   is kept so the app can offer its own button instead of hiding the feature in
 *   a menu — and once raised, it can only be raised once.
 * - **By hand.** Safari has no such event. On iOS it is Share → Add to Home
 *   Screen, on macOS it is File → Add to Dock. Firefox cannot install a web app
 *   at all, so it is told which browser can.
 *
 * The hook reports what is true on this device rather than promising a prompt
 * that will never arrive.
 */

type Platform = 'ios' | 'macos' | 'android' | 'windows' | 'linux' | 'other';
type Browser = 'chrome' | 'edge' | 'safari' | 'firefox' | 'samsung' | 'other';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  /** Whether there is anything to say on this platform at all. */
  available: boolean;
  /** Running as an installed app right now. */
  installed: boolean;
  /** The browser can raise its own install prompt. */
  canPrompt: boolean;
  /** What to do when it cannot: one line of steps, or null. */
  steps: string | null;
  /** Raises the browser's prompt. */
  prompt: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

/** A touch-capable Mac is an iPad claiming to be one (iPadOS 13+). */
function platformOf(userAgent: string, maxTouchPoints: number): Platform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'macos';
  if (/Windows/.test(userAgent)) return 'windows';
  if (/Linux|X11|CrOS/.test(userAgent)) return 'linux';
  return 'other';
}

function browserOf(userAgent: string): Browser {
  // Every Chromium browser claims to be Chrome, so the order matters.
  if (/Edg\//.test(userAgent)) return 'edge';
  if (/SamsungBrowser/.test(userAgent)) return 'samsung';
  if (/Firefox\/|FxiOS/.test(userAgent)) return 'firefox';
  if (/Chrome\/|CriOS/.test(userAgent)) return 'chrome';
  if (/Safari\//.test(userAgent)) return 'safari';
  return 'other';
}

function installedNow(): boolean {
  if (typeof window === 'undefined') return false;

  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;

  // iOS still reports an installed home-screen app this way.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * The steps for a browser that will not prompt.
 *
 * Null when the platform's own prompt is the route, so the screen can say
 * nothing rather than something generic.
 */
function stepsFor(platform: Platform, browser: Browser): string | null {
  if (browser === 'firefox') {
    return platform === 'ios'
      ? 'Open this page in Safari, then use Share → Add to Home Screen.'
      : 'Open this page in Chrome, Edge or Safari to install it.';
  }

  if (platform === 'ios') {
    return browser === 'safari'
      ? 'Tap Share, then Add to Home Screen.'
      : 'Open this page in Safari, then use Share → Add to Home Screen.';
  }

  if (platform === 'macos') {
    if (browser === 'safari') return 'In Safari, choose File → Add to Dock.';
    return 'Open the browser menu and choose Install INSS.';
  }

  if (platform === 'android') {
    return 'Open the browser menu and choose Add to Home screen.';
  }

  return 'Open the browser menu and choose Install INSS.';
}

export function useInstallState(): InstallState {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>('other');
  const [browser, setBrowser] = useState<Browser>('other');

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    setPlatform(platformOf(userAgent, window.navigator.maxTouchPoints ?? 0));
    setBrowser(browserOf(userAgent));
    setInstalled(installedNow());

    const onPrompt = (event: Event) => {
      // Without this the browser shows its own mini-infobar and the event fires
      // only once, leaving the app with nothing to offer later.
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const prompt = useCallback(async () => {
    if (!promptEvent) return 'unavailable' as const;

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      return choice.outcome;
    } catch {
      // A prompt raised outside a user gesture, or one already spent.
      setPromptEvent(null);
      return 'unavailable' as const;
    }
  }, [promptEvent]);

  const canPrompt = promptEvent !== null;
  const steps = installed || canPrompt ? null : stepsFor(platform, browser);

  return {
    available: installed || canPrompt || steps !== null,
    installed,
    canPrompt,
    steps,
    prompt,
  };
}
