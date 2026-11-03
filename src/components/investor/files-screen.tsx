import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  MetroButton,
  MetroEmpty,
  MetroError,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroPanel,
  MetroScreen,
  useMetro,
} from '@/components/metro';
import { MetroType, Spacing } from '@/constants/metro';
import {
  investorDate,
  investorFileUrl,
  loadInvestorFiles,
  type InvestorFile,
  type InvestorTarget,
} from '@/lib/investor';
import { ActingAsNotice } from './acting-as';

/**
 * Files, as v1 lays them out.
 *
 * Documents arrive grouped by property folder, as they do on the website. Picking
 * one shows it: images render inline, everything else opens in the platform's
 * viewer through a short-lived signed URL — the app never holds a long-lived link
 * or the storage key.
 *
 * On a wide window the list and the document sit side by side (v1's two panes),
 * divided by a rule; on a phone the document opens over the list.
 *
 * `actingAs` opens the same list for an administrator previewing an investor's
 * portal, through that investor's admin endpoints.
 */
export function InvestorFiles({ actingAs }: { actingAs?: InvestorTarget }) {
  const theme = useMetro();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [files, setFiles] = useState<InvestorFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);

    loadInvestorFiles(actingAs?.userId)
      .then(setFiles)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Could not load your files'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const active = files.find((file) => file.id === activeId) ?? null;

  // One signed URL per selection; it expires in minutes, so it is never cached.
  useEffect(() => {
    if (!active) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    setUrl(null);
    setUrlError(null);
    setUrlLoading(true);

    investorFileUrl(active.id, actingAs?.userId)
      .then((signed) => {
        if (!cancelled) setUrl(signed.url);
      })
      .catch((cause) => {
        if (!cancelled) {
          setUrlError(cause instanceof Error ? cause.message : 'Could not open that file');
        }
      })
      .finally(() => {
        if (!cancelled) setUrlLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, actingAs?.userId]);

  const groups = useMemo(() => {
    const byFolder = new Map<string, InvestorFile[]>();
    for (const file of files) {
      const list = byFolder.get(file.folder) ?? [];
      list.push(file);
      byFolder.set(file.folder, list);
    }
    return [...byFolder.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [files]);

  const select = (file: InvestorFile) => setActiveId(file.id);

  const subtitle = loading
    ? undefined
    : error
      ? undefined
      : `${files.length} ${files.length === 1 ? 'document' : 'documents'} · ${
          groups.length
        } ${groups.length === 1 ? 'folder' : 'folders'}`;

  const preview = active ? (
    <FilePreview
      file={active}
      url={url}
      loading={urlLoading}
      error={urlError}
      onRetry={() => setActiveId(active.id)}
    />
  ) : (
    <View style={styles.placeholderPane}>
      <MetroEmpty
        title="No document selected"
        message="Pick a file from the list and it opens here."
      />
    </View>
  );

  const list = (
    <View style={styles.listPane}>
      {loading ? (
        <MetroLoading label="Loading your files" />
      ) : error ? (
        <MetroError message={error} onRetry={load} />
      ) : files.length === 0 ? (
        <MetroEmpty
          title="No documents yet"
          message="Documents shared with you and your properties will appear here."
        />
      ) : (
        groups.map(([folder, folderFiles]) => (
          <MetroList key={folder} title={`${folder} · ${folderFiles.length}`}>
            {folderFiles.map((file) => (
              <MetroListRow
                key={file.id}
                title={file.name}
                value={file.createdAt ? investorDate(file.createdAt) : undefined}
                onPress={() => select(file)}
              />
            ))}
          </MetroList>
        ))
      )}
    </View>
  );

  return (
    <MetroScreen
      eyebrow={actingAs ? 'Investor Portal · Preview' : 'Investor Portal'}
      title="Files"
      subtitle={subtitle}
      width="wide"
      scroll={false}
      padding="compact"
      contentStyle={{ flex: 1, gap: Spacing.three }}>
      {actingAs ? (
        <ActingAsNotice
          target={actingAs}
          actions={
            <MetroButton
              label="‹ Portfolio"
              variant="ghost"
              size="compact"
              onPress={() => router.back()}
            />
          }
        />
      ) : null}

      {wide ? (
        <View style={styles.panes}>
          <View style={[styles.listColumn, { borderRightColor: theme.border }]}>{list}</View>
          <View style={styles.previewColumn}>{preview}</View>
        </View>
      ) : (
        <View style={styles.single}>{list}</View>
      )}

      {!wide ? (
        <MetroPanel
          visible={active !== null}
          title={active?.name ?? ''}
          subtitle={active?.folder}
          onClose={() => setActiveId(null)}>
          {preview}
        </MetroPanel>
      ) : null}
    </MetroScreen>
  );
}

function FilePreview({
  file,
  url,
  loading,
  error,
  onRetry,
}: {
  file: InvestorFile;
  url: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const theme = useMetro();
  const extension = file.blobName.split('.').pop()?.toLowerCase() ?? '';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension);

  const open = () => {
    if (url) void WebBrowser.openBrowserAsync(url);
  };

  return (
    <View style={styles.preview}>
      <View style={styles.previewHeader}>
        <View style={styles.previewHeaderText}>
          <Text style={[styles.previewEyebrow, { color: theme.textDim }]}>
            {file.folder.toUpperCase()}
          </Text>
          <Text numberOfLines={2} style={[styles.previewTitle, { color: theme.text }]}>
            {file.name}
          </Text>
          {file.createdAt ? (
            <Text style={[styles.previewMeta, { color: theme.textDim }]}>
              Added {investorDate(file.createdAt)}
            </Text>
          ) : null}
        </View>
        <MetroButton label="Open" variant="ghost" onPress={open} disabled={!url || loading} />
      </View>

      {loading ? (
        <MetroLoading label="Preparing the document" />
      ) : error ? (
        <MetroError message={error} onRetry={onRetry} />
      ) : isImage && url ? (
        <View style={[styles.imageFrame, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Image
            source={{ uri: url }}
            contentFit="contain"
            style={styles.image}
            accessibilityLabel={file.name}
          />
        </View>
      ) : (
        <View style={[styles.placeholder, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.placeholderLabel, { color: theme.textDim }]}>
            {extension ? extension.toUpperCase() : 'FILE'}
          </Text>
          <Text style={[styles.placeholderText, { color: theme.text }]}>
            {extension === 'pdf'
              ? 'This PDF opens in your device viewer.'
              : 'This file opens in your device viewer.'}
          </Text>
          <MetroButton label="Open document" variant="ghost" onPress={open} disabled={!url} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panes: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.four,
  },
  listColumn: {
    width: 340,
    borderRightWidth: 1,
    paddingRight: Spacing.four,
  },
  previewColumn: {
    flex: 1,
    minWidth: 0,
  },
  single: {
    flex: 1,
  },
  listPane: {
    flex: 1,
    gap: Spacing.four,
  },
  preview: {
    flex: 1,
    gap: Spacing.three,
  },
  placeholderPane: {
    flex: 1,
    justifyContent: 'center',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  previewHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  previewEyebrow: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  previewTitle: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  previewMeta: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  imageFrame: {
    flex: 1,
    minHeight: 240,
    borderWidth: 1,
  },
  image: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
  },
  placeholderLabel: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  placeholderText: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: MetroType.body.fontWeight,
    textAlign: 'center',
  },
});
