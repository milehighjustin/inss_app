import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useMetro } from '@/components/metro';
import { MetroType } from '@/constants/metro';
import { AppName } from '@/constants/app';

/** Shown while a stored session token is checked against the backend. */
export function BootScreen() {
  const theme = useMetro();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.accentBar, { backgroundColor: theme.accent }]} />
      <Text style={[styles.eyebrow, { color: theme.textDim }]}>{AppName}</Text>
      <Text style={[styles.title, { color: theme.text }]}>Loading</Text>
      <ActivityIndicator color={theme.accent} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  accentBar: {
    height: 8,
    width: 96,
  },
  eyebrow: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  title: {
    fontSize: MetroType.title.fontSize,
    lineHeight: MetroType.title.lineHeight,
    fontWeight: MetroType.title.fontWeight,
  },
  spinner: {
    alignSelf: 'flex-start',
  },
});