import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroCheckbox,
  MetroField,
  MetroLabel,
  MetroRadioGroup,
  MetroSection,
  MetroSheet,
  MetroTextArea,
} from '@/components/metro';
import { useMetro } from '@/components/metro/use-metro';
import { Spacing } from '@/constants/metro';
import {
  listNotificationTags,
  type NotificationTag,
} from '@/lib/admin/notifications';
import {
  updateQrCode,
  type QrCode,
  type QrNotificationPriority,
} from '@/lib/admin/qr-codes';
import { displayName, listUsers, roleLabel, type AdminUser } from '@/lib/admin/users';

/**
 * Admin → QR Codes → Notification tags.
 *
 * Choosing tags *is* how a code starts notifying: there is no separate on/off
 * switch, because a switch next to an audience is two answers to one question —
 * the stored flag could say "yes" while pointing at nobody. No tags means the
 * code only redirects, and the section says so instead of leaving it ambiguous.
 *
 * Tags rather than people, because a sign is printed for years and the person who
 * answers it changes — an administrator moves the tag, and every printed copy of
 * the code follows without being reprinted.
 *
 * Codes configured before tags keep their named people. Those still work, shown
 * separately so it is obvious what is legacy and what is a tag, and they can be
 * dropped once the code has been given tags.
 */
export function QrNotifySection({
  code,
  onChange,
  onNotice,
}: {
  code: QrCode;
  onChange: (code: QrCode) => void;
  onNotice: (message: string) => void;
}) {
  const [title, setTitle] = useState(code.notification.title);
  const [body, setBody] = useState(code.notification.body);
  const [priority, setPriority] = useState<QrNotificationPriority>(code.notification.priority);
  const [tags, setTags] = useState<string[]>(code.notifyTags);
  const [legacy, setLegacy] = useState<string[]>(code.notifyUserIds);

  const theme = useMetro();
  const [registry, setRegistry] = useState<NotificationTag[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listNotificationTags().catch(() => [] as NotificationTag[]),
      listUsers().catch(() => [] as AdminUser[]),
    ]).then(([nextTags, nextUsers]) => {
      if (cancelled) return;
      setRegistry(nextTags);
      setUsers(nextUsers.filter((user) => user.active));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Active tags, plus any this code already uses so they can be taken off. */
  const choices = useMemo(
    () => registry.filter((tag) => tag.active !== false || tags.includes(tag.slug)),
    [registry, tags],
  );

  const chosenPeople = useMemo(
    () => users.filter((user) => legacy.includes(user.userId)),
    [users, legacy],
  );

  const audience = useMemo(() => {
    const parts: string[] = [];
    if (tags.length > 0) parts.push(tags.join(', '));
    if (legacy.length > 0) {
      const names =
        chosenPeople.length > 0
          ? chosenPeople.map((user) => displayName(user)).join(', ')
          : `${legacy.length} ${legacy.length === 1 ? 'person' : 'people'}`;
      parts.push(names);
    }
    return parts.length > 0 ? parts.join(' · ') : 'Nobody yet';
  }, [tags, legacy, chosenPeople]);

  /** True the moment a tag or a legacy person is on the code. */
  const notifying = tags.length + legacy.length > 0;

  const dirty =
    title.trim() !== code.notification.title ||
    body.trim() !== code.notification.body ||
    priority !== code.notification.priority ||
    tags.length !== code.notifyTags.length ||
    tags.some((slug) => !code.notifyTags.includes(slug)) ||
    legacy.length !== code.notifyUserIds.length ||
    legacy.some((id) => !code.notifyUserIds.includes(id));

  const toggleTag = (slug: string) => {
    setTags((current) =>
      current.includes(slug) ? current.filter((entry) => entry !== slug) : [...current, slug],
    );
  };

  const save = async () => {
    if (notifying && !title.trim()) {
      setError('Give the notification a title before choosing who it tells.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateQrCode(code.id, {
        notifyTags: tags,
        notifyUserIds: legacy,
        notification: { title: title.trim(), body: body.trim(), priority },
      });
      onChange(updated);
      onNotice(
        notifying
          ? `“${code.name}” will notify ${audience.toLowerCase()} when it is scanned.`
          : `“${code.name}” will not notify anyone.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The notification could not be saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MetroSection
      title="Notification tags"
      hint="Pick the tags told when this code is scanned. With none chosen it only redirects.">
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      <View style={styles.people}>
        <MetroLabel>Who gets it</MetroLabel>
        <Text style={[styles.summary, { color: theme.textDim }]}>{audience}</Text>

        {loading ? (
          <Text style={[styles.summary, { color: theme.textDim }]}>Loading tags…</Text>
        ) : choices.length === 0 ? (
          <Text style={[styles.summary, { color: theme.textDim }]}>
            No tags exist yet. Add them in Admin → Notifications.
          </Text>
        ) : (
          <View>
            {choices.map((tag) => (
              <MetroCheckbox
                key={tag.slug}
                label={tag.label}
                description={
                  tag.active === false
                    ? 'Turned off — still attached to this code'
                    : tag.description || tag.slug
                }
                checked={tags.includes(tag.slug)}
                onChange={() => toggleTag(tag.slug)}
              />
            ))}
          </View>
        )}
      </View>

      {notifying ? (
        <>
          <MetroField
            label="Notification title"
            value={title}
            onChangeText={setTitle}
            placeholder="Maple Street front gate"
            maxLength={120}
          />
          <MetroTextArea
            label="Message"
            value={body}
            onChangeText={setBody}
            rows={3}
            placeholder="Someone is at the front gate and scanned the code."
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
                description:
                  'Interrupts with a sound. For a code people only scan when they need help.',
              },
            ]}
          />

          {legacy.length > 0 ? (
            <View style={styles.people}>
              <MetroLabel>Named people, from before tags</MetroLabel>
              <Text style={[styles.summary, { color: theme.textDim }]}>
                These still work alongside the tags. Once the tags cover them, remove them.
              </Text>
              <View style={styles.actions}>
                <MetroButton
                  label="Change people"
                  variant="ghost"
                  size="compact"
                  onPress={() => setPicking(true)}
                />
                <MetroButton
                  label="Remove them"
                  variant="ghost"
                  size="compact"
                  onPress={() => setLegacy([])}
                />
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={[styles.summary, { color: theme.textDim }]}>
          Nobody is told when this code is scanned. Choose a tag above and this becomes an alert.
        </Text>
      )}

      <View>
        <MetroButton
          label="Save notification"
          loading={saving}
          disabled={!dirty || saving}
          onPress={() => void save()}
        />
      </View>

      <RecipientSheet
        visible={picking}
        users={users}
        loading={loading}
        selected={legacy}
        onToggle={(userId) =>
          setLegacy((current) =>
            current.includes(userId)
              ? current.filter((id) => id !== userId)
              : [...current, userId],
          )
        }
        onClose={() => setPicking(false)}
      />
    </MetroSection>
  );
}

/** Named recipients, for codes that still have them: every active account. */
function RecipientSheet({
  visible,
  users,
  loading,
  selected,
  onToggle,
  onClose,
}: {
  visible: boolean;
  users: AdminUser[];
  loading: boolean;
  selected: string[];
  onToggle: (userId: string) => void;
  onClose: () => void;
}) {
  const theme = useMetro();
  const [query, setQuery] = useState('');

  const visibleUsers = useMemo(() => {
    const clean = query.trim().toLowerCase();
    const sorted = [...users].sort((left, right) =>
      displayName(left).localeCompare(displayName(right), 'en', { numeric: true }),
    );
    if (!clean) return sorted;
    return sorted.filter((user) =>
      `${displayName(user)} ${user.email ?? ''} ${user.username ?? ''}`
        .toLowerCase()
        .includes(clean),
    );
  }, [users, query]);

  return (
    <MetroSheet
      visible={visible}
      title="Named people"
      description="Only used by codes set up before tags. Tags are the way to do this now."
      onClose={onClose}
      actions={
        <MetroButton label={selected.length > 0 ? `Done — ${selected.length}` : 'Done'} onPress={onClose} />
      }>
      <MetroField
        label="Search people"
        hideLabel
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or email"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {loading ? (
        <Text style={[styles.summary, { color: theme.textDim }]}>Loading people…</Text>
      ) : visibleUsers.length === 0 ? (
        <Text style={[styles.summary, { color: theme.textDim }]}>
          {query ? `Nobody matches “${query}”.` : 'There are no active accounts to choose from.'}
        </Text>
      ) : (
        // The sheet is already bounded by the window and scrolls its own body,
        // so the list takes the height that leaves instead of a fixed 340.
        <View style={styles.people}>
          {visibleUsers.map((user) => (
            <MetroCheckbox
              key={user.userId}
              label={displayName(user)}
              description={[user.email, user.roles.map(roleLabel).join(', ')]
                .filter(Boolean)
                .join(' · ')}
              checked={selected.includes(user.userId)}
              onChange={() => onToggle(user.userId)}
            />
          ))}
        </View>
      )}
    </MetroSheet>
  );
}

const styles = StyleSheet.create({
  people: {
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  summary: {
    fontSize: 13,
  },
});
