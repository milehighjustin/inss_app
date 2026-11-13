import { Image } from 'expo-image';
import { createElement } from 'react';

import type { FileKind } from '@/lib/investor';

/**
 * A document, drawn on the page — the browser has a viewer for both kinds.
 *
 * An image is an `<img>` under the hood either way; a PDF is the browser's own
 * viewer in a frame, which is the same thing a reader gets on a desktop, minus
 * the toolbar. Nothing is parsed here: the file is the signed URL's, and the
 * frame is pointed at it.
 */
export function canEmbed(kind: FileKind): boolean {
  return kind === 'image' || kind === 'pdf';
}

export function FileEmbed({ kind, url, name }: { kind: FileKind; url: string; name: string }) {
  if (kind === 'image') {
    return (
      <Image
        source={{ uri: url }}
        contentFit="contain"
        style={{ flex: 1 }}
        accessibilityLabel={name}
      />
    );
  }

  if (kind === 'pdf') {
    // A DOM element, not a React Native one: this file is only bundled for web.
    return createElement('iframe', {
      src: `${url}#view=FitH`,
      title: name,
      style: {
        border: 'none',
        width: '100%',
        height: '100%',
        minHeight: 320,
        backgroundColor: 'transparent',
      },
    });
  }

  return null;
}
