/**
 * Metro design tokens.
 *
 * METRO.md is the design authority for this app. Everything here exists to make
 * the rules in that document the path of least resistance:
 *
 * - flat colour fields, no gradients or shadows
 * - squares, never rounded boxes (Radius.card / Radius.control are 0)
 * - type carries the hierarchy
 * - exactly one accent colour
 *
 * Corner radii must always come from `Radius` — never hardcode a number.
 */

import { Platform } from 'react-native';

/** One accent colour, owned by the app. Change it here, not per screen. */
export const Accent = '#208AEF';

export const Radius = {
  /** Tiles, cards, fields, chips — anything that is a flat colour plane. */
  card: 0,
  /** Interactive elements: buttons, toggles, chips, fields. */
  control: 0,
  /** Circles only: status dots, avatars, progress rings, toggle knobs. */
  round: 999,
} as const;

export const MetroColors = {
  light: {
    background: '#FFFFFF',
    surface: '#F0F0F3',
    surfaceStrong: '#E0E1E6',
    text: '#111315',
    textDim: '#60646C',
    border: '#D8DADF',
    accent: Accent,
    onAccent: '#FFFFFF',
    danger: '#B3261E',
  },
  dark: {
    background: '#111315',
    surface: '#1B1E21',
    surfaceStrong: '#2A2E32',
    text: '#FFFFFF',
    textDim: '#9AA0A6',
    border: '#2E3236',
    accent: Accent,
    onAccent: '#FFFFFF',
    danger: '#FF6B6B',
  },
} as const;

export type MetroColorName = keyof typeof MetroColors.light;

/** Type scale. Hierarchy comes from size and weight, not from boxes. */
export const MetroType = {
  display: { fontSize: 48, lineHeight: 52, fontWeight: 600 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: 600 },
  subheader: { fontSize: 22, lineHeight: 28, fontWeight: 600 },
  /** A headline figure — the money a page is about. */
  figure: { fontSize: 30, lineHeight: 36, fontWeight: 600 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: 500 },
  subtle: { fontSize: 13, lineHeight: 20, fontWeight: 500 },
  eyebrow: { fontSize: 12, lineHeight: 16, letterSpacing: 2, fontWeight: 600 },
} as const;

/** Widest the content column gets; text does not run edge to edge on desktop. */
export const MaxContentWidth = 800;

/** Consistent gaps. Metro separates with space and rules, not with boxes. */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Typefaces. Platform system faces; the web vars come from global.css. */
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Metrics = {
  /** Smallest square tile, used on narrow phones. */
  tileMin: 132,
  /** Largest square tile on phones; desktop/tablet tiles stay this size. */
  tileMax: 176,
  /** Gutter between tiles and the screen edge. */
  gutter: 16,
  /** Height of inputs and buttons. */
  control: 52,
  /** Width at which the field switches from phone to Windows 8 style. */
  desktop: 768,
} as const;

export interface TileField {
  columns: number;
  /** Square tile size in points. */
  size: number;
  gap: number;
  /** True when tiles stretch to fill the row instead of staying square-fixed. */
  stretch: boolean;
}

/**
 * Decides the tile grid for an available width.
 *
 * Phones: two columns, tiles stretch between 132 and 176 points.
 * Narrow phones: one column, full width.
 * Desktop/tablet: tiles stay at their fixed size and more columns appear.
 */
export function tileField(availableWidth: number): TileField {
  const gap = Metrics.gutter;

  // How many fixed-size squares fit, counting the gutter on both edges.
  const fitting = Math.floor((availableWidth + gap) / (Metrics.tileMax + gap));

  // Desktop/tablet: the squares keep their size and more of them appear.
  if (availableWidth > Metrics.desktop || fitting >= 3) {
    return { columns: Math.max(3, fitting), size: Metrics.tileMax, gap, stretch: false };
  }

  if (availableWidth < 320) {
    return { columns: 1, size: Math.max(Metrics.tileMin, availableWidth - gap * 2), gap, stretch: true };
  }

  // Phone: two columns, tiles stretch to fill between the min and max size.
  const columns = 2;
  const size = Math.round((availableWidth - gap * 3) / columns);
  if (size > Metrics.tileMax) {
    return { columns, size: Metrics.tileMax, gap, stretch: false };
  }
  return { columns, size: Math.max(Metrics.tileMin, size), gap, stretch: true };
}
