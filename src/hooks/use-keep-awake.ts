import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

/**
 * Hold the screen awake for as long as the calling screen is mounted.
 *
 * For the screens nobody is touching: the kiosk (playing its playlist all day,
 * answering calls), the QR display standing in a lobby, and the operator
 * console, where someone is watching for a call and not pressing keys. Left to
 * the OS timer those all dim, sleep and — on a kiosk — stop being a kiosk.
 *
 * The `screen` name is only a tag, so two screens cannot cancel each other's
 * lock; mount the hook on a screen and it lasts exactly as long as that screen.
 *
 * On native the lock is held until it is released. A browser is different: the
 * Screen Wake Lock is dropped whenever the tab is hidden — minimised, switched
 * away from, or the machine sleeps — and never returns on its own, so this asks
 * again each time the page comes back. A browser without the API (Firefox, old
 * Safari) simply ignores it, and a refused request is not worth surfacing: the
 * browser rejects one from a tab that is not visible, which is the state this
 * hook handles anyway.
 */
export function useKeepAwake(screen: string): void {
  useEffect(() => {
    const tag = `inss-${screen}`;

    const acquire = () => {
      void activateKeepAwakeAsync(tag).catch(() => {});
    };

    acquire();

    const doc = (
      globalThis as {
        document?: {
          visibilityState?: string;
          addEventListener?: (type: string, listener: () => void) => void;
          removeEventListener?: (type: string, listener: () => void) => void;
        };
      }
    ).document;

    const onVisibility = () => {
      if (doc?.visibilityState === 'visible') acquire();
    };

    doc?.addEventListener?.('visibilitychange', onVisibility);

    return () => {
      doc?.removeEventListener?.('visibilitychange', onVisibility);
      void deactivateKeepAwake(tag).catch(() => {});
    };
  }, [screen]);
}
