import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { Accent } from '@/constants/metro';
import { AppName } from '@/constants/app';

/**
 * The logo every splash uses: the native splash config in app.json, the web
 * shell's pre-bundle splash (public/index.html) and this screen all draw the same
 * white lockup on the same blue, so the hand-offs read as one loading screen
 * rather than three.
 */
const Logo = require('../../assets/images/splash-icon.png');

/** Shown while a stored session token is checked against the backend. */
export function BootScreen() {
  return (
    <View style={styles.screen}>
      <Image
        source={Logo}
        style={styles.logo}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessibilityLabel={`${AppName} Self Storage`}
      />
      <View style={styles.status}>
        <ActivityIndicator color="#FFFFFF" />
        <Text style={styles.label}>Loading</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Accent,
  },
  logo: {
    width: 180,
    height: 209,
  },
  status: {
    marginTop: 28,
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
});
