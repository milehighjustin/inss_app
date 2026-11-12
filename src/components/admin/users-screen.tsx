import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  MetroBanner,
  MetroBoardPage,
  MetroButton,
  MetroEmpty,
  MetroError,
  MetroField,
  MetroFigures,
  MetroList,
  MetroListArea,
  MetroListRow,
  MetroLoading,
  MetroSelect,
  type MetroFigure,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import {
  FILTER_OPTIONS,
  SORT_OPTIONS,
  displayName,
  listUsers,
  roleLabel,
  sortAndFilterUsers,
  type AdminUser,
  type UserFilter,
  type UserSort,
} from '@/lib/admin/users';
import { useAuth } from '@/lib/auth/session';
import { AdminPivot } from './admin-pivot';
import { CreateUserSheet } from './create-user-sheet';

function lastLoginLabel(user: AdminUser): string | null {
  if (!user.lastLogin) return null;
  const date = new Date(user.lastLogin);
  if (Number.isNaN(date.getTime())) return null;
  return `Last login ${date.toLocaleDateString()}`;
}

/**
 * Admin → Users. The same information and the same list rules as v1's Users
 * panel, in the Metro language: a wide page, one row per user, filters as
 * fields rather than a toolbar of menus.
 */
export function UsersAdmin() {
  const { user: signedInUser } = useAuth();
  const { width } = useWindowDimensions();
  const sideBySide = width >= 720;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [sort, setSort] = useState<UserSort>('lastNameAZ');
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  /** Pull the list again. Only used by user actions, never on mount. */
  const load = useCallback(async (mode: 'refresh' | 'retry') => {
    if (mode === 'retry') {
      setLoading(true);
      setError(null);
    }
    if (mode === 'refresh') setRefreshing(true);

    try {
      setUsers(await listUsers());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // The first load: state is only touched once the request settles, so mounting
  // does not render twice, and an unmount before the response is ignored.
  useEffect(() => {
    let cancelled = false;

    listUsers()
      .then((rows) => {
        if (!cancelled) setUsers(rows);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load users');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => sortAndFilterUsers(users, { query, filter, sort }),
    [users, query, filter, sort],
  );

  const activeCount = users.filter((user) => user.active).length;
  const inactiveCount = users.length - activeCount;
  const adminCount = users.filter(
    (user) => user.active && user.roles.includes('administrator'),
  ).length;

  const figures: MetroFigure[] = [
    { label: 'Active users', value: String(activeCount) },
    { label: 'Inactive', value: String(inactiveCount) },
    {
      label: 'Administrators',
      value: String(adminCount),
      hint:
        adminCount <= 1 ? 'A single account can administer' : 'Active accounts with full access',
    },
  ];

  return (
    <MetroBoardPage
      eyebrow="Admin"
      title="Users"
      subtitle={
        loading ? 'Loading users…' : `${visible.length} shown of ${users.length}`
      }
      width="wide"
      onRefresh={() => load('refresh')}
      refreshing={refreshing}
      action={
        <MetroButton
          label="Add user"
          onPress={() => {
            setNotice(null);
            setCreateOpen(true);
          }}
        />
      }>
      <AdminPivot />

      {notice ? (
        <MetroBanner message={notice.message} tone={notice.tone} onDismiss={() => setNotice(null)} />
      ) : null}

      {loading ? null : <MetroFigures figures={figures} size="medium" />}

      <View style={[styles.controls, { flexDirection: sideBySide ? 'row' : 'column' }]}>
        <View style={styles.search}>
          <MetroField
            label="Search"
            value={query}
            onChangeText={setQuery}
            placeholder="Name"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <View style={sideBySide ? styles.controlColumn : undefined}>
          <MetroSelect
            label="Filter"
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(value) => setFilter(value as UserFilter)}
          />
        </View>
        <View style={sideBySide ? styles.controlColumn : undefined}>
          <MetroSelect
            label="Sort"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(value) => setSort(value as UserSort)}
          />
        </View>
      </View>

      <MetroListArea>
      {loading ? (
        <MetroLoading label="Loading users" />
      ) : error ? (
        <MetroError message={error} onRetry={() => load('retry')} />
      ) : visible.length === 0 ? (
        <MetroEmpty
          title="No users match"
          message={
            query
              ? `Nothing matches “${query}”. Try a shorter search.`
              : 'Nothing in this filter yet.'
          }
        />
      ) : (
        <MetroList>
          {visible.map((user) => {
            const login = lastLoginLabel(user);
            const roles = user.roles.length ? user.roles.map(roleLabel).join(', ') : 'No roles';

            return (
              <MetroListRow
                key={user.userId}
                title={displayName(user)}
                subtitle={[roles, login].filter(Boolean).join(' · ')}
                badge={user.active ? undefined : { label: 'Inactive', tone: 'danger' }}
                value={user.userId === signedInUser?.userId ? 'You' : undefined}
                onPress={() =>
                  router.push({ pathname: '/admin/user/[userId]', params: { userId: user.userId } })
                }
              />
            );
          })}
        </MetroList>
      )}
      </MetroListArea>

      <CreateUserSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          setCreateOpen(false);
          setNotice({
            tone: 'success',
            message: created.email
              ? `${displayName(created)} created. They can sign in with a magic link sent to ${created.email}.`
              : `${displayName(created)} created. Add an email before they can sign in.`,
          });
          void load('refresh');
        }}
      />
    </MetroBoardPage>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: Spacing.three,
    alignItems: 'flex-end',
  },
  search: {
    flex: 1,
    alignSelf: 'stretch',
  },
  controlColumn: {
    width: 220,
  },
});
