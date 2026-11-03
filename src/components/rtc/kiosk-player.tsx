import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Socket } from 'socket.io-client';

import { MediaItem, Tone } from '@/components/rtc/playback';
import { StreamView } from '@/components/rtc/stream-view';
import { kioskSession, type KioskDevice, type KioskSession, type ScheduledMedia } from '@/lib/rtc/api';
import { mediaErrorMessage, openCamera, stopStream } from '@/lib/rtc/browser';
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
 * The unattended end of a Kiosk Connect call.
 *
 * This is v1's `/kioskconnect/kiosk/[rtcDeviceId]` page, on the same path so a
 * screen that was already programmed keeps working: the device id in the URL is
 * all it needs, and the API hands back the four-day token, the playlist and the
 * TURN credentials.
 *
 * A kiosk can be the browser on the wall or this app on a phone or tablet; the
 * signaling and the layout are the same, and only the camera, the screen and
 * the media players come from the platform. The kiosk answers, it never offers
 * — the console starts the call and the kiosk's job is to put its camera up and
 * show the other side. While no call is running it plays its playlist.
 */
export function KioskPlayer({ deviceId }: { deviceId: string }) {
  const [session, setSession] = useState<KioskSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [connected, setConnected] = useState(false);
  const [localStream, setLocalStream] = useState<Stream | null>(null);
  const [remoteStream, setRemoteStream] = useState<Stream | null>(null);
  const [main, setMain] = useState<'self' | 'partner'>('self');
  const [mini, setMini] = useState<'self' | 'partner' | 'none'>('self');
  const [onHold, setOnHold] = useState(false);
  const [toneKey, setToneKey] = useState(0);

  const sessionRef = useRef<KioskSession | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<PeerConnection | null>(null);
  const cameraStream = useRef<Stream | null>(null);
  const targetSocketId = useRef<string | null>(null);
  const remoteDescriptionSet = useRef(false);
  const iceQueue = useRef<Candidate[]>([]);

  const { width } = useWindowDimensions();
  const miniWidth = Math.round(Math.min(200, width * 0.32));

  /**
   * Start the whole thing over: no session, so the socket, the peer and the
   * camera are torn down, then a fresh token and a fresh connection.
   *
   * v1 reloaded the page here. A phone cannot reload its bundle, and dropping
   * back to a fresh session does the same job on both platforms.
   */
  const reset = useCallback(() => {
    sessionRef.current = null;
    setSession(null);
    setConnected(false);
    setLocalStream(null);
    setRemoteStream(null);
    setMain('self');
    setMini('self');
    setOnHold(false);
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  // A kiosk is unattended: if the API cannot be reached, keep asking rather
  // than leaving a dead screen until someone walks over to it.
  useEffect(() => {
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const next = await kioskSession(deviceId);
        if (cancelled) return;
        sessionRef.current = next;
        setSession(next);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'This kiosk could not be loaded.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deviceId, attempt]);

  useEffect(() => {
    if (!error || session) return;
    const timer = setTimeout(() => setAttempt((value) => value + 1), 15_000);
    return () => clearTimeout(timer);
  }, [error, session]);

  const ready = session !== null;

  // One socket and one peer per session. The kiosk answers many calls without
  // starting over: only `resetYourself` (or a dead connection) does that.
  useEffect(() => {
    if (!ready) return;

    let disposed = false;
    const current = sessionRef.current;
    if (!current) return;

    const peer = createPeerConnection(current.iceServers);
    peerRef.current = peer;

    peer.onicecandidate = (event) => {
      const target = targetSocketId.current;
      if (!event.candidate || !target) return;
      socketRef.current?.emit('iceCandidate', {
        candidate: plainCandidate(event.candidate),
        connectSocketId: target,
      });
    };

    peer.ontrack = (event) => {
      const stream = event.streams[0] ?? newStream(event.track);
      setRemoteStream(stream);
      // The far end takes the full picture as soon as it sends one, and the
      // kiosk keeps its own camera in the corner.
      setMain('partner');
      setMini('self');
      setOnHold(false);
    };

    peer.onconnectionstatechange = () => {
      // With no operator to fix it, a fresh session is the only recovery a
      // kiosk has.
      if (peer.connectionState === 'failed') reset();
    };

    const socket = connectSignaling(current.token);
    socketRef.current = socket;

    let lastRefresh = 0;

    socket.on('connect_error', () => {
      if (disposed) return;
      // A kiosk outlives its token (four days). When the handshake is refused,
      // ask for a fresh one and try again; the cooldown keeps a dead API from
      // turning into a request storm.
      const now = Date.now();
      if (now - lastRefresh < 10_000) return;
      lastRefresh = now;

      void (async () => {
        try {
          const fresh = await kioskSession(deviceId);
          if (disposed) return;
          sessionRef.current = fresh;
          setSession(fresh);
          socket.auth = { token: fresh.token };
          socket.connect();
        } catch {
          // socket.io keeps retrying on its own schedule.
        }
      })();
    });

    socket.on('initializeConnection', (raw) => {
      const data = signalPayload(raw);
      const target = data.connectSocketId;
      if (typeof target !== 'string' || !target) return;

      targetSocketId.current = target;
      setError(null);
      setConnected(true);
      setToneKey((value) => value + 1);
      setMain('self');
      setMini('self');
      setOnHold(false);

      void (async () => {
        try {
          const media = await openCamera();
          if (disposed) {
            stopStream(media);
            return;
          }

          stopStream(cameraStream.current);
          cameraStream.current = media;
          setLocalStream(media);
          media.getTracks().forEach((track) => peer.addTrack(track, media));

          socket.emit('rtcDeviceInitialized', { connectSocketId: target });
        } catch (cause) {
          socket.emit('partnerError', {
            connectSocketId: target,
            error: `Partner Error: ${mediaErrorMessage(cause)}`,
          });
          setError('The camera and microphone could not be opened on this kiosk.');
        }
      })();
    });

    socket.on('offerAvailable', (raw) => {
      const data = signalPayload(raw);
      const offer = data.offer as Description | undefined;
      if (!offer) return;

      if (typeof data.connectSocketId === 'string') {
        targetSocketId.current = data.connectSocketId;
      }

      void (async () => {
        try {
          await peer.setRemoteDescription(offer);
          remoteDescriptionSet.current = true;

          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);

          socket.emit('answerCreated', {
            connectSocketId: targetSocketId.current,
            answer: plainDescription(answer),
          });

          while (iceQueue.current.length > 0) {
            const candidate = iceQueue.current.shift();
            if (candidate) await peer.addIceCandidate(candidate).catch(() => undefined);
          }
        } catch {
          setError('This kiosk could not answer the call.');
        }
      })();
    });

    socket.on('incomingIce', (raw) => {
      const candidate = signalPayload(raw).candidate as Candidate | undefined;
      if (!candidate) return;

      if (remoteDescriptionSet.current) {
        void peer.addIceCandidate(candidate).catch(() => undefined);
      } else {
        iceQueue.current.push(candidate);
      }
    });

    socket.on('partnerError', (raw) => {
      const message = signalPayload(raw).error;
      setError(typeof message === 'string' && message ? message : 'The call reported a problem.');
    });

    socket.on('selfFocus', () => {
      setMain('self');
      setMini('partner');
      setOnHold(false);
    });

    socket.on('partnerFocus', () => {
      setMain('partner');
      setMini('none');
    });

    socket.on('callOnHold', (raw) => {
      const hold = signalPayload(raw).hold === true;
      setOnHold(hold);
      setMain('partner');
      setMini('none');
    });

    socket.on('resetYourself', () => {
      reset();
    });

    return () => {
      disposed = true;
      socket.removeAllListeners();
      socket.disconnect();
      peer.close();
      peerRef.current = null;
      stopStream(cameraStream.current);
      cameraStream.current = null;
      targetSocketId.current = null;
      remoteDescriptionSet.current = false;
      iceQueue.current = [];
    };
  }, [ready, deviceId, reset]);

  if (!session) {
    return (
      <View style={styles.root}>
        {error ? (
          <View style={styles.centered}>
            <Text style={styles.idleTitle}>{error}</Text>
            <Text style={styles.idleHint}>Trying again shortly.</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {connected ? (
        <View style={styles.stage}>
          {main === 'partner' ? (
            <StreamView stream={remoteStream} muted={false} fit="cover" style={styles.fill} />
          ) : (
            <StreamView stream={localStream} fit="cover" style={styles.fill} />
          )}

          {mini !== 'none' && !onHold ? (
            <View style={[styles.mini, { width: miniWidth }]}>
              {mini === 'self' ? (
                <StreamView stream={localStream} fit="cover" zOrder={1} />
              ) : (
                <StreamView stream={remoteStream} muted={false} fit="cover" zOrder={1} />
              )}
            </View>
          ) : null}

          {onHold && session.device.onHoldImageUrl ? (
            <Image
              source={{ uri: session.device.onHoldImageUrl }}
              contentFit="contain"
              style={[styles.fill, styles.onHold]}
            />
          ) : null}

          {session.device.callStartToneUrl ? (
            // Remounted per answered call, so the tone plays once each time.
            <Tone key={toneKey} url={session.device.callStartToneUrl} />
          ) : null}
        </View>
      ) : (
        <Playlist device={session.device} />
      )}

      {error ? (
        <View style={styles.errorStrip}>
          <Text numberOfLines={2} style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The idle loop: the device's playlist, in priority order.
 *
 * Images hold for their scheduled duration; a video or a piece of audio moves
 * on when it ends. Nothing is drawn over the media, the way a kiosk should
 * look; a device with no playlist shows its own name so the screen is
 * identifiable.
 */
function Playlist({ device }: { device: KioskDevice }) {
  const items = device.mediaSchedule;
  const [index, setIndex] = useState(0);
  const count = items.length;
  const current: ScheduledMedia | null = count > 0 ? items[index % count] : null;

  useEffect(() => {
    setIndex(0);
  }, [device.id]);

  useEffect(() => {
    if (!current || current.mediaType !== 'image') return;

    // v1 multiplied an unset duration by 1000, which made images flash; ten
    // seconds is the default here.
    const seconds = current.duration && current.duration > 0 ? current.duration : 10;
    const timer = setTimeout(
      () => setIndex((value) => (value + 1) % count),
      Math.min(seconds, 3600) * 1000,
    );

    return () => clearTimeout(timer);
  }, [current, count]);

  const next = () => setIndex((value) => (value + 1) % count);

  if (!current) {
    return (
      <View style={styles.centered}>
        <Text style={styles.idleTitle}>{device.name}</Text>
        <Text style={styles.idleHint}>Waiting for a call.</Text>
      </View>
    );
  }

  return <MediaItem key={current.id} item={current} onEnded={next} />;
}

const styles = StyleSheet.create({
  root: {
    // A kiosk owns the screen: no header, no page column, no scroll.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  stage: {
    flex: 1,
    backgroundColor: '#000',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  onHold: {
    backgroundColor: '#000',
  },
  mini: {
    position: 'absolute',
    top: 16,
    right: 16,
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    overflow: 'hidden',
    zIndex: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  idleTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 600,
    textAlign: 'center',
  },
  idleHint: {
    color: '#9AA0A6',
    fontSize: 14,
    textAlign: 'center',
  },
  errorStrip: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
    zIndex: 3,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
});
