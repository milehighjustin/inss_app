import { useEventListener } from 'expo';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ScheduledMedia } from '@/lib/rtc/api';

/**
 * The kiosk's idle media, native side.
 *
 * A phone has no `<video>` element, so disagreements end in expo-video and
 * expo-audio players instead. The behaviour is the web player's: an image is
 * drawn, a video or a piece of audio plays to the end and reports itself, and
 * the player moves to the next item. Hooks cannot be conditional, so each kind
 * of item is its own component.
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
    return <VideoItem key={item.id} url={item.url} onEnded={onEnded} />;
  }

  return <AudioItem key={item.id} item={item} onEnded={onEnded} />;
}

function VideoItem({ url, onEnded }: { url: string; onEnded: () => void }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
    instance.play();
  });

  useEventListener(player, 'playToEnd', onEnded);

  return (
    <VideoView
      player={player}
      contentFit="contain"
      nativeControls={false}
      style={StyleSheet.absoluteFill}
    />
  );
}

function AudioItem({ item, onEnded }: { item: ScheduledMedia; onEnded: () => void }) {
  const player = useAudioPlayer(item.url);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    player.play();
  }, [player]);

  useEffect(() => {
    if (status.didJustFinish) onEnded();
  }, [status.didJustFinish, onEnded]);

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{item.name}</Text>
    </View>
  );
}

/**
 * The call-start tone, played once per answered call.
 *
 * The player remounts it with a new key for each call, so the tone is heard
 * again rather than being skipped as already played.
 */
export function Tone({ url }: { url: string }) {
  const player = useAudioPlayer(url);

  useEffect(() => {
    player.play();
  }, [player]);

  return null;
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
