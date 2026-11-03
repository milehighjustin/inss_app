import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { ScheduledMedia } from '@/lib/rtc/api';

/**
 * The kiosk's idle media, web side.
 *
 * A browser has `<video>` and `<audio>`, so a scheduled item is one of those
 * elements filling the screen. Images hold for their scheduled duration and the
 * player moves on; a video or a piece of audio ends and reports itself.
 */
export function MediaItem({
  item,
  onEnded,
}: {
  item: ScheduledMedia;
  onEnded: () => void;
}) {
  if (item.mediaType === 'image') {
    return (
      <Image source={{ uri: item.url }} contentFit="contain" style={StyleSheet.absoluteFill} />
    );
  }

  if (item.mediaType === 'video') {
    return (
      <video
        key={item.id}
        src={item.url}
        autoPlay
        playsInline
        onEnded={onEnded}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000',
        }}
      />
    );
  }

  return (
    <>
      <View style={styles.centered}>
        <Text style={styles.title}>{item.name}</Text>
      </View>
      <audio key={item.id} src={item.url} autoPlay onEnded={onEnded} />
    </>
  );
}

/** The call-start tone, played once per answered call. */
export function Tone({ url }: { url: string }) {
  return <audio src={url} autoPlay />;
}

const styles = StyleSheet.create({
  centered: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 600,
    textAlign: 'center',
  },
});
