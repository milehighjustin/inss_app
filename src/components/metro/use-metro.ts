import { useMemo } from 'react';

import { MetroColors } from '@/constants/metro';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccent } from '@/lib/preferences/accent';

/**
 * The active Metro palette.
 *
 * Uses the hydration-safe colour scheme hook so web server rendering and the
 * first client render agree. The accent comes from the user's preference, so
 * everything that reads `theme.accent` follows the choice made in Account.
 */
export function useMetro() {
  const scheme = useColorScheme();
  const { accent } = useAccent();
  const base = MetroColors[scheme === 'dark' ? 'dark' : 'light'];

  return useMemo(() => ({ ...base, accent }), [base, accent]);
}
