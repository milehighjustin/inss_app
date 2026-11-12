/**
 * Design tokens.
 *
 * METRO.md is the design authority for this app. It began as pure Metro — square
 * corners everywhere, flat colour, type doing all the work — and has been eased
 * one step toward something more current: the grid and the type are still Metro,
 * but the surfaces have a soft corner and the palette is quieter.
 *
 * - flat colour fields, no gradients
 * - **square tiles** (`Radius.tile`) — the grid is the one thing that stays hard
 *   edged, because that is what the tiles look like on a station wall
 * - everything else gets a small radius: cards, lists, inputs, buttons
 * - one very soft shadow, and only on things that genuinely float (the top bar,
 *   a sheet, a dialog). A card on a page is a colour, not a raised object.
 * - type carries the hierarchy
 * - exactly one accent colour
 *
 * Corner radii must always come from `Radius` — never hardcode a number.
 */

import { Platform } from 'react-native';

/** One accent colour, owned by the app. Change it here, not per screen. */
export const Accent = '#208AEF';

export const Radius = {
  /** Tiles keep the hard Metro edge. This is the one 0 in the system. */
  tile: 0,
  /** Cards, lists, banners, sheets, panels — a plane with a soft corner. */
  card: 14,
  /** Interactive elements: buttons, inputs, selects, segmented controls. */
  control: 10,
  /** Inline pills: badges, small chips. */
  pill: 999,
  /** Circles only: status dots, avatars, progress rings, toggle knobs. */
  round: 999,
} as const;

/**
 * Elevation, in one step.
 *
 * Metro is flat, so nothing is "raised" on a page. These two strings are for the
 * top bar — which content scrolls under — and for surfaces that float over the
 * page: a sheet, a panel, a dialog. Everything else separates with colour.
 */
export const Shadow = {
  bar: '0px 1px 2px rgba(15, 17, 21, 0.06), 0px 2px 10px rgba(15, 17, 21, 0.04)',
  overlay: '0px 12px 32px rgba(15, 17, 21, 0.18)',
} as const;

export const MetroColors = {
  light: {
    background: '#FFFFFF',
    surface: '#F2F3F5',
    surfaceStrong: '#E6E8EC',
    text: '#0F1115',
    textDim: '#5F6570',
    border: '#E2E4E9',
    accent: Accent,
    onAccent: '#FFFFFF',
    danger: '#B3261E',
  },
  dark: {
    background: '#0E1013',
    surface: '#191C20',
    surfaceStrong: '#262A2F',
    text: '#FFFFFF',
    textDim: '#9BA1A9',
    border: '#2A2E34',
    accent: Accent,
    onAccent: '#FFFFFF',
    danger: '#FF6B6B',
  },
} as const;

export type MetroColorName = keyof typeof MetroColors.light;

/** Type scale. Hierarchy comes from size and weight, not from boxes. */
export const MetroType = {
  display: { fontSize: 48, lineHeight: 52, fontWeight: 600 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: 600 },
  subheader: { fontSize: 21, lineHeight: 26, fontWeight: 600 },
  /** A headline figure — the money a page is about. */
  figure: { fontSize: 29, lineHeight: 34, fontWeight: 600 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: 500 },
  subtle: { fontSize: 13, lineHeight: 20, fontWeight: 500 },
  /** Signage tracking: uppercase, but tight enough to read as a label. */
  eyebrow: { fontSize: 12, lineHeight: 16, letterSpacing: 1.3, fontWeight: 600 },
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
  control: 48,
  /** The top bar's own height, above the safe area. Kept deliberately small. */
  topBar: 44,
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
