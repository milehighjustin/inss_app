import { KioskConsole } from '@/components/rtc/kiosk-console';
import { useKeepAwake } from '@/hooks/use-keep-awake';

/** v1's `/kioskconnect`: the operator console, at the same address. */
export default function KioskConnectScreen() {
  // Someone sits here watching for a call, not typing. A sleeping screen is a
  // missed call, so the console holds it awake — the browser too, where the tab
  // is likely left in front of a desk all day.
  useKeepAwake('kiosk-connect');

  return <KioskConsole />;
}
