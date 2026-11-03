import { Pressable, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { useMetro } from '@/components/metro';
import type { InvestorLocation } from '@/lib/investor';

export interface AllocationSlice {
  location: InvestorLocation;
  share: number;
}

export interface AllocationPieProps {
  slices: AllocationSlice[];
  /** Width the chart may use; the square is capped below it. */
  available: number;
  /** Name labels around the rim. v1 shows them on desktop and hides them on phones. */
  showLabels: boolean;
  onOpenLocation: (location: InvestorLocation) => void;
}

/**
 * v1's slice colours, in v1's order.
 *
 * This is the one place Metro allows more than one hue: a pie where neighbours
 * differ by four percent of one accent is unreadable, and investors recognise
 * this chart by its colours. The legend and the bar view use the same list, so a
 * slice and its swatch always agree.
 */
export const ALLOCATION_COLORS = [
  '#FF6633', '#FFB399', '#FF33FF', '#00B3E6',
  '#E6B333', '#3366E6', '#999966', '#B34D4D',
  '#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A',
  '#FF99E6', '#FF1A66', '#E6331A', '#33FFCC',
  '#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC',
  '#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
  '#E666B3', '#33991A', '#CC9999', '#B3B31A',
  '#4D8066', '#809980', '#E6FF80', '#999933',
  '#FF3380', '#CCCC00', '#66E64D', '#4D80CC', '#9900B3',
  '#E64D66', '#4DB380', '#FF4D4D', '#99E6E6', '#6666FF',
];

/** The colour of the slice at `index`; stable for the same ordering. */
export function allocationColor(index: number): string {
  return ALLOCATION_COLORS[index % ALLOCATION_COLORS.length];
}

const LABEL_GUTTER = 124;
const LABEL_FONT = 11;
const LABEL_LINE = 18;
const MAX_SIZE = 540;
const MIN_SIZE = 220;
/** Slices under this share get no label, matching v1. */
const MIN_LABELLED_SHARE = 0.02;

const RAD = Math.PI / 180;

function point(cx: number, cy: number, radius: number, degrees: number) {
  return { x: cx + radius * Math.cos(degrees * RAD), y: cy + radius * Math.sin(degrees * RAD) };
}

/**
 * One slice as an SVG path: out along the rim, down the side, back along the
 * inner edge. Angles are degrees from three o'clock, sweeping clockwise, and the
 * caller starts at v1's -270° (twelve o'clock).
 */
function slicePath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  from: number,
  to: number,
): string {
  const start = point(cx, cy, outer, from);
  const end = point(cx, cy, outer, to);
  const large = to - from > 180 ? 1 : 0;

  if (inner <= 0) {
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${outer} ${outer} 0 ${large} 1 ${end.x} ${end.y} Z`;
  }

  const innerEnd = point(cx, cy, inner, to);
  const innerStart = point(cx, cy, inner, from);

  return [
    `M ${start.x} ${start.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${end.x} ${end.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

/** A name short enough for the rim gutter; v1's own names already fit. */
function labelText(name: string): string {
  return name.length <= 15 ? name : `${name.slice(0, 14)}…`;
}

/**
 * Spreads labels on one side so none sit on top of another, like v1's
 * `layoutLabels`. Mirrors the sort-and-push pass, clamped to the canvas.
 */
function spread(entries: { y: number; height: number }[]) {
  entries.sort((left, right) => left.y - right.y);
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    if (current.y - previous.y < LABEL_LINE) {
      current.y = previous.y + LABEL_LINE;
    }
  }

  // Push back up if the stack ran past the bottom edge.
  const last = entries[entries.length - 1];
  if (last) {
    const overflow = last.y - (last.height - 10);
    if (overflow > 0) {
      for (const entry of entries) entry.y -= overflow;
    }
  }

  // And never above the top edge.
  const first = entries[0];
  if (first && first.y < 14) {
    const underflow = 14 - first.y;
    for (const entry of entries) entry.y += underflow;
  }
}

interface PlacedLabel {
  key: string;
  slice: AllocationSlice;
  text: string;
  /** Where the leader starts, on the rim. */
  base: { x: number; y: number };
  /** Where the leader bends outwards. */
  elbow: { x: number; y: number };
  /** Where the label sits. */
  at: { x: number; y: number };
  side: 'left' | 'right';
}

/**
 * v1's Portfolio Equity Allocation pie.
 *
 * A donut when there is room for labels (v1's desktop chart) and a solid pie on
 * a phone (v1's mobile chart), starting at the top and running clockwise like
 * Recharts does for v1. Each slice is tappable, which is how the property detail
 * opens here — v1's chart was clickable too, and its hover card carried the same
 * name, money and share the legend under the chart carries.
 */
export function AllocationPie({ slices, available, showLabels, onOpenLocation }: AllocationPieProps) {
  const theme = useMetro();

  const size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, available));
  const centre = size / 2;
  const outer = Math.max(40, centre - (showLabels ? LABEL_GUTTER : 8));
  const inner = showLabels ? outer * 0.22 : 0;

  const total = slices.reduce((sum, slice) => sum + slice.share, 0) || 1;

  let cursor = -90;

  const arcs = slices.map((slice, index) => {
    const sweep = (slice.share / total) * 360;
    const from = cursor;
    const to = cursor + sweep;
    cursor = to;

    return {
      key: slice.location.id,
      slice,
      color: allocationColor(index),
      share: slice.share / total,
      from,
      to,
      mid: from + sweep / 2,
    };
  });

  // A single property is the whole portfolio: a full circle has no start or end
  // for an arc to travel between, so it is drawn as circles instead.
  const whole = slices.length === 1;

  /**
   * A tap anywhere on the chart opens the slice under the finger.
   *
   * The hit test is done here rather than with a handler on each `<Path>`:
   * react-native-svg passes responder props straight to the DOM on web, and
   * React rejects those. One Pressable over the canvas works on both platforms
   * and keeps the chart keyboard-reachable.
   */
  const openAt = (event: GestureResponderEvent) => {
    const native = event.nativeEvent as unknown as {
      locationX?: number;
      locationY?: number;
      offsetX?: number;
      offsetY?: number;
    };
    const x = native.locationX ?? native.offsetX;
    const y = native.locationY ?? native.offsetY;
    if (typeof x !== 'number' || typeof y !== 'number') return;

    const dx = x - centre;
    const dy = y - centre;
    const distance = Math.hypot(dx, dy);
    if (distance > outer || distance < inner) return;

    if (whole) {
      onOpenLocation(slices[0].location);
      return;
    }

    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < -90) angle += 360;

    const hit =
      arcs.find((arc) => angle >= arc.from && angle < arc.to) ??
      arcs[arcs.length - 1];

    if (hit) onOpenLocation(hit.slice.location);
  };

  const placed: PlacedLabel[] = [];

  if (showLabels) {
    const sides: Record<'left' | 'right', { y: number; height: number }[]> = {
      left: [],
      right: [],
    };
    const pending: { arc: (typeof arcs)[number]; side: 'left' | 'right'; base: { x: number; y: number } }[] = [];

    for (const arc of arcs) {
      if (arc.share < MIN_LABELLED_SHARE) continue;
      const base = point(centre, centre, outer + 2, arc.mid);
      const side: 'left' | 'right' = base.x >= centre ? 'right' : 'left';
      const slot = { y: base.y, height: size };
      sides[side].push(slot);
      pending.push({ arc, side, base });
    }

    spread(sides.left);
    spread(sides.right);

    // `spread` sorted each side by y; walk the same order to pair slots with arcs.
    for (const side of ['left', 'right'] as const) {
      const sideArcs = pending
        .filter((entry) => entry.side === side)
        .sort((left, right) => left.base.y - right.base.y);

      sideArcs.forEach((entry, index) => {
        const slot = sides[side][index];
        const labelX = side === 'right' ? centre + outer + 10 : centre - outer - 10;
        placed.push({
          key: entry.arc.key,
          slice: entry.arc.slice,
          text: `${labelText(entry.arc.slice.location.departmentName)} ${Math.round(entry.arc.share * 100)}%`,
          base: entry.base,
          elbow: { x: side === 'right' ? entry.base.x + 10 : entry.base.x - 10, y: entry.base.y },
          at: { x: labelX, y: slot.y },
          side,
        });
      });
    }
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} accessibilityLabel="Equity allocation by property">
        {whole ? (
          <>
            <Circle cx={centre} cy={centre} r={outer} fill={arcs[0].color} />
            {inner > 0 ? <Circle cx={centre} cy={centre} r={inner} fill={theme.background} /> : null}
          </>
        ) : (
          arcs.map((arc) => (
            <Path
              key={arc.key}
              d={slicePath(centre, centre, outer, inner, arc.from, arc.to)}
              fill={arc.color}
              stroke={theme.background}
              strokeWidth={1}
            />
          ))
        )}

        {placed.map((label) => (
          <Path
            key={`${label.key}-leader`}
            d={`M ${label.base.x} ${label.base.y} L ${label.elbow.x} ${label.elbow.y} L ${
              label.side === 'right' ? label.at.x - 4 : label.at.x + 4
            } ${label.at.y}`}
            stroke={theme.textDim}
            strokeWidth={1}
            fill="none"
          />
        ))}

        {placed.map((label) => (
          <SvgText
            key={`${label.key}-text`}
            x={label.at.x}
            y={label.at.y + 4}
            fill={theme.text}
            fontSize={LABEL_FONT}
            textAnchor={label.side === 'right' ? 'start' : 'end'}>
            {label.text}
          </SvgText>
        ))}
      </Svg>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open a property from the allocation chart"
        onPress={openAt}
        style={{ position: 'absolute', inset: 0 }}
      />
    </View>
  );
}
