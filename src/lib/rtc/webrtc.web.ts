import {
  DEFAULT_ICE_SERVERS,
  type IceServer,
  type PeerConnection,
  type Stream,
  type Track,
} from '@/lib/rtc/types';

/**
 * WebRTC in a browser, where every object is already a global.
 *
 * The casts are the seam: the browser's classes are structurally the same as
 * the shared interfaces, but their event types name DOM classes the native side
 * has never heard of, so the shared code is not allowed to see them.
 */

export function createPeerConnection(iceServers: IceServer[]): PeerConnection {
  const servers = iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS;
  const peer = new RTCPeerConnection({ iceServers: servers as RTCIceServer[] });
  return peer as unknown as PeerConnection;
}

export function newStream(track: Track): Stream {
  return new MediaStream([track as unknown as MediaStreamTrack]) as unknown as Stream;
}
