import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MetroType, Metrics, Radius } from '@/constants/metro';
import { useMetro } from './use-metro';

/**
 * Fits a label inside a tile: wrap first, then step the font size down.
 * Mirrors the rule in METRO.md so tiles never overflow.
 */
export function fitTileText(
  label: string,
  {
    available,
    preferred = MetroType.subheader.fontSize,
    maxLines = 3,
  }: { available: number; preferred?: number; maxLines?: number },
) {
  const floor = Math.max(10, preferred * 0.72);
  let fontSize = preferred;

  const lineCount = (size: number) => {
    const perLine = Math.max(1, available / (size * 0.54));
    return Math.ceil(label.trim().length / perLine);
  };

  let lines = lineCount(fontSize);
  while (lines > maxLines && fontSize > floor) {
    fontSize = Math.max(floor, Math.round(fontSize * 0.88));
    lines = lineCount(fontSize);
  }

  return { fontSize, lines: Math.min(lines, maxLines) };
}

export interface TileProps {
  title: string;
  subtitle?: string;
  /**
   * The mark at the top of the tile, usually a `TileIcon`. On an accent tile the
   * caller passes the icon in `onAccent`, because only the tile knows its fill.
   */
  icon?: ReactNode;
  /** Square tiles are the default; `wide` is exactly two squares plus a gutter. */
  shape?: 'square' | 'wide';
  /** Square size, from `tileField(...).size`. */
  size?: number;
  onPress?: () => void;
  accent?: boolean;
  style?: ViewStyle;
  children?: ReactNode;
}

export function Tile({
  title,
  subtitle,
  icon,
  shape = 'square',
  size = Metrics.tileMax,
  onPress,
  accent = false,
  style,
  children,
}: TileProps) {
  const theme = useMetro();
  const width = shape === 'wide' ? size * 2 + Metrics.gutter : size;
  const padding = 14;
  const { fontSize } = fitTileText(title, { available: width - padding * 2 });

  const content = (
    <View
      style={[
        styles.tile,
        {
          width,
          height: size,
          padding,
          backgroundColor: accent ? theme.accent : theme.surface,
        },
        style,
      ]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <ThemedText
        type="metroSubheader"
        numberOfLines={3}
        style={{
          color: accent ? theme.onAccent : theme.text,
          fontSize,
          lineHeight: Math.round(fontSize * 1.2),
        }}>
        {title}
      </ThemedText>
      {subtitle ? (
        <ThemedText
          type="metroSubtle"
          numberOfLines={2}
          style={{ color: accent ? theme.onAccent : theme.textDim }}>
          {subtitle}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    // Tiles are the one hard-edged thing left: Radius.tile is 0 on purpose.
    borderRadius: Radius.tile,
    // Content sits on the tile's bottom edge — the label is the anchor and the
    // mark floats above it — so a row of tiles reads as one baseline rather
    // than as blocks of text starting at different heights.
    justifyContent: 'flex-end',
    gap: 6,
    overflow: 'hidden',
  },
  icon: {
    // The mark is pinned to the top of whatever space the labels leave.
    marginBottom: 'auto',
  },
  pressed: {
    opacity: 0.75,
  },
});
