import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { useMetro } from '@/components/metro';
import { Fonts, Radius } from '@/constants/metro';
import { investorMoney, investorPct, type InvestorLocation } from '@/lib/investor';

export interface AllocationSlice {
  location: InvestorLocation;
  share: number;
}

export interface AllocationPieProps {
  slices: AllocationSlice[];
  /** Width the chart may use; the square is capped below it. */
  available: number;
  /** Rim labels. v1 draws them on a desktop and hides them on a phone. */
  showLabels: boolean;
  onOpenLocation: (location: InvestorLocation) => void;
}

/**
 * v1's slice colours, in v1's order.
 *
 * This is the one place Metro allows more than one hue: a pie where neighbours
 * differ by four percent of one accent is unreadable, and investors recognise
 * this chart by its colours.
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

/**
 * v1's chart, to the point.
 *
 * Same 500-point field, same ring (`outerRadius` 140, `innerRadius` 30) and same
 * solid pie on a phone (no hole, no labels), same 16-point label in the slice's
 * own colour at `outerRadius + 20`, same -270° start so the first slice begins at
 * twelve o'clock. No leader lines, no centre readout, no percentages on the rim —
 * v1 drew names and nothing else, and an investor who knows the chart should not
 * have to relearn it.
 *
 * The one liberty is that a name is only drawn when its slice is at least three
 * percent, which is v1's own `percent < 0.03` rule.
 *
 * v1's labels are `internalId` when the property has one — a short code that fits
 * the rim — and the department name otherwise.
 */
const RAD = Math.PI / 180;
/** v1's outerRadius on its 500-point canvas. */
const OUTER_RATIO = 140 / 500;
/** v1's innerRadius on the same canvas, minus its own sliver of hole. */
const INNER_RATIO = 30 / 500;
const LABEL_FONT = 16;
/** v1 places labels 20 points past the rim. */
const LABEL_OFFSET = 20;
/** Slices under this share get no label, matching v1. */
const MIN_LABELLED_SHARE = 0.03;
const MAX_SIZE = 560;
const MIN_SIZE = 240;

function point(cx: number, cy: number, radius: number, degrees: number) {
  return { x: cx + radius * Math.cos(degrees * RAD), y: cy + radius * Math.sin(degrees * RAD) };
}

/** v1's axis label: the short internal code when there is one. */
function sliceName(location: InvestorLocation): string {
  const internal = typeof location.internalId === 'string' ? location.internalId.trim() : '';
  return internal.length > 1 ? internal : location.departmentName;
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
    return [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${outer} ${outer} 0 ${large} 1 ${end.x} ${end.y}`,
      'Z',
    ].join(' ');
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

export function AllocationPie({ slices, available, showLabels, onOpenLocation }: AllocationPieProps) {
  const theme = useMetro();
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);

  // v1's desktop chart is wider than it is tall; the drawable square is the
  // height, and the rim labels live in the space either side.
  const size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, available));
  const centre = size / 2;
  const outer = size * (showLabels ? OUTER_RATIO : 0.42);
  const inner = showLabels ? size * INNER_RATIO : 0;

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

  /**
   * The slice under a point, or null for the hole and the space around the pie.
   *
   * The hit test is done here rather than with a handler on each `<Path>`:
   * react-native-svg passes responder props straight to the DOM on web, and React
   * rejects those. One Pressable over the canvas works on both platforms, and the
   * same maths answers the pointer for the hover readout.
   */
  const hitTest = (x: number, y: number): { index: number } | null => {
    if (arcs.length === 0) return null;

    const dx = x - centre;
    const dy = y - centre;
    const distance = Math.hypot(dx, dy);
    if (distance > outer + 6 || distance < inner - 6) return null;

    if (arcs.length === 1) return { index: 0 };

    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < -90) angle += 360;

    const found = arcs.findIndex((arc) => angle >= arc.from && angle < arc.to);
    return { index: found >= 0 ? found : arcs.length - 1 };
  };

  const sliceAt = (event: GestureResponderEvent): number | null => {
    const native = event.nativeEvent as unknown as {
      locationX?: number;
      locationY?: number;
      offsetX?: number;
      offsetY?: number;
    };
    const x = native.locationX ?? native.offsetX;
    const y = native.locationY ?? native.offsetY;
    if (typeof x !== 'number' || typeof y !== 'number') return null;

    return hitTest(x, y)?.index ?? null;
  };

  const openAt = (event: GestureResponderEvent) => {
    const index = sliceAt(event);
    if (index === null) return;
    setHover(null);
    onOpenLocation(arcs[index].slice.location);
  };

  // v1 answers a pointer over a slice with the property's name, the equity in it
  // and that slice's share of the portfolio. A phone has no hover, so the readout
  // is web-only and the tap still opens the property.
  const boxRef = useRef<ComponentRef<typeof View>>(null);
  const hitTestRef = useRef(hitTest);
  hitTestRef.current = hitTest;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = boxRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return;

    const move = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hit = hitTestRef.current(x, y);
      setHover(hit ? { index: hit.index, x, y } : null);
    };
    const leave = () => setHover(null);

    node.addEventListener('pointermove', move);
    node.addEventListener('pointerleave', leave);
    return () => {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerleave', leave);
    };
  }, []);

  const whole = arcs.length === 1;
  const hovered = hover ? arcs[hover.index] : null;

  const TOOLTIP_WIDTH = 178;
  const tooltipLeft = hover ? Math.min(Math.max(hover.x + 16, 4), size - TOOLTIP_WIDTH - 4) : 0;
  const tooltipTop = hover ? Math.min(Math.max(hover.y + 16, 4), size - 96) : 0;

  return (
    <View ref={boxRef} style={{ width: size, height: size }}>
      <Svg width={size} height={size} accessibilityLabel="Equity allocation by property">
        {whole ? (
          inner > 0 ? (
            <Circle
              cx={centre}
              cy={centre}
              r={(outer + inner) / 2}
              stroke={arcs[0].color}
              strokeWidth={outer - inner}
              fill="none"
            />
          ) : (
            <Circle cx={centre} cy={centre} r={outer} fill={arcs[0].color} />
          )
        ) : (
          arcs.map((arc) => (
            <Path
              key={arc.key}
              d={slicePath(centre, centre, outer, inner, arc.from, arc.to)}
              fill={arc.color}
            />
          ))
        )}

        {showLabels
          ? arcs
              .filter((arc) => arc.share >= MIN_LABELLED_SHARE)
              .map((arc) => {
                const at = point(centre, centre, outer + LABEL_OFFSET, arc.mid);

                return (
                  <SvgText
                    key={`${arc.key}-label`}
                    x={at.x}
                    y={at.y}
                    fill={arc.color}
                    fontFamily={Fonts.sans}
                    fontSize={LABEL_FONT}
                    fontWeight={400}
                    textAnchor={at.x > centre ? 'start' : 'end'}
                    alignmentBaseline="central">
                    {sliceName(arc.slice.location)}
                  </SvgText>
                );
              })
          : null}
      </Svg>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open a property from the allocation chart"
        onPress={openAt}
        style={{ position: 'absolute', inset: 0 }}
      />

      {hovered ? (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            {
              left: tooltipLeft,
              top: tooltipTop,
              width: TOOLTIP_WIDTH,
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}>
          <Text numberOfLines={1} style={[styles.tooltipName, { color: theme.text }]}>
            {sliceName(hovered.slice.location)}
          </Text>
          <Text style={[styles.tooltipValue, { color: theme.text }]}>
            {investorMoney(hovered.slice.location.equity.investorInvestedTotal)}
          </Text>
          <Text style={[styles.tooltipShare, { color: theme.textDim }]}>
            {investorPct(hovered.slice.location.equity.pctTotalInvestment)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  tooltipName: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 700,
  },
  tooltipValue: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  tooltipShare: {
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
});
