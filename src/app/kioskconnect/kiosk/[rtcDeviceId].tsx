import { useLocalSearchParams } from 'expo-router';

import { KioskPlayer } from '@/components/rtc/kiosk-player';

/**
 * The kiosk screen, at the address programmed devices already open:
 * `/kioskconnect/kiosk/<rtcDeviceId>`.
 *
 * It sits outside `(app)`, so it has no session, no nav and no page column —
 * the player fills the display. The device id is the whole credential the page
 * needs; the API refuses one that has been deactivated.
 */
export default function KioskScreen() {
  const params = useLocalSearchParams<{ rtcDeviceId?: string | string[] }>();
  const deviceId = Array.isArray(params.rtcDeviceId)
    ? params.rtcDeviceId[0]
    : params.rtcDeviceId;

  return <KioskPlayer deviceId={deviceId ?? ''} />;
}
