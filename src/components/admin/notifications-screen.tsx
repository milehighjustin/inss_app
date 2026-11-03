import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroBadge,
  MetroButton,
  MetroCheckbox,
  MetroError,
  MetroField,
  MetroFigures,
  MetroLoading,
  MetroPivot,
  MetroRadioGroup,
  MetroScreen,
  MetroSection,
  MetroSheet,
  MetroTextArea,
  MetroToggle,
  type MetroFigure,
} from '@/components/metro';
import { useMetro } from '@/components/metro/use-metro';
import { MetroType, Spacing } from '@/constants/metro';
import {
  channelSummary,
  createNotificationTag,
  deleteNotificationTag,
  failureReason,
  listNotificationTags,
  listNotifications,
  previewAudience,
  sendNotification,
  statusLabel,
  updateNotificationTag,
  type NotificationAudience,
  type NotificationPriority,
  type NotificationRecord,
  type NotificationTag,
} from '@/lib/admin/notifications';
import { AdminPivot } from './admin-pivot';

/**
 * Admin → Notifications.
 *
 * Two halves of the same idea. **Tags** is the vocabulary: who hears about what,
 * created and turned off here, with the counts that show whether anyone is
 * actually in an audience. **Send** is the way to say something to a tag without
 * tying it to a printed sign — and the log underneath every send, because an
 * alert nobody received should say why.
 *
 * A tag still in use cannot be deleted: it is turned off, which hides it from
 * every picker while the accounts and codes that reference it keep working.
 */
export function NotificationsAdmin() {
  const theme = useMetro();
  const [tab, setTab] = useState<'tags' | 'send'>('tags');

  const [tags, setTags] = useState<NotificationTag[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTags, nextLog] = await Promise.all([listNotificationTags(), listNotifications(25)]);
      setTags(nextTags);
      setNotifications(nextLog);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const figures: MetroFigure[] = [
    { label: 'Tags', value: String(tags.length) },
    { label: 'Active', value: String(tags.filter((tag) => tag.active !== false).length) },
    {
      label: 'People covered',
      value: String(tags.reduce((total, tag) => total + (tag.users ?? 0), 0)),
      hint: 'Assignments, so one person on three tags counts three times',
    },
  ];

  return (
    <MetroScreen
      eyebrow="Admin"
      title="Notifications"
      subtitle="Who hears about what, and what has been sent."
      width="wide">
      <AdminPivot />

      {notice ? (
        <MetroBanner tone="success" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}
      {error ? <MetroError message={error} onRetry={() => void load()} /> : null}

      <MetroFigures figures={figures} />

      <MetroPivot
        tabs={[
          { value: 'tags', label: 'Tags' },
          { value: 'send', label: 'Send' },
        ]}
        value={tab}
        onChange={(value) => setTab(value === 'send' ? 'send' : 'tags')}
      />

      {loading && tags.length === 0 ? (
        <MetroLoading label="Loading tags…" />
      ) : tab === 'tags' ? (
        <TagsPanel
          tags={tags}
          onReload={load}
          onNotice={setNotice}
          onError={setError}
        />
      ) : (
        <SendPanel
          tags={tags}
          notifications={notifications}
          onSent={(record) => {
            setNotifications((rows) => [record, ...rows]);
            setNotice(`Sent to ${record.tags.join(', ')}. ${channelSummary(record.sends)} accepted it.`);
          }}
          onError={setError}
        />
      )}

      <Text style={[styles.footnote, { color: theme.textDim }]}>
        A send goes to every device the tagged accounts have turned alerts on: browsers directly,
        phones through Azure Notification Hubs.
      </Text>
    </MetroScreen>
  );
}

/** The registry: create, rename, describe, turn off, remove. */
function TagsPanel({
  tags,
  onReload,
  onNotice,
  onError,
}: {
  tags: NotificationTag[];
  onReload: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string | null) => void;
}) {
  const theme = useMetro();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<NotificationTag | null>(null);

  const add = async () => {
    if (!label.trim()) {
      onError('Give the tag a name.');
      return;
    }

    setSaving(true);
    onError(null);
    try {
      const tag = await createNotificationTag({ label, description });
      setLabel('');
      setDescription('');
      onNotice(`Added “${tag.label}”. Assign it to people in Users, or to a QR code.`);
      await onReload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'The tag could not be saved');
    } finally {
      setSaving(false);
    }
  };

  // With an empty registry there is nothing to show above the form, so the form
  // is the screen: a first run should read as "name your first tag", not as a
  // list that is missing.
  const empty = tags.length === 0;

  const addForm = (
    <MetroSection
      title={empty ? 'Name your first tag' : 'Add a tag'}
      hint="A word staff would use, not a person's name.">
      <MetroField
        label="Name"
        value={label}
        onChangeText={setLabel}
        placeholder="Accounting"
        maxLength={40}
      />
      <MetroField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Rent, payments and receivables"
        maxLength={160}
      />
      <View>
        <MetroButton label="Add tag" loading={saving} onPress={() => void add()} />
      </View>
    </MetroSection>
  );

  return (
    <>
      {empty ? (
        <>
          <Text style={[styles.empty, { color: theme.textDim }]}>
            Nothing is predefined. Tags are yours to name: create the ones your staff would
            recognise, then assign them to people in Users and to signs in QR Codes.
          </Text>
          {addForm}
        </>
      ) : (
        <MetroSection title="The registry" hint="Rename here and every picker follows.">
          <View>
            {tags.map((tag, index) => {
              const active = tag.active !== false;
              return (
                <View
                  key={tag.slug}
                  style={[
                    styles.row,
                    index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                  ]}>
                  <View style={styles.rowText}>
                    <View style={styles.rowTitle}>
                      <Text style={[styles.name, { color: theme.text }]}>{tag.label}</Text>
                      {active ? null : <MetroBadge label="Off" />}
                    </View>
                    <Text style={[styles.meta, { color: theme.textDim }]}>
                      {tag.slug} · {tag.users ?? 0} {tag.users === 1 ? 'person' : 'people'} ·{' '}
                      {tag.codes ?? 0} {tag.codes === 1 ? 'code' : 'codes'}
                    </Text>
                    {tag.description ? (
                      <Text style={[styles.meta, { color: theme.textDim }]}>{tag.description}</Text>
                    ) : null}
                  </View>

                  <MetroButton
                    label="Edit"
                    variant="ghost"
                    size="compact"
                    onPress={() => setEditing(tag)}
                  />
                </View>
              );
            })}
          </View>
        </MetroSection>
      )}

      {empty ? null : addForm}

      <EditTagSheet
        tag={editing}
        onClose={() => setEditing(null)}
        onSaved={async (message) => {
          setEditing(null);
          onNotice(message);
          await onReload();
        }}
        onError={onError}
        onDeleted={async (message) => {
          setEditing(null);
          onNotice(message);
          await onReload();
        }}
      />
    </>
  );
}

/** Renaming, describing, turning off — and deleting when nothing uses it. */
function EditTagSheet({
  tag,
  onClose,
  onSaved,
  onDeleted,
  onError,
}: {
  tag: NotificationTag | null;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  onDeleted: (message: string) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const theme = useMetro();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLabel(tag?.label ?? '');
    setDescription(tag?.description ?? '');
    setActive(tag?.active !== false);
  }, [tag]);

  if (!tag) return null;

  const inUse = (tag.users ?? 0) > 0 || (tag.codes ?? 0) > 0;

  const save = async () => {
    setBusy(true);
    onError(null);
    try {
      await updateNotificationTag(tag.slug, { label, description, active });
      await onSaved(`Saved “${label}”.`);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'That could not be saved');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    onError(null);
    try {
      await deleteNotificationTag(tag.slug);
      await onDeleted(`Deleted “${tag.label}”.`);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'That could not be deleted');
      setBusy(false);
    }
  };

  return (
    <MetroSheet
      visible
      title={tag.label}
      description={`${tag.slug} · ${tag.users ?? 0} ${tag.users === 1 ? 'person' : 'people'} · ${tag.codes ?? 0} ${tag.codes === 1 ? 'code' : 'codes'}`}
      onClose={onClose}
      actions={<MetroButton label="Save" loading={busy} onPress={() => void save()} />}>
      <MetroField label="Name" value={label} onChangeText={setLabel} maxLength={40} />
      <MetroField
        label="Description"
        value={description}
        onChangeText={setDescription}
        maxLength={160}
      />

      <MetroToggle
        label="In use"
        description="Turning a tag off hides it from every picker. Accounts and codes that already use it keep working."
        value={active}
        onChange={setActive}
      />

      <View>
        <MetroButton
          label={inUse ? 'In use — turn it off instead' : 'Delete tag'}
          variant="ghost"
          disabled={inUse || busy}
          onPress={() => void remove()}
        />
      </View>

      {inUse ? (
        <Text style={[styles.empty, { color: theme.textDim }]}>
          This tag is on {tag.users ?? 0} account(s) and {tag.codes ?? 0} code(s), so deleting it
          would leave them pointing at nothing.
        </Text>
      ) : null}
    </MetroSheet>
  );
}

/** A message sent by hand, and the log of everything sent lately. */
function SendPanel({
  tags,
  notifications,
  onSent,
  onError,
}: {
  tags: NotificationTag[];
  notifications: NotificationRecord[];
  onSent: (record: NotificationRecord) => void;
  onError: (message: string | null) => void;
}) {
  const theme = useMetro();
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<NotificationPriority>('quiet');
  const [audience, setAudience] = useState<NotificationAudience | null>(null);
  const [sending, setSending] = useState(false);

  const active = useMemo(() => tags.filter((tag) => tag.active !== false), [tags]);

  useEffect(() => {
    let live = true;
    if (selected.length === 0) {
      setAudience(null);
      return;
    }

    previewAudience(selected)
      .then((next) => {
        if (live) setAudience(next);
      })
      .catch(() => {
        if (live) setAudience(null);
      });

    return () => {
      live = false;
    };
  }, [selected]);

  const toggle = (slug: string) => {
    setSelected((current) =>
      current.includes(slug) ? current.filter((entry) => entry !== slug) : [...current, slug],
    );
  };

  const send = async () => {
    if (selected.length === 0) {
      onError('Choose at least one tag.');
      return;
    }
    if (!title.trim()) {
      onError('Give the notification a title.');
      return;
    }

    setSending(true);
    onError(null);
    try {
      const record = await sendNotification({
        tags: selected,
        title: title.trim(),
        body: body.trim(),
        priority,
      });
      onSent(record);
      setTitle('');
      setBody('');
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'The notification could not be sent');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <MetroSection title="Who" hint="Anyone carrying one of these tags is told.">
        {active.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textDim }]}>
            There are no active tags to send to yet.
          </Text>
        ) : (
          <View>
            {active.map((tag) => (
              <MetroCheckbox
                key={tag.slug}
                label={tag.label}
                description={`${tag.users ?? 0} ${tag.users === 1 ? 'person' : 'people'}`}
                checked={selected.includes(tag.slug)}
                onChange={() => toggle(tag.slug)}
              />
            ))}
          </View>
        )}

        {audience ? (
          <Text style={[styles.meta, { color: theme.textDim }]}>
            {audience.users} {audience.users === 1 ? 'account' : 'accounts'} ·{' '}
            {audience.devices} {audience.devices === 1 ? 'phone' : 'phones'} registered
          </Text>
        ) : null}
      </MetroSection>

      <MetroSection title="What">
        <MetroField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Closing early today"
          maxLength={120}
        />
        <MetroTextArea
          label="Message"
          value={body}
          onChangeText={setBody}
          rows={3}
          placeholder="Maple Street closes at 3pm for maintenance."
          maxLength={400}
        />

        <MetroRadioGroup
          label="Delivery"
          value={priority}
          onChange={(value) => setPriority(value === 'loud' ? 'loud' : 'quiet')}
          options={[
            {
              value: 'quiet',
              label: 'Quiet',
              description: 'Arrives silently. Worth knowing about, not an emergency.',
            },
            {
              value: 'loud',
              label: 'Loud',
              description: 'Interrupts with a sound. For something that cannot wait.',
            },
          ]}
        />

        <View>
          <MetroButton
            label={selected.length > 0 ? `Send to ${selected.length} tag(s)` : 'Send'}
            loading={sending}
            disabled={sending || selected.length === 0}
            onPress={() => void send()}
          />
        </View>
      </MetroSection>

      <MetroSection title="Recent" hint="Newest first. A row that failed says why.">
        {notifications.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textDim }]}>
            Nothing has been sent yet — by hand or by a QR code.
          </Text>
        ) : (
          <ScrollView style={styles.log} nestedScrollEnabled>
            {notifications.map((record) => (
              <View
                key={record._id}
                style={[styles.logRow, { borderBottomColor: theme.border }]}>
                <View style={styles.rowTitle}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                    {record.title}
                  </Text>
                  <MetroBadge label={statusLabel(record)} />
                </View>
                <Text style={[styles.meta, { color: theme.textDim }]} numberOfLines={1}>
                  {when(record.createdAt)} · {record.kind === 'qr-scan' ? 'QR scan' : 'By hand'} ·{' '}
                  {record.tags.length > 0 ? record.tags.join(', ') : `${record.recipients.length} people`}
                </Text>
                <Text style={[styles.meta, { color: theme.textDim }]} numberOfLines={2}>
                  {record.status === 'delivered'
                    ? `Reached ${channelSummary(record.sends)}.`
                    : (failureReason(record) ?? record.note ?? 'Not delivered yet.')}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </MetroSection>
    </>
  );
}

/** A short, unambiguous timestamp: "31 Oct, 14:05". */
function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: 600,
  },
  meta: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  empty: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  log: {
    maxHeight: 360,
  },
  logRow: {
    gap: 2,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  footnote: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
});
