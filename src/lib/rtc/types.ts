/**
 * The slice of WebRTC this app uses, described once.
 *
 * Kiosk Connect runs the same screens on a phone and in a browser, but the two
 * WebRTC implementations share no classes: the browser's are globals, the
 * native ones come from react-native-webrtc. Both are reached through these
 * interfaces (`webrtc.ts` / `webrtc.web.ts`), so a screen never has to know
 * which one it is running on.
 */

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface Track {
  kind: string;
  enabled: boolean;
  stop(): void;
  /** Set before a screen share ends, so the caller can put the camera back. */
  onended: (() => void) | null;
}

export interface Stream {
  getTracks(): Track[];
  getAudioTracks(): Track[];
  getVideoTracks(): Track[];
  /** Native streams are drawn by id; a browser stream has no such name. */
  toURL?: () => string;
}

export interface Description {
  type: string | null;
  sdp: string;
}

export interface Candidate {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface Sender {
  track: Track | null;
  replaceTrack(track: Track | null): Promise<void>;
}

export interface TrackEvent {
  track: Track;
  streams: Stream[];
}

export interface CandidateEvent {
  candidate: Candidate | null;
}

export interface PeerConnection {
  signalingState: string;
  connectionState: string | undefined;
  localDescription: Description | null;
  onicecandidate: ((event: CandidateEvent) => void) | null;
  ontrack: ((event: TrackEvent) => void) | null;
  onconnectionstatechange: (() => void) | null;
  createOffer(): Promise<Description>;
  createAnswer(): Promise<Description>;
  setLocalDescription(description: Description): Promise<void>;
  setRemoteDescription(description: Description): Promise<void>;
  addIceCandidate(candidate: Candidate): Promise<void>;
  addTrack(track: Track, stream: Stream): void;
  getSenders(): Sender[];
  close(): void;
}

/**
 * A description as plain JSON.
 *
 * The signaling server stringifies what it relays, and a native
 * `RTCSessionDescription` keeps its fields behind getters, so the screen hands
 * over `{ type, sdp }` rather than the object itself.
 */
export function plainDescription(value: Description | null): Description | null {
  if (!value) return null;
  return { type: value.type, sdp: value.sdp };
}

/** The same for an ICE candidate, whose extra native fields are not needed. */
export function plainCandidate(value: Candidate): Candidate {
  const candidate: Candidate = { candidate: value.candidate };
  if (value.sdpMid !== undefined) candidate.sdpMid = value.sdpMid;
  if (value.sdpMLineIndex !== undefined) candidate.sdpMLineIndex = value.sdpMLineIndex;
  if (value.usernameFragment !== undefined) candidate.usernameFragment = value.usernameFragment;
  return candidate;
}

/** The STUN fallback both ends use when the API sends no ICE servers. */
export const DEFAULT_ICE_SERVERS: IceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
