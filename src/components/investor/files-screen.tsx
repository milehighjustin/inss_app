import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  MetroBanner,
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
  fileExtension,
  fileKind,
  investorDate,
  investorFileUrl,
  loadInvestorFiles,
  type InvestorFile,
  type InvestorTarget,
} from '@/lib/investor';
import { downloadFile } from '@/lib/media/download';
import { ActingAsNotice } from './acting-as';
import { FileEmbed, canEmbed } from './file-embed';

/**
 * Files, as v1 lays them out.
 *
 * Documents arrive grouped by property folder, as they do on the website. Picking
 * one shows it: a PDF or an image is drawn on the page and can be downloaded from
 * there, and anything else — a spreadsheet, a Word file — can only be downloaded,
 * because there is nothing to draw. The preview always comes from a short-lived
 * signed URL; the app never holds a long-lived link or the storage key.
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
      {/* v1's words, exactly. */}
      <MetroEmpty title="Select a file to view" />
    </View>
  );

  const list = (
    // The page turns its own scroll off (`scroll={false}`), so the list has to
    // scroll here or every folder past the fold is unreachable.
    <ScrollView
      style={styles.listPane}
      contentContainerStyle={styles.listPaneContent}
      showsVerticalScrollIndicator>
      {/* v1's sidebar heading. */}
      <Text style={[styles.listTitle, { color: theme.text }]}>Select A File</Text>

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
          <MetroList key={folder} title={folder}>
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
    </ScrollView>
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
  const kind = fileKind(file);
  const extension = fileExtension(file);
  const embedded = canEmbed(kind);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    if (!url) return;

    setSaving(true);
    setSaveError(null);

    try {
      await downloadFile(url, file.name || `document${extension ? `.${extension}` : ''}`);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Could not download that file');
    } finally {
      setSaving(false);
    }
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
        {/* A preview can be downloaded; a file with no preview can only be. */}
        {embedded ? (
          <MetroButton
            label="Download"
            variant="ghost"
            loading={saving}
            disabled={!url || loading}
            onPress={() => void save()}
          />
        ) : null}
      </View>

      {saveError ? (
        <MetroBanner message={saveError} tone="error" onDismiss={() => setSaveError(null)} />
      ) : null}

      {loading ? (
        <MetroLoading label="Preparing the document" />
      ) : error ? (
        <MetroError message={error} onRetry={onRetry} />
      ) : embedded && url ? (
        <View style={[styles.embedFrame, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <FileEmbed kind={kind} url={url} name={file.name} />
        </View>
      ) : (
        <View style={[styles.placeholder, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.placeholderLabel, { color: theme.textDim }]}>
            {extension ? extension.toUpperCase() : 'FILE'}
          </Text>
          <Text style={[styles.placeholderText, { color: theme.text }]}>
            {kind === 'pdf'
              ? 'This PDF cannot be shown on this device. Download it to open it.'
              : 'This file cannot be shown here. Download it to open it.'}
          </Text>
          <MetroButton
            label="Download"
            variant="ghost"
            loading={saving}
            disabled={!url}
            onPress={() => void save()}
          />
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
  listTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 700,
    paddingBottom: Spacing.two,
  },
  listPane: {
    flex: 1,
  },
  listPaneContent: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
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
  embedFrame: {
    flex: 1,
    minHeight: 240,
    borderWidth: 1,
    // The PDF frame and the image both fill this, and a frame inside a flex
    // column needs its own height to resolve against.
    overflow: 'hidden',
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
