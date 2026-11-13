import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Socket } from 'socket.io-client';

import {
  MetroBanner,
  MetroButton,
  MetroEmpty,
  MetroField,
  MetroFigures,
  MetroList,
  MetroListRow,
  MetroPanel,
  MetroScreen,
  MetroSection,
  MetroSelect,
  useMetro,
  type MetroSelectOption,
} from '@/components/metro';
import { StreamView } from '@/components/rtc/stream-view';
import { MetroType, Radius, Spacing } from '@/constants/metro';
import { apiFetch } from '@/lib/api/client';
import {
  consoleDeviceList,
  operatorSession,
  type ConsoleDevice,
  type IceServer,
} from '@/lib/rtc/api';
import {
  captureFrame,
  downloadDataUrl,
  mediaErrorMessage,
  openCamera,
  openScreen,
  photoCaptureSupported,
  stopStream,
} from '@/lib/rtc/browser';
import { connectSignaling, signalPayload } from '@/lib/rtc/socket';
import {
  plainCandidate,
  plainDescription,
  type Candidate,
  type Description,
  type PeerConnection,
  type Stream,
} from '@/lib/rtc/types';
import { createPeerConnection, newStream } from '@/lib/rtc/webrtc';

/**
 * The operator's end of a Kiosk Connect call.
 *
 * v1's `/kioskconnect`, with the same shape: the kiosks on one side, the call
 * on the other, and a control strip that mutes, stops the camera, shares a
 * screen, opens the capture tool and hangs up. The list is live — the socket
 * pushes it — so a kiosk coming online shows up without a refresh.
 *
 * One component for a browser and for a phone: WebRTC is reached through
 * `@/lib/rtc/webrtc` and the camera through `@/lib/rtc/browser`, which Metro
 * resolves per platform. The signaling protocol is unchanged from `cooperrtc`;
 * only the host moved. The console is the offerer: it asks a device to
 * initialise, makes the offer, and answers any signaling error into the banner.
 */

const PHOTO_TYPES: MetroSelectOption[] = [
  { value: 'PIC', label: 'Customer photo' },
  { value: 'IDN', label: 'Identification' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'OTHER', label: 'Other' },
];

const CALL_TIMEOUT_MS = 20_000;

type Phase = 'idle' | 'connecting' | 'connected';

interface Notice {
  tone: 'error' | 'success' | 'info';
  text: string;
}

export function KioskConsole() {
  const theme = useMetro();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  // A browser can capture a frame; a phone has no frame API to draw from.
  const photoTool = photoCaptureSupported();

  // Answering an alert lands here with the code's kiosk and the alert's id, so
  // the call that follows is the one the scan asked for, and the call itself is
  // attributable to the sign.
  const params = useLocalSearchParams<{ device?: string; alert?: string }>();
  const requestedDevice = typeof params.device === 'string' ? params.device : '';
  const alertId = typeof params.alert === 'string' ? params.alert : '';

  const [devices, setDevices] = useState<ConsoleDevice[]>([]);
  const [live, setLive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [active, setActive] = useState<ConsoleDevice | null>(null);
  const [remoteStream, setRemoteStream] = useState<Stream | null>(null);
  const [localStream, setLocalStream] = useState<Stream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  const [photoOpen, setPhotoOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [location, setLocation] = useState('');
  const [photoType, setPhotoType] = useState('PIC');
  const [photoError, setPhotoError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<PeerConnection | null>(null);
  const iceServers = useRef<IceServer[]>([]);
  const targetSocketId = useRef<string | null>(null);
  const cameraStream = useRef<Stream | null>(null);
  const screenStream = useRef<Stream | null>(null);
  const remote = useRef<Stream | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>('idle');
  /** The device this console is calling, for the server's record of the call. */
  const activeDevice = useRef<ConsoleDevice | null>(null);
  /** Whether the server has been told this call started, so it is told once. */
  const callOpen = useRef(false);
  // Candidates can arrive before the answer does; adding one too early throws
  // and the candidate would be lost, so they wait here first.
  const iceQueue = useRef<Candidate[]>([]);
  const remoteDescriptionSet = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearCallTimeout = () => {
    if (timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = null;
    }
  };

  /** Back to the idle stage: every stream stopped, the kiosk told to reset. */
  const hangUp = useCallback((message?: string) => {
    clearCallTimeout();

    const socket = socketRef.current;
    const target = targetSocketId.current;
    if (socket && target) socket.emit('resetYourself', { connectSocketId: target });

    // The server is what keeps an operator from being rung mid-call, so it has
    // to hear that the call is over — and only if it heard it start.
    if (callOpen.current) {
      callOpen.current = false;
      socket?.emit('callEnded');
    }

    peerRef.current?.close();
    peerRef.current = null;
    stopStream(cameraStream.current);
    stopStream(screenStream.current);
    cameraStream.current = null;
    screenStream.current = null;
    remote.current = null;
    targetSocketId.current = null;
    iceQueue.current = [];
    remoteDescriptionSet.current = false;

    setRemoteStream(null);
    setLocalStream(null);
    setScreenSharing(false);
    setMicOn(true);
    setCameraOn(true);
    setPhotoOpen(false);
    setPhoto(null);
    setPhotoError(null);
    setActive(null);
    activeDevice.current = null;
    setPhase('idle');

    if (message) setNotice({ tone: 'info', text: message });
  }, []);

  // The socket, and the list it keeps current.
  useEffect(() => {
    let disposed = false;
    let socket: Socket | null = null;

    (async () => {
      try {
        const session = await operatorSession();
        if (disposed) return;

        iceServers.current = session.iceServers;
        socket = connectSignaling(session.token);
        socketRef.current = socket;
        setLoadError(null);

        socket.on('connect', () => {
          setLive(true);
          setLoadError(null);
        });
        socket.on('disconnect', () => {
          setLive(false);
          if (phaseRef.current !== 'idle') hangUp('The connection to the server dropped.');
        });

        // The operator's token lasts an hour; a shift can outlast it, and the
        // socket only notices on its next reconnect. Ask for a new one, at most
        // every ten seconds so a dead API is not hammered.
        let lastRefresh = 0;
        socket.on('connect_error', () => {
          setLoadError('Cannot reach the calling service. Retrying…');
          const now = Date.now();
          if (now - lastRefresh < 10_000) return;
          lastRefresh = now;

          void (async () => {
            const current = socket;
            try {
              const fresh = await operatorSession();
              if (!current || disposed || current !== socketRef.current) return;
              iceServers.current = fresh.iceServers;
              current.auth = { token: fresh.token };
              current.connect();
            } catch {
              // socket.io keeps retrying on its own schedule.
            }
          })();
        });

        socket.on('devicesRefresh', (raw) => setDevices(consoleDeviceList(raw)));

        socket.on('rtcDeviceInitialized', (raw) => {
          const data = signalPayload(raw);
          const peer = peerRef.current;
          if (!peer || peer.signalingState !== 'stable') return;

          void (async () => {
            try {
              const offer = await peer.createOffer();
              await peer.setLocalDescription(offer);
              socket?.emit('offerCreated', {
                connectSocketId: data.connectSocketId,
                offer: plainDescription(peer.localDescription),
              });
            } catch {
              hangUp('The call could not be started.');
            }
          })();
        });

        socket.on('answerAvailable', (raw) => {
          const data = signalPayload(raw);
          const peer = peerRef.current;
          const answer = data.answer as Description | undefined;
          if (!peer || !answer) return;
          // v1's glare guard: an answer only applies to an outstanding offer.
          if (peer.signalingState !== 'have-local-offer') return;

          void (async () => {
            try {
              await peer.setRemoteDescription(answer);
              remoteDescriptionSet.current = true;
              clearCallTimeout();
              setPhase('connected');

              // Answered: the call is real now. Telling the server marks this
              // operator unavailable and records the start, so alerts arriving
              // from here on are held instead of ringing over the conversation.
              if (!callOpen.current) {
                callOpen.current = true;
                const device = activeDevice.current;
                socket?.emit('callStarted', {
                  ...(alertId ? { notificationId: alertId } : {}),
                  ...(device ? { rtcDeviceId: device.id, rtcDeviceName: device.name } : {}),
                });
              }

              while (iceQueue.current.length > 0) {
                const candidate = iceQueue.current.shift();
                if (candidate) await peer.addIceCandidate(candidate).catch(() => undefined);
              }
            } catch {
              hangUp('The kiosk answered but the connection failed.');
            }
          })();
        });

        socket.on('incomingIce', (raw) => {
          const candidate = signalPayload(raw).candidate as Candidate | undefined;
          if (!candidate) return;

          if (remoteDescriptionSet.current) {
            void peerRef.current?.addIceCandidate(candidate).catch(() => undefined);
          } else {
            iceQueue.current.push(candidate);
          }
        });

        socket.on('partnerError', (raw) => {
          const message = signalPayload(raw).error;
          setNotice({
            tone: 'error',
            text:
              typeof message === 'string' && message
                ? message
                : 'The kiosk reported a problem.',
          });
        });
      } catch (cause) {
        if (disposed) return;
        setLoadError(
          cause instanceof Error ? cause.message : 'The calling service is not available.',
        );
      }
    })();

    return () => {
      disposed = true;
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [hangUp]);

  // Nothing may keep the camera on after the screen goes away.
  useEffect(() => {
    return () => {
      clearCallTimeout();
      peerRef.current?.close();
      stopStream(cameraStream.current);
      stopStream(screenStream.current);
    };
  }, []);

  const connectTo = useCallback(
    async (device: ConsoleDevice) => {
      const socket = socketRef.current;
      if (!socket || phaseRef.current !== 'idle') return;
      if (!device.socketId) {
        setNotice({ tone: 'error', text: `${device.name} is offline.` });
        return;
      }

      setNotice(null);
      setActive(device);
      activeDevice.current = device;
      targetSocketId.current = device.socketId;
      iceQueue.current = [];
      remoteDescriptionSet.current = false;
      setPhase('connecting');

      let media: Stream;
      try {
        media = await openCamera();
      } catch (cause) {
        targetSocketId.current = null;
        setActive(null);
        setPhase('idle');
        setNotice({ tone: 'error', text: mediaErrorMessage(cause) });
        return;
      }

      cameraStream.current = media;
      setLocalStream(media);
      setMicOn(true);
      setCameraOn(true);

      const peer = createPeerConnection(iceServers.current);
      peerRef.current = peer;

      peer.onicecandidate = (event) => {
        const target = targetSocketId.current;
        if (!event.candidate || !target) return;
        socket.emit('iceCandidate', {
          candidate: plainCandidate(event.candidate),
          connectSocketId: target,
        });
      };

      peer.ontrack = (event) => {
        const stream = event.streams[0] ?? newStream(event.track);
        remote.current = stream;
        setRemoteStream(stream);
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'failed') hangUp('The call dropped.');
      };

      media.getTracks().forEach((track) => peer.addTrack(track, media));

      // The kiosk has to open its camera before it can answer; if it never
      // does, the console must not sit on a dead "Calling…" forever.
      timeout.current = setTimeout(() => {
        if (phaseRef.current !== 'connected') hangUp('The kiosk did not answer.');
      }, CALL_TIMEOUT_MS);

      socket.emit('initRtcDevice', { connectSocketId: device.socketId });
    },
    [hangUp],
  );

  const microphone = () => cameraStream.current?.getAudioTracks()[0] ?? null;
  const camera = () => cameraStream.current?.getVideoTracks()[0] ?? null;

  /** Tell the kiosk whether to show the on-hold image. */
  const announcePresence = () => {
    const socket = socketRef.current;
    const target = targetSocketId.current;
    if (!socket || !target) return;
    const live = Boolean(microphone()?.enabled) || Boolean(camera()?.enabled);
    socket.emit('callOnHold', { connectSocketId: target, hold: !live });
  };

  const toggleMic = () => {
    const track = microphone();
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
    announcePresence();
  };

  const toggleCamera = () => {
    const track = camera();
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
    announcePresence();
  };

  const startShare = async () => {
    const peer = peerRef.current;
    const socket = socketRef.current;
    const target = targetSocketId.current;
    if (!peer || !socket || !target) return;

    let screen: Stream;
    try {
      screen = await openScreen();
    } catch {
      setNotice({ tone: 'error', text: 'Screen sharing was not started.' });
      return;
    }

    const track = screen.getVideoTracks()[0];
    const sender = peer.getSenders().find((entry) => entry.track?.kind === 'video');
    if (!track || !sender) {
      stopStream(screen);
      setNotice({ tone: 'error', text: 'Screen sharing is not available on this call.' });
      return;
    }

    await sender.replaceTrack(track);
    track.onended = () => {
      void stopShare();
    };
    screenStream.current = screen;
    setScreenSharing(true);
    setLocalStream(screen);
  };

  const stopShare = async () => {
    const peer = peerRef.current;
    const track = camera();
    stopStream(screenStream.current);
    screenStream.current = null;
    setScreenSharing(false);
    setLocalStream(cameraStream.current);

    const sender = peer?.getSenders().find((entry) => entry.track?.kind === 'video');
    await sender?.replaceTrack(track ?? null).catch(() => undefined);
  };

  const openPhotoTool = () => {
    const socket = socketRef.current;
    const target = targetSocketId.current;
    if (socket && target) socket.emit('selfFocus', { connectSocketId: target });
    setPhoto(null);
    setPhotoError(null);
    setNotice(null);
    setPhotoOpen(true);
  };

  const closePhotoTool = () => {
    const socket = socketRef.current;
    const target = targetSocketId.current;
    if (socket && target) socket.emit('partnerFocus', { connectSocketId: target });
    setPhotoOpen(false);
  };

  const capturePhoto = async () => {
    const stream = remote.current;
    if (!stream) {
      setPhotoError('The kiosk is not sending a picture yet.');
      return;
    }

    setCapturing(true);
    setPhotoError(null);
    try {
      setPhoto(await captureFrame(stream));
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : 'The photo could not be captured.');
    } finally {
      setCapturing(false);
    }
  };

  /** v1's name: location_customer_unit_yyyymmdd_type. */
  const photoFileName = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${location.trim()}_${customerName.trim()}_${unitNumber.trim()}_${now.getFullYear()}${month}${day}_${photoType}`;
  };

  const downloadPhoto = () => {
    if (!photo) return;
    downloadDataUrl(photo, photoFileName());
  };

  const saveToDrive = async () => {
    if (!photo) {
      setPhotoError('Capture a photo first.');
      return;
    }
    if (!customerName.trim() || !unitNumber.trim() || !location.trim()) {
      setPhotoError('Fill in the customer name, unit number and location.');
      return;
    }

    setSaving(true);
    setPhotoError(null);
    try {
      const { file } = await apiFetch<{ file: { id: string; name: string } }>(
        '/api/mobile/rtc/photos',
        {
          method: 'POST',
          body: { dataUrl: photo, fileName: photoFileName() },
        },
      );
      closePhotoTool();
      setNotice({ tone: 'success', text: `Saved ${file.name} to Drive.` });
    } catch (cause) {
      setPhotoError(
        cause instanceof Error ? cause.message : 'The photo could not be saved to Drive.',
      );
    } finally {
      setSaving(false);
    }
  };

  const online = devices.filter((device) => device.status === 'connected').length;

  // The kiosk the alert came with: the screen beside the sign that was scanned.
  const suggested = requestedDevice
    ? devices.find((device) => device.id === requestedDevice) ?? null
    : null;

  const deviceRows = (
    <MetroList>
      {devices.map((device) => (
        <MetroListRow
          key={device.id}
          title={device.name}
          // The badge is the status; a subtitle saying the same thing twice made
          // every row read like a status report.
          badge={{
            label: device.status === 'connected' ? 'Online' : 'Offline',
            tone: device.status === 'connected' ? 'accent' : 'neutral',
          }}
          onPress={() => void connectTo(device)}
          disabled={device.status !== 'connected' || phase !== 'idle'}
        />
      ))}
    </MetroList>
  );

  const deviceList = (
    <View style={[styles.devicePanel, wide ? styles.devicePanelWide : styles.devicePanelStacked]}>
      {alertId ? (
        <View style={[styles.alertCall, { borderColor: theme.border }]}>
          <Text style={[styles.alertEyebrow, { color: theme.textDim }]}>FROM A SCANNED CODE</Text>

          {suggested ? (
            <>
              <Text style={[styles.alertTitle, { color: theme.text }]}>{suggested.name}</Text>
              <Text style={[styles.alertHint, { color: theme.textDim }]}>
                {suggested.socketId
                  ? 'The screen beside that sign is online — calling it shows you the person who scanned.'
                  : 'That kiosk is offline, so it cannot be called yet.'}
              </Text>
              <MetroButton
                label={`Call ${suggested.name}`}
                onPress={() => void connectTo(suggested)}
                disabled={!suggested.socketId || phase !== 'idle'}
              />
            </>
          ) : (
            <Text style={[styles.alertHint, { color: theme.textDim }]}>
              The code that was scanned has no video kiosk attached, so there is nothing to call.
              Pick one on the code in Admin → QR Codes.
            </Text>
          )}
        </View>
      ) : null}

      <MetroFigures
        size="medium"
        figures={[
          {
            label: 'Online',
            value: String(online),
            tone: online > 0 ? 'accent' : 'neutral',
          },
          { label: 'Kiosks', value: String(devices.length) },
        ]}
      />

      {devices.length > 0 ? (
        wide ? (
          // On a desktop the list owns its column: a framed container that takes
          // the height left under the counts and scrolls inside it, so the last
          // row is never cut off by the window and the scrollbar says so.
          <View
            style={[
              styles.deviceFrame,
              { borderColor: theme.border, backgroundColor: theme.background },
            ]}>
            <ScrollView style={styles.deviceScroll} showsVerticalScrollIndicator>
              {deviceRows}
            </ScrollView>
          </View>
        ) : (
          // On a phone the rows scroll with the page instead, so the list can
          // never spill over the call stage.
          deviceRows
        )
      ) : (
        <MetroEmpty
          title="No kiosks yet"
          message="Devices added in Admin → Kiosk Connect appear here when they are online."
        />
      )}
    </View>
  );

  const stage = (
    <View
      style={[
        styles.stage,
        wide ? styles.stageWide : styles.stageStacked,
        { backgroundColor: phase === 'connected' ? '#000000' : theme.surface },
      ]}>
      {phase === 'connected' ? (
        <>
          <StreamView stream={remoteStream} muted={false} fit="cover" style={styles.stageFill} />

          <View style={[styles.selfPreview, { width: wide ? 220 : 140 }]}>
            <StreamView stream={localStream} fit="cover" zOrder={1} />
          </View>

          <View
            style={[
              styles.controls,
              { backgroundColor: theme.background, borderColor: theme.border },
            ]}>
            <View style={styles.controlsRow}>
              {/* Compact: the strip sits over the video, so it has to stay out
                  of the way of the picture it is controlling. */}
              <MetroButton
                label={micOn ? 'Mute' : 'Unmute'}
                variant="ghost"
                size="compact"
                onPress={toggleMic}
                disabled={screenSharing}
              />
              <MetroButton
                label={cameraOn ? 'Camera off' : 'Camera on'}
                variant="ghost"
                size="compact"
                onPress={toggleCamera}
                disabled={screenSharing}
              />
              <MetroButton
                label={screenSharing ? 'Stop sharing' : 'Share screen'}
                variant="ghost"
                size="compact"
                onPress={() => void (screenSharing ? stopShare() : startShare())}
              />
              {photoTool ? (
                <MetroButton
                  label="Photo"
                  variant="ghost"
                  size="compact"
                  onPress={openPhotoTool}
                />
              ) : null}
              <MetroButton
                label="Disconnect"
                variant="ghost"
                size="compact"
                color="danger"
                onPress={() => hangUp('Call ended.')}
              />
            </View>
          </View>
        </>
      ) : phase === 'connecting' ? (
        <View style={styles.stageCenter}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.stageTitle, { color: theme.text }]}>Calling {active?.name}</Text>
          <Text style={[styles.stageHint, { color: theme.textDim }]}>
            The kiosk's camera comes up when it answers.
          </Text>
          <MetroButton label="Cancel" variant="ghost" onPress={() => hangUp('Call cancelled.')} />
        </View>
      ) : (
        <View style={styles.stageCenter}>
          <Text style={[styles.stageTitle, { color: theme.text }]}>No call in progress</Text>
          <Text style={[styles.stageHint, { color: theme.textDim }]}>
            Choose an online kiosk to see and talk to it.
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <MetroScreen
      eyebrow="Kiosk Connect"
      title="Console"
      width="wide"
      scroll={false}
      padding="compact"
      contentStyle={styles.screenContent}
      action={
        <View style={styles.live}>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: live ? theme.accent : theme.textDim },
            ]}
          />
          <Text style={[styles.liveText, { color: theme.textDim }]}>
            {live ? 'Live' : 'Connecting'}
          </Text>
        </View>
      }>
      {notice ? (
        <MetroBanner
          message={notice.text}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      {loadError ? (
        <MetroBanner
          message={loadError}
          tone="error"
          onDismiss={() => setLoadError(null)}>
          <Text style={[styles.bannerHint, { color: theme.textDim }]}>
            The list stays empty until the calling service is reachable.
          </Text>
        </MetroBanner>
      ) : null}

      {wide ? (
        <View style={styles.bodyWide}>
          {deviceList}
          {stage}
        </View>
      ) : (
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyStacked}
          showsVerticalScrollIndicator={false}>
          {stage}
          {deviceList}
        </ScrollView>
      )}

      <MetroPanel
        visible={photoOpen}
        title="Capture photo"
        subtitle={active?.name}
        onClose={closePhotoTool}>
        <MetroSection
          title="Remote view"
          hint="The kiosk's camera. Ask them to hold still, then capture.">
          <View style={styles.photoPreview}>
            <StreamView stream={remoteStream} muted={false} fit="contain" />
          </View>
          <MetroButton
            label={photo ? 'Capture again' : 'Capture'}
            onPress={() => void capturePhoto()}
            loading={capturing}
          />
        </MetroSection>

        {photo ? (
          <MetroSection title="Captured photo" hint="This is what will be saved.">
            <Image source={{ uri: photo }} contentFit="contain" style={styles.photoImage} />
          </MetroSection>
        ) : null}

        <MetroSection title="Customer" hint="The file is named from these four values.">
          <MetroField
            label="Customer name"
            value={customerName}
            onChangeText={setCustomerName}
            autoCapitalize="words"
            placeholder="Last, First"
          />
          <MetroField
            label="Unit number"
            value={unitNumber}
            onChangeText={setUnitNumber}
            placeholder="e.g. 214"
          />
          <MetroField
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. INSS Tustin"
          />
          <MetroSelect
            label="Photo type"
            options={PHOTO_TYPES}
            value={photoType}
            onChange={setPhotoType}
          />
        </MetroSection>

        {photoError ? (
          <MetroBanner
            message={photoError}
            tone="error"
            onDismiss={() => setPhotoError(null)}
          />
        ) : null}

        <View style={styles.photoActions}>
          <MetroButton
            label="Save to Drive"
            onPress={() => void saveToDrive()}
            loading={saving}
            disabled={!photo}
          />
          <MetroButton
            label="Download"
            variant="ghost"
            onPress={downloadPhoto}
            disabled={!photo}
          />
        </View>
      </MetroPanel>
    </MetroScreen>
  );
}

const styles = StyleSheet.create({
  alertCall: {
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  alertEyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: 600,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 600,
  },
  alertHint: {
    fontSize: 13,
    lineHeight: 19,
  },
  screenContent: {
    flex: 1,
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.round,
  },
  liveText: {
    fontSize: MetroType.eyebrow.fontSize,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  bannerHint: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  bodyWide: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.three,
    // Without this a flex row refuses to shrink below its tallest child, and the
    // list would push the page rather than scroll inside its column.
    minHeight: 0,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyStacked: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  devicePanel: {
    gap: Spacing.two,
    minHeight: 0,
  },
  devicePanelWide: {
    width: 340,
    maxWidth: '40%',
    minHeight: 0,
  },
  devicePanelStacked: {},
  deviceFrame: {
    borderWidth: 1,
    borderRadius: Radius.card,
    overflow: 'hidden',
    flex: 1,
    minHeight: 0,
  },
  deviceScroll: {
    // The column's height is the row's; the list takes what is left of it.
    flex: 1,
    minHeight: 0,
  },
  stage: {
    position: 'relative',
    overflow: 'hidden',
  },
  stageWide: {
    flex: 1,
  },
  stageStacked: {
    height: 380,
  },
  stageFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  selfPreview: {
    position: 'absolute',
    top: 12,
    right: 12,
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    overflow: 'hidden',
    zIndex: 2,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    borderTopWidth: 1,
    zIndex: 3,
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  stageCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  stageTitle: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
    textAlign: 'center',
  },
  stageHint: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: MetroType.body.fontWeight,
    textAlign: 'center',
  },
  photoPreview: {
    height: 260,
    backgroundColor: '#000000',
  },
  photoImage: {
    width: '100%',
    height: 260,
    backgroundColor: '#000000',
  },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
