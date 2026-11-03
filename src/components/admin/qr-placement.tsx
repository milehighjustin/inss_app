import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MetroBanner, MetroButton, MetroSection, MetroSelect, useMetro } from '@/components/metro';
import { Spacing } from '@/constants/metro';
import { listLocations } from '@/lib/admin/locations';
import { updateQrCode, type QrCode } from '@/lib/admin/qr-codes';
import { listDevices, type RtcDevice } from '@/lib/admin/rtc';

/**
 * Admin → QR Codes → where the sign is.
 *
 * Two facts, both optional and both about answering well:
 *
 * - **Property** — an alert that says "Maple Street" can be acted on; one that
 *   says "a code was scanned" cannot. It also lets performance be read per
 *   property without matching on a code's name.
 * - **Video kiosk** — the screen beside the sign. Answering the alert can then
 *   start a call on that device, and the person who scanned is already standing
 *   in front of it.
 *
 * Neither is required: a code at a fence with no screen still works, and still
 * tells somebody it was scanned.
 */
export function QrPlacementSection({
  code,
  onChange,
  onNotice,
}: {
  code: QrCode;
  onChange: (code: QrCode) => void;
  onNotice: (message: string) => void;
}) {
  const theme = useMetro();
  const [locationId, setLocationId] = useState(code.locationId ?? '');
  const [rtcDeviceId, setRtcDeviceId] = useState(code.rtcDeviceId ?? '');
  const [locations, setLocations] = useState<{ value: string; label: string }[]>([]);
  const [devices, setDevices] = useState<{ value: string; label: string; description?: string }[]>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Two lists, both of which the API already serves. A failure here leaves
      // the section without options rather than blocking the rest of the panel.
      const [nextLocations, nextDevices] = await Promise.all([
        listLocations().catch(() => []),
        listDevices().catch(() => [] as RtcDevice[]),
      ]);
      if (cancelled) return;

      setLocations(
        nextLocations
          .map((location) => ({
            value: location.id,
            label: location.departmentName || location.name,
          }))
          .sort((left, right) => left.label.localeCompare(right.label, 'en', { numeric: true })),
      );

      setDevices(
        nextDevices
          .filter((device) => device.active)
          .map((device) => ({
            value: device.id,
            label: device.name,
            description: [device.hardwareMake, device.hardwareModel].filter(Boolean).join(' '),
          }))
          .sort((left, right) => left.label.localeCompare(right.label, 'en', { numeric: true })),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const locationOptions = useMemo(
    () => [{ value: '', label: 'No property' }, ...locations],
    [locations],
  );
  const deviceOptions = useMemo(
    () => [{ value: '', label: 'No video kiosk' }, ...devices],
    [devices],
  );

  const dirty =
    (locationId || null) !== (code.locationId ?? null) ||
    (rtcDeviceId || null) !== (code.rtcDeviceId ?? null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateQrCode(code.id, {
        locationId: locationId || null,
        rtcDeviceId: rtcDeviceId || null,
      });
      onChange(updated);
      onNotice(`“${code.name}” saved.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That could not be saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MetroSection
      title="Where it is"
      hint="A property and, if there is one, the video kiosk beside the sign.">
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      <MetroSelect
        label="Property"
        value={locationId}
        options={locationOptions}
        onChange={setLocationId}
        placeholder="No property"
        disabled={saving}
        sheetTitle="Property"
      />

      <MetroSelect
        label="Video kiosk"
        value={rtcDeviceId}
        options={deviceOptions}
        onChange={setRtcDeviceId}
        placeholder="No video kiosk"
        disabled={saving}
        sheetTitle="Video kiosk"
        hint="Answering an alert from this code can start a call on this screen."
      />

      {!rtcDeviceId ? (
        <Text style={[styles.note, { color: theme.textDim }]}>
          Without a kiosk, answering still opens the console — it just cannot offer a call.
        </Text>
      ) : null}

      <View>
        <MetroButton
          label="Save"
          loading={saving}
          disabled={!dirty || saving}
          onPress={() => void save()}
        />
      </View>
    </MetroSection>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
});
