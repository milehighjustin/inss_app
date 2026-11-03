import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, MetroColors, MetroType, type MetroColorName } from '@/constants/metro';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Text with the Metro type scale.
 *
 * METRO.md asks for tile titles and subtitles to come through this component
 * with `metroSubheader` / `metroSubtle`, so those types live here alongside the
 * general scale. Colours come from the single Metro palette.
 */

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'subtitle'
    | 'small'
    | 'smallBold'
    | 'code'
    | 'metroSubheader'
    | 'metroSubtle';
  themeColor?: MetroColorName;
};

export function ThemedText({ style, type = 'default', themeColor = 'text', ...rest }: ThemedTextProps) {
  const scheme = useColorScheme();
  const theme = MetroColors[scheme === 'dark' ? 'dark' : 'light'];

  return <Text style={[{ color: theme[themeColor] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: MetroType.body.fontWeight,
  },
  title: {
    fontSize: MetroType.display.fontSize,
    fontWeight: MetroType.display.fontWeight,
    lineHeight: MetroType.display.lineHeight,
  },
  subtitle: {
    fontSize: MetroType.title.fontSize,
    lineHeight: MetroType.title.lineHeight,
    fontWeight: MetroType.title.fontWeight,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
  metroSubheader: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  metroSubtle: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: MetroType.subtle.fontWeight,
  },
});
