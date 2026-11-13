import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroBoardPage,
  MetroButton,
  MetroDialog,
  MetroEmpty,
  MetroError,
  MetroField,
  MetroFileField,
  MetroStatLine,
  MetroLabel,
  MetroList,
  MetroListArea,
  MetroListRow,
  MetroLoading,
  MetroPanel,
  MetroPivot,
  MetroSection,
  MetroSelect,
  type MetroFigure,
} from '@/components/metro';
import { useMetro } from '@/components/metro/use-metro';
import { Spacing } from '@/constants/metro';
import { copyText } from '@/lib/clipboard';
import {
  MEDIA_MIME_TYPES,
  addScheduleItem,
  createDevice,
  deleteMedia,
  fetchDevice,
  listDevices,
  listMedia,
  mediaTypeLabel,
  removeScheduleItem,
  updateDevice,
  uploadMedia,
  type MediaType,
  type RtcDevice,
  type RtcMedia,
} from '@/lib/admin/rtc';
import { AdminToolbar } from './admin-toolbar';
import { pickFile } from '@/lib/media/pick-file';
import type { PickedFile } from '@/lib/media/upload';
import { AdminPivot } from './admin-pivot';

const TABS = [
  { value: 'devices', label: 'Devices' },
  { value: 'media', label: 'Media Library' },
];

/** The three kinds the player understands, in the order the picker offers them. */
const PICKER_TYPES = [
  ...MEDIA_MIME_TYPES.image,
  ...MEDIA_MIME_TYPES.video,
  ...MEDIA_MIME_TYPES.audio,
];

function mediaTypeFor(mimeType: string): MediaType | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return null;
}

/** Admin → Kiosk Connect, v1's two tabs. */
export function KioskAdmin() {
  const [tab, setTab] = useState('devices');

  return (
    <MetroBoardPage
      eyebrow="Admin"
      title="Kiosk Connect"
      subtitle="The screens in the field, what each one plays, and the media they draw from."
      width="wide">
      <AdminPivot />
      <MetroPivot tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'devices' ? <DevicesAdmin /> : <MediaAdmin />}
    </MetroBoardPage>
  );
}

function DevicesAdmin() {
  const [devices, setDevices] = useState<RtcDevice[]>([]);
  const [media, setMedia] = useState<RtcMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deviceRows, mediaRows] = await Promise.all([listDevices(), listMedia()]);
      setDevices(deviceRows);
      setMedia(mediaRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return devices;
    return devices.filter((device) => device.name.toLowerCase().includes(clean));
  }, [devices, query]);

  const figures: MetroFigure[] = [
    { label: 'Devices', value: String(devices.length) },
    { label: 'Media in the library', value: String(media.length) },
  ];

  return (
    <>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? <MetroBanner tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      <AdminToolbar
        count={`${visible.length} of ${devices.length}`}
        actions={
          <>
            <MetroButton label="Refresh" variant="ghost" onPress={() => void load()} />
            <MetroButton label="Create device" onPress={() => setCreating(true)} />
          </>
        }>
        <View style={styles.search}>
          <MetroField
            label="Search devices"
            hideLabel
            value={query}
            onChangeText={setQuery}
            placeholder="Search by device name"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {loading ? null : <MetroStatLine figures={figures} />}
      </AdminToolbar>

      <MetroListArea>
      {loading ? (
        <MetroLoading label="Loading devices" />
      ) : visible.length === 0 ? (
        <MetroEmpty
          title="No devices"
          message={
            query
              ? `Nothing matches “${query}”.`
              : 'Register a screen once, then program it to open its own address.'
          }
          action={<MetroButton label="Create device" onPress={() => setCreating(true)} />}
        />
      ) : (
        <MetroList>
          {visible.map((device) => (
            <MetroListRow
              key={device.id}
              title={device.name}
              subtitle={[device.hardwareMake, device.hardwareModel, device.hardwareSerial]
                .filter(Boolean)
                .join(' · ')}
              value={
                device.modified ? `Updated ${new Date(device.modified).toLocaleDateString()}` : undefined
              }
              onPress={() => setSelectedId(device.id)}
            />
          ))}
        </MetroList>
      )}

      {selectedId ? (
        <DevicePanel
          deviceId={selectedId}
          media={media}
          onClose={() => setSelectedId(null)}
          onChanged={() => void load()}
          onNotice={setNotice}
        />
      ) : null}

      {creating ? (
        <CreateDevicePanel
          onClose={() => setCreating(false)}
          onCreated={(device) => {
            setCreating(false);
            setDevices((rows) => [...rows, device]);
            setNotice(`“${device.name}” registered.`);
          }}
        />
      ) : null}
      </MetroListArea>
    </>
  );
}

function DevicePanel({
  deviceId,
  media,
  onClose,
  onChanged,
  onNotice,
}: {
  deviceId: string;
  media: RtcMedia[];
  onClose: () => void;
  onChanged: () => void;
  onNotice: (message: string) => void;
}) {
  const theme = useMetro();
  const [device, setDevice] = useState<RtcDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    hardwareMake: '',
    hardwareModel: '',
    hardwareSerial: '',
  });
  const [adding, setAdding] = useState(false);
  const [mediaId, setMediaId] = useState('');
  const [priority, setPriority] = useState('1');
  const [duration, setDuration] = useState('5');
  const [confirming, setConfirming] = useState(false);

  const adopt = useCallback((next: RtcDevice) => {
    setDevice(next);
    setForm({
      name: next.name,
      hardwareMake: next.hardwareMake,
      hardwareModel: next.hardwareModel,
      hardwareSerial: next.hardwareSerial,
    });
  }, []);

  const load = useCallback(async () => {
    try {
      adopt(await fetchDevice(deviceId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this device');
    } finally {
      setLoading(false);
    }
  }, [adopt, deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async () => {
    if (!form.name.trim() || !form.hardwareMake.trim() || !form.hardwareModel.trim() || !form.hardwareSerial.trim()) {
      setError('Every device field is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      adopt(
        await updateDevice(deviceId, {
          name: form.name.trim(),
          hardwareMake: form.hardwareMake.trim(),
          hardwareModel: form.hardwareModel.trim(),
          hardwareSerial: form.hardwareSerial.trim(),
        }),
      );
      onNotice('Device profile saved.');
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The device could not be saved');
    } finally {
      setSaving(false);
    }
  };

  /** The on-hold image and the call tone save the moment they are chosen, as in v1. */
  const saveSetting = async (
    patch: { onHoldImageId?: string | null; callStartToneId?: string | null },
    message: string,
  ) => {
    setSaving(true);
    setError(null);
    try {
      adopt(await updateDevice(deviceId, patch));
      onNotice(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That setting could not be saved');
    } finally {
      setSaving(false);
    }
  };

  const addToPlaylist = async () => {
    const chosen = media.find((entry) => entry.id === mediaId);
    if (!chosen) {
      setError('Choose the media to add.');
      return;
    }
    const order = Number(priority);
    if (!Number.isFinite(order) || order < 0) {
      setError('Priority is a number of zero or more.');
      return;
    }
    const seconds = Number(duration);
    if (chosen.mediaType === 'image' && (!Number.isFinite(seconds) || seconds < 1)) {
      setError('An image needs a duration of at least one second.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await addScheduleItem(deviceId, {
        mediaId: chosen.id,
        priority: order,
        duration: chosen.mediaType === 'image' ? seconds : null,
      });
      setAdding(false);
      setMediaId('');
      await load();
      onNotice(`${chosen.name} added to the playlist.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That media could not be added');
    } finally {
      setSaving(false);
    }
  };

  const removeFromPlaylist = async (scheduleId: string) => {
    setSaving(true);
    setError(null);
    try {
      await removeScheduleItem(deviceId, scheduleId);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That entry could not be removed');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDevice(deviceId, { active: false });
      setConfirming(false);
      onChanged();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The device could not be deactivated');
    } finally {
      setSaving(false);
    }
  };

  const playlist = [...(device?.mediaSchedule ?? [])].sort(
    (left, right) => left.priority - right.priority,
  );
  const images = media.filter((entry) => entry.mediaType === 'image');
  const tones = media.filter((entry) => entry.mediaType === 'audio');
  const playable = media.filter((entry) => entry.mediaType !== 'audio');

  return (
    <MetroPanel
      visible
      title={device?.name || 'Device'}
      subtitle={device ? device.hardwareModel || device.hardwareSerial : undefined}
      onClose={onClose}>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <MetroLoading label="Loading device" />
      ) : device ? (
        <>
          <MetroSection
            title="Device URL"
            hint="Program the kiosk to open this address.">
            <Text selectable style={[styles.address, { color: theme.text }]}>
              {device.kioskUrl}
            </Text>
            <View>
              <MetroButton
                label="Copy device URL"
                variant="ghost"
                onPress={async () => {
                  const copied = await copyText(device.kioskUrl);
                  onNotice(copied ? 'Device URL copied.' : 'Copy was blocked — select the address.');
                }}
              />
            </View>
          </MetroSection>

          <MetroSection title="Device profile" hint="All four fields are required.">
            <MetroField
              label="Device name"
              value={form.name}
              onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
            />
            <MetroField
              label="Hardware make"
              value={form.hardwareMake}
              onChangeText={(value) => setForm((current) => ({ ...current, hardwareMake: value }))}
            />
            <MetroField
              label="Hardware model"
              value={form.hardwareModel}
              onChangeText={(value) => setForm((current) => ({ ...current, hardwareModel: value }))}
            />
            <MetroField
              label="Hardware serial"
              value={form.hardwareSerial}
              onChangeText={(value) => setForm((current) => ({ ...current, hardwareSerial: value }))}
              autoCapitalize="characters"
            />
            <View>
              <MetroButton label="Update device profile" loading={saving} onPress={() => void saveProfile()} />
            </View>
          </MetroSection>

          <MetroSection title="On-hold image" hint="Shown while a caller waits.">
            <MetroSelect
              label="On-hold image"
              options={images.map((entry) => ({ value: entry.id, label: entry.name }))}
              value={device.onHoldImageId ?? ''}
              placeholder={images.length ? 'Choose an image' : 'No images in the library'}
              onChange={(value) =>
                void saveSetting({ onHoldImageId: value || null }, 'On-hold image saved.')
              }
              disabled={saving || images.length === 0}
            />
          </MetroSection>

          <MetroSection title="Call start tone" hint="Played when a call connects.">
            <MetroSelect
              label="Call start tone"
              options={tones.map((entry) => ({ value: entry.id, label: entry.name }))}
              value={device.callStartToneId ?? ''}
              placeholder={tones.length ? 'Choose a tone' : 'No audio in the library'}
              onChange={(value) =>
                void saveSetting({ callStartToneId: value || null }, 'Call start tone saved.')
              }
              disabled={saving || tones.length === 0}
            />
          </MetroSection>

          <MetroSection
            title="Media schedule"
            hint="Played in priority order; lower numbers play first."
            accessory={<MetroLabel>{`${playlist.length} item${playlist.length === 1 ? '' : 's'}`}</MetroLabel>}>
            <View style={styles.toolbar}>
              <MetroButton label="Add media" onPress={() => setAdding((open) => !open)} />
            </View>

            {adding ? (
              <View style={styles.addBlock}>
                <MetroSelect
                  label="Media"
                  options={playable.map((entry) => ({
                    value: entry.id,
                    label: `${entry.name} (${mediaTypeLabel(entry.mediaType)})`,
                  }))}
                  value={mediaId}
                  placeholder={playable.length ? 'Choose media' : 'No images or videos yet'}
                  onChange={setMediaId}
                  disabled={saving || playable.length === 0}
                />
                <MetroField
                  label="Priority"
                  value={priority}
                  onChangeText={setPriority}
                  keyboardType="numeric"
                  hint="Lower numbers play first."
                />
                <MetroField
                  label="Duration (seconds)"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                  hint="Images only; videos and audio play to their end."
                />
                <View>
                  <MetroButton label="Add to playlist" loading={saving} onPress={() => void addToPlaylist()} />
                </View>
              </View>
            ) : null}

            {playlist.length === 0 ? (
              <Text style={[styles.value, { color: theme.textDim }]}>
                Nothing scheduled. A device with an empty playlist shows its on-hold image.
              </Text>
            ) : (
              <MetroList>
                {playlist.map((item) => (
                  <MetroListRow
                    key={item.scheduleId}
                    title={item.name || 'Unknown media'}
                    subtitle={[
                      mediaTypeLabel(item.mediaType),
                      `Priority ${item.priority}`,
                      item.duration ? `${item.duration}s` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    accessory={
                      <View style={styles.rowActions}>
                        {item.mediaType === 'image' ? (
                          <Image source={{ uri: item.url }} style={styles.thumb} />
                        ) : null}
                        <MetroButton
                          label="Remove"
                          variant="ghost"
                          size="compact"
                          color="danger"
                          disabled={saving}
                          onPress={() => void removeFromPlaylist(item.scheduleId)}
                        />
                      </View>
                    }
                  />
                ))}
              </MetroList>
            )}

          </MetroSection>

          <MetroSection title="Deactivate device" hint="It disappears from this list and stops playing.">
            <View>
              <MetroButton
                label="Deactivate device"
                variant="ghost"
                color="danger"
                disabled={saving}
                onPress={() => setConfirming(true)}
              />
            </View>
          </MetroSection>

          <MetroDialog
            visible={confirming}
            title="Deactivate this device?"
            message="The kiosk keeps its record and playlist, but it is no longer managed here."
            onClose={() => setConfirming(false)}
            actions={[
              { label: 'Deactivate', destructive: true, loading: saving, onPress: () => void deactivate() },
              { label: 'Keep it', variant: 'ghost', onPress: () => setConfirming(false) },
            ]}
          />
        </>
      ) : (
        <MetroEmpty title="Device not found" message="It may have been deactivated in another session." />
      )}
    </MetroPanel>
  );
}

function CreateDevicePanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (device: RtcDevice) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    hardwareMake: '',
    hardwareModel: '',
    hardwareSerial: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const clean = {
      name: form.name.trim(),
      hardwareMake: form.hardwareMake.trim(),
      hardwareModel: form.hardwareModel.trim(),
      hardwareSerial: form.hardwareSerial.trim(),
    };
    if (!clean.name || !clean.hardwareMake || !clean.hardwareModel || !clean.hardwareSerial) {
      setError('Please fill out all fields.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      onCreated(await createDevice(clean));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The device could not be created');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MetroPanel visible title="Create device" subtitle="Register the screen before it goes out." onClose={onClose}>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      <MetroSection title="Device" hint="All four fields are required.">
        <MetroField
          label="Device name"
          value={form.name}
          onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
          placeholder="Front counter"
        />
        <MetroField
          label="Hardware make"
          value={form.hardwareMake}
          onChangeText={(value) => setForm((current) => ({ ...current, hardwareMake: value }))}
        />
        <MetroField
          label="Hardware model"
          value={form.hardwareModel}
          onChangeText={(value) => setForm((current) => ({ ...current, hardwareModel: value }))}
        />
        <MetroField
          label="Hardware serial"
          value={form.hardwareSerial}
          onChangeText={(value) => setForm((current) => ({ ...current, hardwareSerial: value }))}
          autoCapitalize="characters"
        />
      </MetroSection>

      <View>
        <MetroButton label="Create device" loading={saving} onPress={() => void submit()} />
      </View>
    </MetroPanel>
  );
}

function MediaAdmin() {
  const theme = useMetro();
  const [media, setMedia] = useState<RtcMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<RtcMedia | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMedia(await listMedia());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load media');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return media;
    return media.filter((entry) => entry.name.toLowerCase().includes(clean));
  }, [media, query]);

  const choose = async () => {
    setError(null);
    try {
      const picked = await pickFile(PICKER_TYPES);
      if (!picked) return;
      if (!mediaTypeFor(picked.type)) {
        setError('Choose an image, a video or an audio file.');
        return;
      }
      setFile(picked);
      if (!name.trim()) setName(picked.name.replace(/\.[^.]+$/, ''));
      setUploading(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That file could not be read');
    }
  };

  const chosenType = file ? mediaTypeFor(file.type) : null;

  const save = async () => {
    if (!file || !chosenType) {
      setError('Choose a file first.');
      return;
    }
    if (!name.trim()) {
      setError('Give the media a name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await uploadMedia(file, { name: name.trim(), mediaType: chosenType });
      setMedia((rows) => [created, ...rows]);
      setFile(null);
      setName('');
      setUploading(false);
      setNotice(`“${created.name}” added to the library.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The media could not be uploaded');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirming) return;
    setSaving(true);
    setError(null);
    try {
      await deleteMedia(confirming.id);
      setMedia((rows) => rows.filter((row) => row.id !== confirming.id));
      setConfirming(null);
      setNotice('Media deleted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That media could not be deleted');
    } finally {
      setSaving(false);
    }
  };

  const figures: MetroFigure[] = [
    { label: 'Images', value: String(media.filter((entry) => entry.mediaType === 'image').length) },
    { label: 'Videos', value: String(media.filter((entry) => entry.mediaType === 'video').length) },
    { label: 'Audio', value: String(media.filter((entry) => entry.mediaType === 'audio').length) },
  ];

  return (
    <>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? <MetroBanner tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      <AdminToolbar
        count={`${visible.length} of ${media.length}`}
        actions={
          <>
            <MetroButton label="Refresh" variant="ghost" onPress={() => void load()} />
            <MetroButton label="Add media" onPress={() => void choose()} />
          </>
        }>
        <View style={styles.search}>
          <MetroField
            label="Search media"
            hideLabel
            value={query}
            onChangeText={setQuery}
            placeholder="Search the library"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {loading ? null : <MetroStatLine figures={figures} />}
      </AdminToolbar>

      {uploading && file ? (
        <MetroSection
          title="New media"
          hint="Images, videos and audio, up to 200 MB. The type comes from the file.">
          <MetroFileField
            label="File"
            onPick={() => void choose()}
            files={[{ uri: file.uri, name: file.name, size: file.size, mimeType: file.type }]}
            onRemove={() => {
              setFile(null);
              setUploading(false);
            }}
            busy={saving}
          />
          <MetroField label="Name" value={name} onChangeText={setName} />
          <Text style={[styles.value, { color: theme.textDim }]}>
            {chosenType ? `Saved as ${mediaTypeLabel(chosenType)}.` : 'Unknown file type.'}
          </Text>
          <View style={styles.toolbar}>
            <MetroButton label="Add to library" loading={saving} onPress={() => void save()} />
            <MetroButton
              label="Cancel"
              variant="ghost"
              disabled={saving}
              onPress={() => {
                setFile(null);
                setUploading(false);
              }}
            />
          </View>
        </MetroSection>
      ) : null}

      <MetroListArea>
      {loading ? (
        <MetroLoading label="Loading media" />
      ) : visible.length === 0 ? (
        <MetroEmpty
          title="Nothing in the library"
          message={
            query
              ? `Nothing matches “${query}”.`
              : 'Add the images, videos and tones the kiosks play.'
          }
          action={<MetroButton label="Add media" onPress={() => void choose()} />}
        />
      ) : (
        <MetroList>
          {visible.map((entry) => (
            <MetroListRow
              key={entry.id}
              title={entry.name}
              subtitle={[
                mediaTypeLabel(entry.mediaType),
                entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              accessory={
                <View style={styles.rowActions}>
                  {entry.mediaType === 'image' ? (
                    <Image source={{ uri: entry.url }} style={styles.thumb} />
                  ) : null}
                  <MetroButton
                    label="Delete"
                    variant="ghost"
                    size="compact"
                    color="danger"
                    disabled={saving}
                    onPress={() => setConfirming(entry)}
                  />
                </View>
              }
            />
          ))}
        </MetroList>
      )}

      <MetroDialog
        visible={confirming !== null}
        title="Delete this media?"
        message={
          confirming
            ? `“${confirming.name}” is removed from the library. Devices still scheduled to it will lose it.`
            : undefined
        }
        onClose={() => setConfirming(null)}
        actions={[
          { label: 'Delete', destructive: true, loading: saving, onPress: () => void remove() },
          { label: 'Keep', variant: 'ghost', onPress: () => setConfirming(null) },
        ]}
      />
      </MetroListArea>
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },
  search: {
    flex: 1,
    // A phone wraps the rest of the toolbar under it rather than squeezing the field away.
    minWidth: 220,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  thumb: {
    width: 40,
    height: 40,
  },
  addBlock: {
    gap: Spacing.two,
  },
  address: {
    fontSize: 13,
  },
  value: {
    fontSize: 13,
  },
});
