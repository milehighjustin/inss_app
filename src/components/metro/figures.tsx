import { useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { MetroType, Spacing } from '@/constants/metro';
import { useMetro } from './use-metro';

export interface MetroFigure {
  /** What the number is, in the eyebrow voice. Rendered uppercase. */
  label: string;
  /** The number, already formatted by the caller. */
  value: string;
  /** One line of context under it: a comparison, a date, a count. */
  hint?: string;
  /** `danger` is for a number that needs attention (behind budget, late rent). */
  tone?: 'neutral' | 'accent' | 'danger';
}

export interface MetroFiguresProps {
  figures: MetroFigure[];
  /**
   * `large` is the page statement — three figures that are the reason the screen
   * exists. `medium` is for a band of four, where the numbers are evidence rather
   * than headline.
   */
  size?: 'large' | 'medium';
  style?: ViewStyle;
}

/**
 * Width one figure wants before the band wraps to a new row. The large size needs
 * enough for a seven-figure sum at the figure type size, so a phone drops to one
 * figure per row rather than clipping the number it came to read.
 */
const BASIS = 220;
const BASIS_MEDIUM = 160;

/**
 * The headline numbers of a page, held between two rules.
 *
 * No boxes: the band is a rule above and below, an eyebrow label, a number and a
 * note. Figures sit on shared columns and wrap as the window narrows; a hairline
 * separates the ones beside each other, and a figure that starts a wrapped row
 * starts clean. This is the same band on the portfolio, a property and a
 * facility, so a number reads the same wherever it is met.
 */
export function MetroFigures({ figures, size = 'large', style }: MetroFiguresProps) {
  const theme = useMetro();
  const [width, setWidth] = useState(0);

  // How many figures share a row: the narrower field of the two sizes, never more
  // than there are figures. Only used to decide which ones get the rule on their
  // left, so the first figure of a wrapped row never starts behind one.
  const basis = size === 'medium' ? BASIS_MEDIUM : BASIS;
  const columns =
    width > 0
      ? Math.max(1, Math.min(figures.length, Math.floor(width / basis)))
      : figures.length;

  return (
    <View
      style={[styles.band, { borderColor: theme.border }, style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {figures.map((figure, index) => {
        const divided = index % columns !== 0;
        const color =
          figure.tone === 'danger'
            ? theme.danger
            : figure.tone === 'accent'
              ? theme.accent
              : theme.text;

        return (
          <View
            key={figure.label}
            style={[
              styles.figure,
              size === 'medium' && styles.figureMedium,
              index === 0 && styles.figureFirst,
              divided && { borderLeftWidth: 1, borderLeftColor: theme.border },
            ]}>
            <Text style={[styles.label, { color: theme.textDim }]}>
              {figure.label.toUpperCase()}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                size === 'medium' ? styles.valueMedium : styles.value,
                styles.numbers,
                { color },
              ]}>
              {figure.value}
            </Text>
            {figure.hint ? (
              <Text numberOfLines={2} style={[styles.hint, { color: theme.textDim }]}>
                {figure.hint}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.four,
    paddingVertical: Spacing.four,
  },
  figure: {
    flexGrow: 1,
    flexBasis: BASIS,
    minWidth: 0,
    paddingHorizontal: Spacing.three,
    gap: 4,
  },
  figureMedium: {
    flexBasis: BASIS_MEDIUM,
  },
  // The band's first figure sits on the page's own margin, not indented from it.
  figureFirst: {
    paddingLeft: 0,
  },
  label: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  value: {
    fontSize: MetroType.figure.fontSize,
    lineHeight: MetroType.figure.lineHeight,
    fontWeight: MetroType.figure.fontWeight,
  },
  valueMedium: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  hint: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  /** Fixed-width digits so a column of money lines up. */
  numbers: {
    fontVariant: ['tabular-nums'],
  },
});
