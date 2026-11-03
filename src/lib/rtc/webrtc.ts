import { MediaStream as NativeMediaStream, RTCPeerConnection } from 'react-native-webrtc';

import {
  DEFAULT_ICE_SERVERS,
  type IceServer,
  type PeerConnection,
  type Stream,
  type Track,
} from '@/lib/rtc/types';

/**
 * WebRTC on iOS and Android.
 *
 * react-native-webrtc ships its own implementations of the same objects the
 * browser has built in, so this file exists only to build them and hand them
 * over as the shared interfaces. Nothing else in the app imports the package,
 * which is what lets one console and one player run on both platforms.
 */

export function createPeerConnection(iceServers: IceServer[]): PeerConnection {
  const servers = iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS;
  const peer = new RTCPeerConnection({ iceServers: servers } as never);
  return peer as unknown as PeerConnection;
}

export function newStream(track: Track): Stream {
  return new NativeMediaStream([track as never]) as unknown as Stream;
}
