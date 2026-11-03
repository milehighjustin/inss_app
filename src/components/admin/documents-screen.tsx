import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroDialog,
  MetroEmpty,
  MetroError,
  MetroField,
  MetroFileField,
  MetroFigures,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroPanel,
  MetroRadioGroup,
  MetroSection,
  MetroSelect,
  MetroTextArea,
  MetroToggle,
  type MetroFigure,
} from '@/components/metro';
import { useMetro } from '@/components/metro/use-metro';
import { Spacing } from '@/constants/metro';
import {
  AUDIENCE_OPTIONS,
  DOCUMENT_MIME_TYPES,
  countDocumentAudience,
  deleteDocument,
  documentUrl,
  formatBytes,
  formatDate,
  listDocuments,
  uploadDocument,
  type AdminDocument,
  type DocumentAudience,
  type DocumentUploadResult,
} from '@/lib/admin/documents';
import {
  channelSummary,
  failureReason,
  type NotificationPriority,
} from '@/lib/admin/notifications';
import { listInvestors, type AdminInvestor } from '@/lib/admin/investors';
import { listLocations, type AdminLocation } from '@/lib/admin/locations';
import { pickFile } from '@/lib/media/pick-file';
import type { PickedFile } from '@/lib/media/upload';
import { AdminToolbar } from './admin-toolbar';

/**
 * Investor Portal → Documents.
 *
 * v1's panel: every file the portal shares, with who it is for, and one upload
 * form that asks the same three questions — audience, folder and name. The bytes
 * go from the device to Azure with a write-only SAS; the API only records the
 * file once it can see them.
 */
export function DocumentsAdmin() {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [investors, setInvestors] = useState<AdminInvestor[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AdminDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [files, people, properties] = await Promise.all([
        listDocuments(),
        listInvestors(),
        listLocations(),
      ]);
      setDocuments(files);
      setInvestors(people);
      setLocations(properties);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const investorName = (id: string | null) =>
    id ? (investors.find((investor) => investor.userId === id)?.name ?? 'Unknown investor') : '';

  const locationName = (id: string | null) =>
    id
      ? (locations.find((location) => location.id === id)?.departmentName ??
        locations.find((location) => location.id === id)?.name ??
        'Unknown property')
      : '';

  const audienceLabel = (document: AdminDocument) => {
    if (document.audience === 'allInvestors') return 'All investors';
    if (document.audience === 'investor') return investorName(document.investorId) || 'One investor';
    return locationName(document.locationId) || 'One property';
  };

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return documents;
    return documents.filter((document) =>
      `${document.name} ${document.folder} ${audienceLabel(document)}`.toLowerCase().includes(clean),
    );
    // `audienceLabel` reads the two lists above, so they are part of the filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, query, investors, locations]);

  // What the library is, before the list of it: how much is shared, and across
  // how many folders.
  const figures: MetroFigure[] = [
    { label: 'Documents', value: String(documents.length) },
    {
      label: 'Library size',
      value: formatBytes(documents.reduce((sum, document) => sum + (document.size ?? 0), 0)),
    },
    {
      label: 'Folders',
      value: String(new Set(documents.map((document) => document.folder)).size),
    },
  ];

  const open = async (document: AdminDocument) => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await documentUrl(document.id);
      await Linking.openURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That document could not be opened');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await deleteDocument(removing.id);
      setDocuments((rows) => rows.filter((row) => row.id !== removing.id));
      setRemoving(null);
      setNotice('Document deleted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That document could not be deleted');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.body}>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? <MetroBanner tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      <AdminToolbar
        count={`${visible.length} of ${documents.length}`}
        actions={
          <>
            <MetroButton label="Refresh" variant="ghost" onPress={() => void load()} />
            <MetroButton label="Add document" onPress={() => setAdding(true)} />
          </>
        }>
        <View style={styles.search}>
          <MetroField
            label="Search documents"
            hideLabel
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, folder or investor"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </AdminToolbar>

      {loading ? null : <MetroFigures figures={figures} size="medium" />}

      {loading ? (
        <MetroLoading label="Loading documents" />
      ) : visible.length === 0 ? (
        <MetroEmpty
          title="No documents"
          message={
            query
              ? `Nothing matches “${query}”.`
              : 'Upload a file and every investor it is meant for will see it in their Files tab.'
          }
          action={<MetroButton label="Add document" onPress={() => setAdding(true)} />}
        />
      ) : (
        <MetroList>
          {visible.map((document) => (
            <MetroListRow
              key={document.id}
              title={document.name}
              subtitle={[
                document.folder,
                audienceLabel(document),
                formatDate(document.createdAt),
                formatBytes(document.size),
              ]
                .filter(Boolean)
                .join(' · ')}
              accessory={
                <View style={styles.rowActions}>
                  <MetroButton
                    label="Open"
                    variant="ghost"
                    size="compact"
                    disabled={busy}
                    onPress={() => void open(document)}
                  />
                  <MetroButton
                    label="Delete"
                    variant="ghost"
                    size="compact"
                    color="danger"
                    disabled={busy}
                    onPress={() => setRemoving(document)}
                  />
                </View>
              }
            />
          ))}
        </MetroList>
      )}

      {adding ? (
        <UploadPanel
          investors={investors}
          locations={locations}
          onClose={() => setAdding(false)}
          onUploaded={(result) => {
            setAdding(false);
            setDocuments((rows) => [result.document, ...rows]);
            setNotice(uploadNotice(result));
          }}
        />
      ) : null}

      <MetroDialog
        visible={removing !== null}
        title="Delete this document?"
        message={
          removing
            ? `“${removing.name}” is removed for everyone it was shared with.`
            : undefined
        }
        onClose={() => setRemoving(null)}
        actions={[
          { label: 'Delete', destructive: true, loading: busy, onPress: () => void remove() },
          { label: 'Keep', variant: 'ghost', onPress: () => setRemoving(null) },
        ]}
      />
    </View>
  );
}

function UploadPanel({
  investors,
  locations,
  onClose,
  onUploaded,
}: {
  investors: AdminInvestor[];
  locations: AdminLocation[];
  onClose: () => void;
  onUploaded: (result: DocumentUploadResult) => void;
}) {
  const theme = useMetro();
  const [audience, setAudience] = useState<DocumentAudience>('allInvestors');
  const [investorId, setInvestorId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [folder, setFolder] = useState('');
  const [name, setName] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The alert is decided per upload, not per file type: a routine re-filing goes
  // out silently, a statement someone is waiting for does not.
  const [notify, setNotify] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [notifyPriority, setNotifyPriority] = useState<NotificationPriority>('quiet');
  const [audienceCount, setAudienceCount] = useState<number | null>(null);

  // How many investors this file is for. It is the audience the notification
  // would go to, so the form can name a number before anyone saves.
  useEffect(() => {
    let live = true;

    if (
      (audience === 'investor' && !investorId) ||
      (audience === 'locationSpecific' && !locationId)
    ) {
      setAudienceCount(null);
      return;
    }

    countDocumentAudience({ audience, investorId, locationId })
      .then((count) => {
        if (live) setAudienceCount(count);
      })
      .catch(() => {
        if (live) setAudienceCount(null);
      });

    return () => {
      live = false;
    };
  }, [audience, investorId, locationId]);

  const toggleNotify = (next: boolean) => {
    setNotify(next);
    if (!next) return;

    // A starting sentence that says the thing, ready to be rewritten.
    const what = name.trim() || 'A new file';
    if (!notifyTitle.trim()) setNotifyTitle(`New document: ${name.trim() || 'a file'}`);
    if (!notifyBody.trim()) setNotifyBody(`${what} is now in your Files.`);
  };

  const choose = async () => {
    setError(null);
    try {
      const picked = await pickFile(DOCUMENT_MIME_TYPES);
      if (!picked) return;
      setFile(picked);
      if (!name.trim()) setName(picked.name.replace(/\.[^.]+$/, ''));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That file could not be read');
    }
  };

  const submit = async () => {
    if (!file) {
      setError('Choose a file first.');
      return;
    }
    if (name.trim().length < 4) {
      setError('Give the file a name of at least four characters.');
      return;
    }
    if (audience === 'investor' && !investorId) {
      setError('Choose the investor this file is for.');
      return;
    }
    if (audience === 'locationSpecific' && !locationId) {
      setError('Choose the property this file is for.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      onUploaded(
        await uploadDocument(file, {
          name: name.trim(),
          audience,
          ...(audience === 'investor'
            ? { investorId, ...(folder.trim() ? { folderName: folder.trim() } : {}) }
            : {}),
          ...(audience === 'locationSpecific' ? { locationId } : {}),
          ...(notify
            ? {
                notify: {
                  title: notifyTitle.trim() || `New document: ${name.trim()}`,
                  body: notifyBody.trim(),
                  priority: notifyPriority,
                },
              }
            : {}),
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The file could not be uploaded');
    } finally {
      setUploading(false);
    }
  };

  return (
    <MetroPanel visible title="Add document" subtitle="One file, for the people who should see it." onClose={onClose}>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      <MetroSection title="File" hint="PDF, image, Office document or CSV, up to 50 MB.">
        <MetroFileField
          label="Document"
          onPick={() => void choose()}
          files={file ? [{ uri: file.uri, name: file.name, size: file.size, mimeType: file.type }] : []}
          onRemove={() => setFile(null)}
          busy={uploading}
          emptyLabel="Choose a file"
          hint="The upload starts when you save, and the bytes go straight to storage."
        />
      </MetroSection>

      <MetroSection title="Name" hint="How the file reads in the investor's Files tab.">
        <MetroField
          label="Document name"
          value={name}
          onChangeText={setName}
          placeholder="2026 Q3 distribution statement"
        />
      </MetroSection>

      <MetroSection title="Audience" hint="Who may see it.">
        <MetroRadioGroup
          options={AUDIENCE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          value={audience}
          onChange={(value) => setAudience(value as DocumentAudience)}
          disabled={uploading}
        />

        {audience === 'investor' ? (
          <>
            <MetroSelect
              label="Investor"
              options={investors.map((investor) => ({
                value: investor.userId,
                label: investor.name,
              }))}
              value={investorId}
              placeholder="Choose an investor"
              onChange={setInvestorId}
              disabled={uploading}
            />
            <MetroField
              label="Folder (optional)"
              value={folder}
              onChangeText={setFolder}
              placeholder="Files"
              hint="Leave empty to file it under Files."
              autoCapitalize="none"
            />
          </>
        ) : null}

        {audience === 'locationSpecific' ? (
          <MetroSelect
            label="Property"
            options={locations.map((location) => ({
              value: location.id,
              label: location.departmentName || location.name || 'Unnamed property',
            }))}
            value={locationId}
            placeholder="Choose a property"
            onChange={setLocationId}
            disabled={uploading}
          />
        ) : null}
      </MetroSection>

      <MetroSection
        title="Tell the investors"
        hint="The people who can see this file can be told it was posted.">
        <MetroToggle
          label="Send a notification"
          description={
            audienceCount === null
              ? 'Choose who may see this file and they are the ones told.'
              : `The ${audienceCount} investor${audienceCount === 1 ? '' : 's'} who can see this file.`
          }
          value={notify}
          onChange={toggleNotify}
          disabled={uploading}
        />

        {notify ? (
          <>
            <MetroField
              label="Title"
              value={notifyTitle}
              onChangeText={setNotifyTitle}
              placeholder="New document: 2026 Q3 distribution statement"
              maxLength={120}
            />
            <MetroTextArea
              label="Message"
              value={notifyBody}
              onChangeText={setNotifyBody}
              rows={2}
              placeholder="It is in your Files tab now."
              maxLength={300}
            />
            <MetroRadioGroup
              label="Delivery"
              value={notifyPriority}
              onChange={(value) => setNotifyPriority(value === 'loud' ? 'loud' : 'quiet')}
              disabled={uploading}
              options={[
                {
                  value: 'quiet',
                  label: 'Quiet',
                  description: 'Arrives silently, there when they look.',
                },
                {
                  value: 'loud',
                  label: 'Loud',
                  description: 'Makes a sound — for a statement that cannot wait.',
                },
              ]}
            />
            <Text style={[styles.value, { color: theme.textDim }]}>
              This reaches the investors who have turned notifications on; everyone else still finds the
              file in Files.
            </Text>
          </>
        ) : null}
      </MetroSection>

      <View style={styles.actions}>
        <MetroButton label="Upload" loading={uploading} onPress={() => void submit()} />
        <Text style={[styles.value, { color: theme.textDim }]}>
          Nothing is recorded unless the whole file arrives.
        </Text>
      </View>
    </MetroPanel>
  );
}

/**
 * What to say after a post.
 *
 * The document is the fact; whether anyone was told is the interesting part, and
 * an alert that did not arrive says why instead of leaving the uploader to
 * wonder whether it went out.
 */
function uploadNotice(result: DocumentUploadResult): string {
  const name = `“${result.document.name}”`;
  const notification = result.notification;

  if (!notification) return `${name} uploaded.`;

  const told = notification.recipients.length;
  if (told === 0) return `${name} uploaded. Nobody is in its audience, so nobody was told.`;

  const people = `${told} investor${told === 1 ? '' : 's'}`;

  if (notification.status === 'delivered') {
    return `${name} uploaded and ${people} told — ${channelSummary(notification.sends)} accepted it.`;
  }

  if (notification.status === 'failed') {
    return `${name} uploaded, but the alert did not arrive: ${
      failureReason(notification) ?? notification.note ?? 'no device could be reached.'
    }`;
  }

  // Still waiting on a device: say who it was addressed to, and what delivery
  // itself had to say, rather than implying it arrived.
  return `${name} uploaded and ${people} told.${notification.note ? ` ${notification.note}` : ''}`;
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  search: {
    flex: 1,
    // A phone wraps the rest of the toolbar under it rather than squeezing the field away.
    minWidth: 220,
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  actions: {
    gap: Spacing.two,
  },
  value: {
    fontSize: 13,
  },
});
