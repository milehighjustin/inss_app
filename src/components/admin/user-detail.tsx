import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroCheckbox,
  MetroDialog,
  MetroError,
  MetroField,
  MetroHeading,
  MetroLoading,
  MetroScreen,
  useMetro,
} from '@/components/metro';
import { MetroType, Spacing } from '@/constants/metro';
import { listNotificationTags, type NotificationTag } from '@/lib/admin/notifications';
import {
  ASSIGNABLE_ROLES,
  displayName,
  fetchUser,
  roleLabel,
  updateUser,
  uploadUserPhoto,
  type AdminUser,
} from '@/lib/admin/users';
import { useAuth } from '@/lib/auth/session';
import { pickImage } from '@/lib/media/pick-image';

interface Form {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  roles: string[];
  notificationTags: string[];
}

function formFrom(user: AdminUser): Form {
  return {
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    phone: user.phone ?? '',
    email: user.email ?? '',
    roles: user.roles,
    notificationTags: user.notificationTags ?? [],
  };
}

/**
 * Admin → one user.
 *
 * A reading-width column, because this is a form: profile details, the role
 * checkboxes v1 spreads across its user panel, and the activate/deactivate
 * switch that stands in for v1's "Remove User" button.
 */
export function UserDetail({ userId }: { userId: string }) {
  const theme = useMetro();
  const { user: signedInUser } = useAuth();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [confirm, setConfirm] = useState<'deactivate' | 'reactivate' | null>(null);
  const [tags, setTags] = useState<NotificationTag[]>([]);

  // The registry, so the checkboxes name tags that exist. A failure here leaves
  // the rest of the form usable rather than blocking a profile save.
  useEffect(() => {
    let cancelled = false;

    listNotificationTags()
      .then((rows) => {
        if (!cancelled) setTags(rows);
      })
      .catch(() => {
        if (!cancelled) setTags([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Reload after a failure. Only used by the retry button. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loaded = await fetchUser(userId);
      setUser(loaded);
      setForm(formFrom(loaded));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // The first load: state is only touched once the request settles, so mounting
  // does not render twice, and an unmount before the response is ignored.
  useEffect(() => {
    let cancelled = false;

    fetchUser(userId)
      .then((loaded) => {
        if (cancelled) return;
        setUser(loaded);
        setForm(formFrom(loaded));
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load this user');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = async () => {
    if (!form || !user) return;

    if (!form.firstName.trim()) return setNotice({ tone: 'error', message: 'First name is required' });
    if (!form.lastName.trim()) return setNotice({ tone: 'error', message: 'Last name is required' });

    setSaving(true);
    setNotice(null);

    try {
      const updated = await updateUser(userId, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        roles: form.roles,
        notificationTags: form.notificationTags,
      });
      setUser(updated);
      setForm(formFrom(updated));
      setNotice({ tone: 'success', message: 'Saved' });
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not save this user',
      });
    } finally {
      setSaving(false);
    }
  };

  const choosePhoto = async () => {
    setNotice(null);

    try {
      const picked = await pickImage();
      if (!picked) return;

      setUploading(true);
      const updated = await uploadUserPhoto(userId, picked);
      setUser(updated);
      setNotice({ tone: 'success', message: 'Photo updated' });
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not upload the photo',
      });
    } finally {
      setUploading(false);
    }
  };

  const setActive = async (active: boolean) => {
    setConfirm(null);
    setSaving(true);
    setNotice(null);

    try {
      const updated = await updateUser(userId, { active });
      setUser(updated);
      setForm(formFrom(updated));
      setNotice({ tone: 'success', message: active ? 'User reactivated' : 'User deactivated' });
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not change this user',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: string, checked: boolean) => {
    setForm((current) => {
      if (!current) return current;
      const roles = checked
        ? [...current.roles, role]
        : current.roles.filter((value) => value !== role);
      return { ...current, roles };
    });
  };

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/admin');
  };

  const locked = user?.locked === true;
  const isSelf = user?.userId === signedInUser?.userId;

  return (
    <MetroScreen
      eyebrow="Admin · Users"
      title={user ? displayName(user) : 'User'}
      subtitle={user?.email || user?.username || undefined}
      action={<MetroButton label="‹ Users" variant="ghost" onPress={back} />}>
      {notice ? (
        <MetroBanner message={notice.message} tone={notice.tone} onDismiss={() => setNotice(null)} />
      ) : null}

      {loading ? (
        <MetroLoading label="Loading user" />
      ) : error ? (
        <MetroError message={error} onRetry={() => load()} />
      ) : !form || !user ? null : (
        <>
          {locked ? (
            <MetroBanner
              tone="info"
              message="This user is locked and cannot be edited."
            />
          ) : null}

          <View style={styles.section}>
            <MetroHeading>Profile</MetroHeading>
            <MetroField
              label="First name"
              value={form.firstName}
              onChangeText={(value) => setForm({ ...form, firstName: value })}
              editable={!locked}
              autoCapitalize="words"
            />
            <MetroField
              label="Last name"
              value={form.lastName}
              onChangeText={(value) => setForm({ ...form, lastName: value })}
              editable={!locked}
              autoCapitalize="words"
            />
            <MetroField
              label="Phone"
              value={form.phone}
              onChangeText={(value) => setForm({ ...form, phone: value })}
              editable={!locked}
              keyboardType="phone-pad"
            />
            <MetroField
              label="Email"
              value={form.email}
              onChangeText={(value) => setForm({ ...form, email: value })}
              editable={!locked}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {user.username && user.username !== user.email ? (
              <MetroField label="Username" value={user.username} editable={false} />
            ) : null}
          </View>

          <View style={styles.section}>
            <MetroHeading>Photo</MetroHeading>
            {user.photoUrl ? (
              <Image
                source={user.photoUrl}
                style={[styles.photo, { backgroundColor: theme.surface }]}
                contentFit="cover"
                accessibilityLabel={`Photo of ${displayName(user)}`}
              />
            ) : (
              <Text style={[styles.sectionNote, { color: theme.textDim }]}>No photo yet.</Text>
            )}
            <MetroButton
              label={user.photoUrl ? 'Change photo' : 'Upload photo'}
              variant="ghost"
              loading={uploading}
              disabled={locked}
              onPress={choosePhoto}
            />
            <Text style={[styles.sectionNote, { color: theme.textDim }]}>
              PNG, JPEG or WebP, up to 8 MB. The new photo is saved as soon as it uploads.
            </Text>
          </View>

          <View style={styles.section}>
            <MetroHeading>Roles</MetroHeading>
            <Text style={[styles.sectionNote, { color: theme.textDim }]}>
              Roles decide which sections of the app and website are open to this user.
            </Text>
            {ASSIGNABLE_ROLES.map((role) => (
              <MetroCheckbox
                key={role}
                label={roleLabel(role)}
                checked={form.roles.includes(role)}
                onChange={(checked) => toggleRole(role, checked)}
                disabled={locked}
              />
            ))}
            {isSelf ? (
              <Text style={[styles.sectionNote, { color: theme.textDim }]}>
                You cannot remove your own administrator role.
              </Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <MetroHeading>Notifications</MetroHeading>
            <Text style={[styles.sectionNote, { color: theme.textDim }]}>
              The tags this person hears. Only tagged accounts are ever asked for notification
              permission, and a QR code or a manual send reaches them by tag.
            </Text>

            {tags.length === 0 ? (
              <>
                <Text style={[styles.sectionNote, { color: theme.textDim }]}>
                  No tags exist yet. Tags are ours to create — name one in Notifications, then
                  come back and give it to this person.
                </Text>
                <MetroButton
                  label="Create a tag"
                  variant="ghost"
                  size="compact"
                  onPress={() => router.navigate('/admin/notifications')}
                />
              </>
            ) : (
              tags
                // An inactive tag this person still has stays visible, so it can
                // be taken off rather than silently lingering.
                .filter((tag) => tag.active !== false || form.notificationTags.includes(tag.slug))
                .map((tag) => (
                  <MetroCheckbox
                    key={tag.slug}
                    label={tag.label}
                    description={
                      tag.active === false
                        ? 'Turned off — remove it from this person'
                        : tag.description || tag.slug
                    }
                    checked={form.notificationTags.includes(tag.slug)}
                    onChange={(checked) =>
                      setForm((current) => {
                        if (!current) return current;
                        const next = checked
                          ? [...current.notificationTags, tag.slug]
                          : current.notificationTags.filter((slug) => slug !== tag.slug);
                        return { ...current, notificationTags: next };
                      })
                    }
                    disabled={locked}
                  />
                ))
            )}
          </View>

          <MetroButton label="Save changes" loading={saving} disabled={locked} onPress={save} />

          <View style={styles.status}>
            <MetroHeading>
              {user.active ? 'Deactivate this user' : 'Reactivate this user'}
            </MetroHeading>
            <Text style={[styles.sectionNote, { color: theme.textDim }]}>
              {user.active
                ? 'They keep their details but cannot sign in to the app or the website.'
                : 'They regain access to the app and the website straight away.'}
            </Text>
            {isSelf && user.active ? (
              <Text style={[styles.sectionNote, { color: theme.textDim }]}>
                You cannot deactivate your own account.
              </Text>
            ) : (
              <MetroButton
                label={user.active ? 'Deactivate user' : 'Reactivate user'}
                variant="ghost"
                color={user.active ? 'danger' : 'accent'}
                loading={saving}
                onPress={() => setConfirm(user.active ? 'deactivate' : 'reactivate')}
              />
            )}
          </View>
        </>
      )}

      <MetroDialog
        visible={confirm !== null}
        title={confirm === 'deactivate' ? 'Deactivate this user?' : 'Reactivate this user?'}
        message={
          confirm === 'deactivate'
            ? `${displayName(user ?? {})} will no longer be able to sign in. You can reactivate them later.`
            : `${displayName(user ?? {})} will be able to sign in again.`
        }
        onClose={() => setConfirm(null)}
        actions={[
          {
            label: confirm === 'deactivate' ? 'Deactivate' : 'Reactivate',
            destructive: confirm === 'deactivate',
            onPress: () => void setActive(confirm === 'reactivate'),
          },
          { label: 'Cancel', variant: 'ghost', onPress: () => setConfirm(null) },
        ]}
      />
    </MetroScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  sectionNote: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  photo: {
    width: 160,
    height: 160,
  },
  status: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
});
