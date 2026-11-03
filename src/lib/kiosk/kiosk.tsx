import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  kioskModeSupported,
  readKioskDeviceId,
  writeKioskDeviceId,
} from '@/lib/kiosk/storage';

/**
 * Kiosk mode: a device that is handed to INSS and only ever shows one kiosk.
 *
 * The chosen device id is read once, before the first screen paints, and the
 * root layout renders the player instead of the app whenever it is set — no
 * sign-in, no nav, and no way to reach another screen. The setting is turned on
 * by typing the id in Account on the device itself, and turned off again with a
 * long press in the player's top-left corner (see `KioskMode`).
 *
 * The web build reports `supported: false` and never stores an id, so a browser
 * session always starts in the normal app.
 */

interface KioskContextValue {
  /** The device id the app opens into, or null for the normal app. */
  deviceId: string | null;
  /** Whether this build can be a kiosk at all. */
  supported: boolean;
  /** False until the stored choice has been read; the boot screen covers it. */
  ready: boolean;
  /** Stores (or clears, with null) the kiosk device and applies it at once. */
  setDevice: (deviceId: string | null) => Promise<void>;
}

const KioskContext = createContext<KioskContextValue | null>(null);

export function KioskProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await readKioskDeviceId();
      if (cancelled) return;
      setDeviceId(stored);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setDevice = useCallback(async (next: string | null) => {
    const value = next?.trim() || null;
    await writeKioskDeviceId(value);
    setDeviceId(value);
  }, []);

  const value = useMemo<KioskContextValue>(
    () => ({ deviceId, supported: kioskModeSupported(), ready, setDevice }),
    [deviceId, ready, setDevice],
  );

  return <KioskContext.Provider value={value}>{children}</KioskContext.Provider>;
}

export function useKiosk(): KioskContextValue {
  const context = useContext(KioskContext);
  if (!context) {
    throw new Error('useKiosk must be used inside <KioskProvider>');
  }
  return context;
}
