import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Accent } from '@/constants/metro';
import { getStoredAccent, setStoredAccent } from './storage';

/**
 * The accent colour is the one colour the user owns (see METRO.md), so it is a
 * preference rather than a constant. The rest of the palette stays fixed: the
 * app still has exactly one accent.
 */

export interface AccentPreset {
  id: string;
  name: string;
  /** Used as a flat field with white text on top, so every value is dark. */
  value: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'blue', name: 'Blue', value: Accent },
  { id: 'teal', name: 'Teal', value: '#0F7A73' },
  { id: 'green', name: 'Green', value: '#2F7D32' },
  { id: 'red', name: 'Red', value: '#B3261E' },
  { id: 'violet', name: 'Violet', value: '#6A4C93' },
  { id: 'graphite', name: 'Graphite', value: '#2B2F33' },
];

export const DefaultAccentId = 'blue';

function presetFor(id: string | null | undefined): AccentPreset {
  return ACCENT_PRESETS.find((preset) => preset.id === id) ?? ACCENT_PRESETS[0];
}

interface AccentContextValue {
  /** The chosen colour, ready to paint. */
  accent: string;
  accentId: string;
  setAccent: (accentId: string) => void;
}

const AccentContext = createContext<AccentContextValue | null>(null);

/**
 * Holds the accent choice for the whole app and remembers it between launches.
 * Mount it above every screen so a change repaints the chrome immediately.
 */
export function AccentProvider({ children }: { children: ReactNode }) {
  const [accentId, setAccentId] = useState<string>(DefaultAccentId);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = presetFor(await getStoredAccent()).id;
      if (!cancelled && stored !== DefaultAccentId) setAccentId(stored);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setAccent = useCallback((nextId: string) => {
    const next = presetFor(nextId);
    setAccentId(next.id);
    void setStoredAccent(next.id);
  }, []);

  const value = useMemo<AccentContextValue>(
    () => ({ accent: presetFor(accentId).value, accentId, setAccent }),
    [accentId, setAccent],
  );

  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

export function useAccent(): AccentContextValue {
  const context = useContext(AccentContext);
  if (!context) {
    throw new Error('useAccent must be used inside <AccentProvider>');
  }
  return context;
}
