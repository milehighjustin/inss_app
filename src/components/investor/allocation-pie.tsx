import { useState } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { useMetro } from '@/components/metro';
import { investorMoney, type InvestorLocation } from '@/lib/investor';

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
const LABEL_SHARE_FONT = 10;
/** Two lines per label plus breathing room, which is what the spread keeps apart. */
const LABEL_LINE = 30;
const MAX_SIZE = 540;
const MIN_SIZE = 220;
/** Slices under this share get no label, matching v1. */
const MIN_LABELLED_SHARE = 0.02;
/** How far a pressed slice lifts away from the ring, in points. */
const LIFT = 7;
/** The hole, as a fraction of the outer radius. */
const HOLE = { labels: 0.63, bare: 0.66 };
/** Ring thickness as a fraction of the outer radius, when nothing is highlighted. */
const RAD = Math.PI / 180;

function point(cx: number, cy: number, radius: number, degrees: number) {
  return { x: cx + radius * Math.cos(degrees * RAD), y: cy + radius * Math.sin(degrees * RAD) };
}

/**
 * A figure short enough to sit in the hole: `$2.4m`, `$184k`, `$9,120`.
 *
 * The centre of a donut has room for about eight characters, and a full
 * `$2,431,908` either overflows the ring or shrinks to unreadable. The legend
 * beside the chart keeps the exact money; this is the headline.
 */
function compactMoney(value: number): string {
  const size = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (size >= 1_000_000) return `${sign}$${(size / 1_000_000).toFixed(1)}m`;
  if (size >= 10_000) return `${sign}$${Math.round(size / 1_000)}k`;
  if (size >= 1_000) return `${sign}$${(size / 1_000).toFixed(1)}k`;
  return investorMoney(value);
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
  shareText: string;
  color: string;
  /** Where the leader starts, on the rim. */
  base: { x: number; y: number };
  /** Where the leader bends outwards. */
  elbow: { x: number; y: number };
  /** Where the label sits. */
  at: { x: number; y: number };
  side: 'left' | 'right';
}

/**
 * The Portfolio Equity Allocation chart.
 *
 * A donut, always: the ring is what makes the shares comparable at a glance, and
 * the hole is where the portfolio's own total belongs — a number the old solid
 * pie had nowhere to put, so it lived only in the legend. Slices are separated by
 * a hairline of page background, each labelled slice carries a dot and a
 * leader, and the label reads as two lines (property, then its share) rather than
 * one run-on string.
 *
 * Pressing a slice lifts it out of the ring and swaps the centre for that
 * property's money and share, so the chart answers "which one is that?" without a
 * trip to the legend. Lifting goes away on release; the tap itself still opens
 * the property, as it did.
 *
 * Everything is flat colour: no gradients, no shadows, no rounded caps — the
 * hues are the only thing Metro lets loose here.
 */
export function AllocationPie({ slices, available, showLabels, onOpenLocation }: AllocationPieProps) {
  const theme = useMetro();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, available));
  const centre = size / 2;
  // The bare gutter keeps room for a pressed slice to lift without leaving the
  // canvas; the labelled one is far wider than the lift needs.
  const outer = Math.max(40, centre - (showLabels ? LABEL_GUTTER : LIFT + 7));
  const inner = outer * (showLabels ? HOLE.labels : HOLE.bare);

  const total = slices.reduce((sum, slice) => sum + slice.share, 0) || 1;
  const invested = slices.reduce(
    (sum, slice) => sum + (Number(slice.location.equity?.investorInvestedTotal) || 0),
    0,
  );

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

  const active = arcs.find((arc) => arc.key === activeKey) ?? null;

  /**
   * The slice under a point, or null outside the ring.
   *
   * The hit test is done here rather than with a handler on each `<Path>`:
   * react-native-svg passes responder props straight to the DOM on web, and
   * React rejects those. One Pressable over the canvas works on both platforms
   * and keeps the chart keyboard-reachable.
   */
  const sliceAt = (event: GestureResponderEvent): number | null => {
    if (arcs.length === 0) return null;

    const native = event.nativeEvent as unknown as {
      locationX?: number;
      locationY?: number;
      offsetX?: number;
      offsetY?: number;
    };
    const x = native.locationX ?? native.offsetX;
    const y = native.locationY ?? native.offsetY;
    if (typeof x !== 'number' || typeof y !== 'number') return null;

    const dx = x - centre;
    const dy = y - centre;
    const distance = Math.hypot(dx, dy);
    // A little slack either side: a finger on the inner or outer edge of the ring
    // is aiming at a slice, not at nothing.
    if (distance > outer + 6 || distance < inner - 6) return null;

    if (arcs.length === 1) return 0;

    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < -90) angle += 360;

    const index = arcs.findIndex((arc) => angle >= arc.from && angle < arc.to);
    return index >= 0 ? index : arcs.length - 1;
  };

  const openAt = (event: GestureResponderEvent) => {
    const index = sliceAt(event);
    if (index === null) return;
    onOpenLocation(arcs[index].slice.location);
  };

  const highlightAt = (event: GestureResponderEvent) => {
    const index = sliceAt(event);
    setActiveKey(index === null ? null : arcs[index].key);
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
      const base = point(centre, centre, outer + 3, arc.mid);
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
        const labelX = side === 'right' ? centre + outer + 12 : centre - outer - 12;
        placed.push({
          key: entry.arc.key,
          slice: entry.arc.slice,
          text: labelText(entry.arc.slice.location.departmentName),
          shareText: `${Math.round(entry.arc.share * 100)}%`,
          color: entry.arc.color,
          base: entry.base,
          elbow: { x: side === 'right' ? entry.base.x + 12 : entry.base.x - 12, y: entry.base.y },
          at: { x: labelX, y: slot.y },
          side,
        });
      });
    }
  }

  // The centre block: the whole portfolio at rest, one property under a press.
  const hovered = active !== null;
  const eyebrow = hovered ? labelText(active.slice.location.departmentName) : 'TOTAL EQUITY';
  const headline = hovered ? compactMoney(active.slice.location.equity?.investorInvestedTotal ?? 0) : compactMoney(invested);
  const caption = hovered
    ? `${Math.round(active.share * 100)}% of portfolio`
    : `${slices.length} propert${slices.length === 1 ? 'y' : 'ies'}`;

  const eyebrowSize = Math.max(8, outer * 0.075);
  const headlineSize = Math.max(15, outer * 0.19);
  const captionSize = Math.max(9, outer * 0.075);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} accessibilityLabel="Equity allocation by property">
        {/* The track: a flat ring behind the slices, so the chart still reads as a
            ring when one property is the whole portfolio. */}
        <Circle
          cx={centre}
          cy={centre}
          r={(outer + inner) / 2}
          stroke={theme.surfaceStrong}
          strokeWidth={outer - inner}
          fill="none"
        />

        {arcs.map((arc) => {
          const whole = arcs.length === 1;
          const lifted = active?.key === arc.key;
          // One property is the whole ring, so it lifts nowhere: dimming is the
          // only feedback there, and a lifted ring would clip at the canvas edge.
          const offset = lifted && !whole ? LIFT : 0;
          const shift = point(0, 0, offset, arc.mid);

          return whole ? (
            <Circle
              key={arc.key}
              cx={centre + shift.x}
              cy={centre + shift.y}
              r={outer}
              stroke={arc.color}
              strokeWidth={outer - inner}
              fill="none"
            />
          ) : (
            <Path
              key={arc.key}
              d={slicePath(centre + shift.x, centre + shift.y, outer, inner, arc.from, arc.to)}
              fill={arc.color}
              // A hairline of page between neighbours: two similar hues read as
              // one shape without it.
              stroke={theme.background}
              strokeWidth={2}
              opacity={active && !lifted ? 0.45 : 1}
            />
          );
        })}

        {/* Rim dot and leader, one per labelled slice. */}
        {placed.map((label) => (
          <Circle
            key={`${label.key}-dot`}
            cx={label.base.x}
            cy={label.base.y}
            r={active && active.key !== label.key ? 1.6 : 2.6}
            fill={label.color}
          />
        ))}

        {placed.map((label) => (
          <Path
            key={`${label.key}-leader`}
            d={`M ${label.base.x} ${label.base.y} L ${label.elbow.x} ${label.elbow.y} L ${
              label.side === 'right' ? label.at.x - 5 : label.at.x + 5
            } ${label.at.y}`}
            stroke={active && active.key !== label.key ? theme.border : theme.textDim}
            strokeWidth={1}
            fill="none"
          />
        ))}

        {placed.map((label) => (
          <SvgText
            key={`${label.key}-text`}
            x={label.at.x}
            y={label.at.y - 1}
            fill={active && active.key !== label.key ? theme.textDim : theme.text}
            fontSize={LABEL_FONT}
            fontWeight={active?.key === label.key ? 700 : 500}
            textAnchor={label.side === 'right' ? 'start' : 'end'}>
            {label.text}
          </SvgText>
        ))}

        {placed.map((label) => (
          <SvgText
            key={`${label.key}-share`}
            x={label.at.x}
            y={label.at.y + LABEL_SHARE_FONT + 2}
            fill={label.color}
            fontSize={LABEL_SHARE_FONT}
            fontWeight={700}
            textAnchor={label.side === 'right' ? 'start' : 'end'}>
            {label.shareText}
          </SvgText>
        ))}

        {/* The hole's own content, in SVG so it scales with the ring. */}
        <SvgText
          x={centre}
          y={centre - eyebrowSize - 4}
          fill={theme.textDim}
          fontSize={eyebrowSize}
          fontWeight={600}
          letterSpacing={1.4}
          textAnchor="middle">
          {eyebrow.toUpperCase()}
        </SvgText>
        <SvgText
          x={centre}
          y={centre + headlineSize * 0.38}
          fill={theme.text}
          fontSize={headlineSize}
          fontWeight={600}
          textAnchor="middle">
          {headline}
        </SvgText>
        <SvgText
          x={centre}
          y={centre + headlineSize * 0.38 + captionSize + 8}
          fill={theme.textDim}
          fontSize={captionSize}
          textAnchor="middle">
          {caption}
        </SvgText>
      </Svg>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open a property from the allocation chart"
        onPressIn={highlightAt}
        onPressOut={() => setActiveKey(null)}
        onPress={openAt}
        style={{ position: 'absolute', inset: 0 }}
      />
    </View>
  );
}
