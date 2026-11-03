import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MetroDialog } from '@/components/metro';
import { KioskPlayer } from '@/components/rtc/kiosk-player';
import { useKiosk } from '@/lib/kiosk/kiosk';

/**
 * The whole app, while a device is in kiosk mode.
 *
 * The player already fills the screen; this shell adds the one thing a kiosk
 * still needs — a way for staff to get the device back. There is no visible
 * control, so a customer sees only the kiosk: the top-left corner answers a
 * three-second press with a confirm dialog, and leaving clears the stored id so
 * the next launch is the normal app again.
 */
export function KioskMode({ deviceId }: { deviceId: string }) {
  const kiosk = useKiosk();
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.root}>
      <KioskPlayer deviceId={deviceId} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kiosk settings"
        accessibilityHint="Press and hold to leave kiosk mode"
        delayLongPress={3000}
        onLongPress={() => setConfirming(true)}
        style={styles.corner}
      />

      <MetroDialog
        visible={confirming}
        title="Leave kiosk mode?"
        message={`This device will stop opening kiosk ${deviceId} and go back to the normal app.`}
        onClose={() => setConfirming(false)}
        actions={[
          {
            label: 'Cancel',
            variant: 'ghost',
            onPress: () => setConfirming(false),
          },
          {
            label: 'Leave',
            destructive: true,
            onPress: () => {
              setConfirming(false);
              void kiosk.setDevice(null);
            },
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  corner: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 64,
    height: 64,
    zIndex: 4,
  },
});
