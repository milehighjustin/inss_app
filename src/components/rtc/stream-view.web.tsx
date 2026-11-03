import { useEffect, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * A live WebRTC stream as a picture, web side.
 *
 * A browser already has a video element, so the native build's RTCView is not
 * involved: the wrapper is a normal `View` the screens lay out, and the
 * `<video>` fills it without browser chrome.
 */
export interface StreamViewProps {
  stream: MediaStream | null;
  /** The local camera must be muted or the room echoes. */
  muted?: boolean;
  /** `cover` fills the stage; `contain` shows the whole frame. */
  fit?: 'cover' | 'contain';
  /** Android-only stacking hint on the native build; a browser ignores it. */
  zOrder?: number;
  style?: ViewStyle;
}

export function StreamView({ stream, muted = true, fit = 'contain', style }: StreamViewProps) {
  const element = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = element.current;
    if (!video) return;

    if (video.srcObject !== stream) video.srcObject = stream;
    if (stream) void video.play().catch(() => undefined);

    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  return (
    <View style={[styles.frame, style]}>
      <video
        ref={element}
        autoPlay
        playsInline
        muted={muted}
        style={{ width: '100%', height: '100%', objectFit: fit, backgroundColor: '#000' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
});
