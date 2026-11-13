import { Image } from 'expo-image';

import type { FileKind } from '@/lib/investor';

/**
 * A document, drawn on the page.
 *
 * Images are the one thing a phone can draw itself, so this is where it stops:
 * a PDF or anything else has no renderer in the app, and pretending otherwise
 * would mean a blank frame. `canEmbed` is what the screen asks before it offers
 * the preview at all, so the fallback is never a surprise.
 */
export function canEmbed(kind: FileKind): boolean {
  return kind === 'image';
}

export function FileEmbed({ kind, url, name }: { kind: FileKind; url: string; name: string }) {
  if (kind !== 'image') return null;

  return (
    <Image
      source={{ uri: url }}
      contentFit="contain"
      style={{ flex: 1 }}
      accessibilityLabel={name}
    />
  );
}
