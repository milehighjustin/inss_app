import { StyleSheet, View, type ViewStyle } from 'react-native';
import { RTCView } from 'react-native-webrtc';

import type { Stream } from '@/lib/rtc/types';

/**
 * A live WebRTC stream as a picture, native side.
 *
 * react-native-webrtc draws a stream by id (`stream.toURL()`), so this is the
 * native stand-in for the web build's `<video>` element. The surrounding `View`
 * is what the screens lay out; the picture fills it without native controls.
 */
export interface StreamViewProps {
  stream: Stream | null;
  /** Kept for the web build, where the local camera has to be muted. */
  muted?: boolean;
  /** `cover` fills the stage; `contain` shows the whole frame. */
  fit?: 'cover' | 'contain';
  /** Android stacks RTCViews by this hint; the small preview sits above. */
  zOrder?: number;
  style?: ViewStyle;
}

export function StreamView({ stream, fit = 'contain', zOrder = 0, style }: StreamViewProps) {
  const url = stream?.toURL?.() ?? null;

  return (
    <View style={[styles.frame, style]}>
      {url ? (
        <RTCView
          streamURL={url}
          objectFit={fit}
          zOrder={zOrder}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
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
