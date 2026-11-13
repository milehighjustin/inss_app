import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useMetro } from './use-metro';

/**
 * The line icons a tile can carry.
 *
 * Drawn, not imported: the app has no icon font, and a tile is the one place a
 * picture belongs — it says what the section is before the label is read. They
 * are 1.6-point strokes on a 24-point grid with square caps, so they belong to
 * the same language as the tiles themselves: flat, square, one colour.
 *
 * The set is deliberately small and named for the section, not for the object:
 * `portfolio` is bars, `kpi` is a trend, and neither will be reused for
 * something else.
 */
export type TileIconName = 'portfolio' | 'kpi' | 'kiosk' | 'support' | 'files' | 'account';

export interface TileIconProps {
  name: TileIconName;
  /** Square size in points. */
  size?: number;
  /** Defaults to the dim text colour; an accent tile passes `onAccent`. */
  color?: string;
}

export function TileIcon({ name, size = 30, color }: TileIconProps) {
  const theme = useMetro();
  const stroke = color ?? theme.textDim;
  const line = {
    stroke,
    strokeWidth: 1.6,
    fill: 'none',
    strokeLinecap: 'square',
    strokeLinejoin: 'miter',
  } as const;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'portfolio' ? (
        <>
          <Path d="M3 20h18" {...line} />
          <Path d="M7 20v-6" {...line} />
          <Path d="M12 20V9" {...line} />
          <Path d="M17 20v-9" {...line} />
        </>
      ) : null}

      {name === 'kpi' ? (
        <>
          <Path d="M4 18l5-6 4 3 7-9" {...line} />
          <Path d="M16 6h4v4" {...line} />
        </>
      ) : null}

      {name === 'kiosk' ? (
        // A video call, not a monitor: the console's whole job is answering a
        // caller face to face, so the mark is a camera with its lens open.
        <>
          <Rect x="2.5" y="6" width="12" height="12" {...line} />
          <Path d="M14.5 10.5l6.5-3v9l-6.5-3z" {...line} />
        </>
      ) : null}

      {name === 'support' ? (
        <>
          <Path d="M5 14v-2a7 7 0 0 1 14 0v2" {...line} />
          <Rect x="3" y="13" width="3.5" height="6" {...line} />
          <Rect x="17.5" y="13" width="3.5" height="6" {...line} />
        </>
      ) : null}

      {name === 'files' ? (
        <>
          <Path d="M6 3h8l4 4v14H6z" {...line} />
          <Path d="M14 3v4h4" {...line} />
        </>
      ) : null}

      {name === 'account' ? (
        <>
          <Circle cx="12" cy="8" r="3.5" {...line} />
          <Path d="M5 20a7 7 0 0 1 14 0" {...line} />
        </>
      ) : null}
    </Svg>
  );
}
