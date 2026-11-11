import { useLocalSearchParams } from 'expo-router';

import { KioskPlayer } from '@/components/rtc/kiosk-player';
import { useKeepAwake } from '@/hooks/use-keep-awake';

/**
 * The kiosk screen, at the address programmed devices already open:
 * `/kioskconnect/kiosk/<rtcDeviceId>`.
 *
 * It sits outside `(app)`, so it has no session, no nav and no page column —
 * the player fills the display. The device id is the whole credential the page
 * needs; the API refuses one that has been deactivated.
 */
export default function KioskScreen() {
  // The display on the wall, in a browser as much as in the app: it plays its
  // playlist unattended, so it must not go to sleep on it.
  useKeepAwake('kiosk');

  const params = useLocalSearchParams<{ rtcDeviceId?: string | string[] }>();
  const deviceId = Array.isArray(params.rtcDeviceId)
    ? params.rtcDeviceId[0]
    : params.rtcDeviceId;

  return <KioskPlayer deviceId={deviceId ?? ''} />;
}
