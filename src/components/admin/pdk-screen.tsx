import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroBoard,
  MetroBoardPage,
  MetroButton,
  MetroDialog,
  MetroEmpty,
  MetroError,
  MetroField,
  MetroFigures,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroPane,
  MetroSection,
  MetroSheet,
  useBoard,
  useMetro,
  type MetroFigure,
} from '@/components/metro';
import { MetroType, Spacing } from '@/constants/metro';
import {
  doorStateLabel,
  fetchPdk,
  fetchPdkDoors,
  fetchPdkHolders,
  fetchPdkSystems,
  openPdkDoor,
  selectPdkSystem,
  type PdkDoor,
  type PdkHolder,
  type PdkStatus,
  type PdkSystemChoice,
} from '@/lib/admin/integrations';

function whenDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

/**
 * Admin → Integrations → PDK.
 *
 * PDK is the other kind of integration: there is nothing to click to connect it.
 * The API client credentials live in the server's environment, and this page's
 * job is to prove they work and then show what they bought — the doors on the
 * system with their live state, and the holders who can use them.
 *
 * Opening a door is the one write here, and it asks first: a remote unlock is a
 * physical act, and a mis-tap in a list of forty doors is not recoverable.
 *
 * Holders are read-only on purpose. Access is granted in pdk.io by whoever runs
 * the site; a second place to edit it would be a second place to get it wrong.
 */
export function PdkAdmin() {
  const theme = useMetro();
  const board = useBoard();

  const [status, setStatus] = useState<PdkStatus | null>(null);
  const [doors, setDoors] = useState<PdkDoor[]>([]);
  const [doorTotal, setDoorTotal] = useState<number | null>(null);
  const [holders, setHolders] = useState<PdkHolder[]>([]);
  const [holderTotal, setHolderTotal] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(
    null,
  );
  const [confirming, setConfirming] = useState<PdkDoor | null>(null);
  const [opening, setOpening] = useState(false);

  const [choosing, setChoosing] = useState(false);
  const [systems, setSystems] = useState<PdkSystemChoice[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(false);

  const load = useCallback(
    async (mode: 'load' | 'refresh' | 'silent', query = '') => {
      if (mode === 'load') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      try {
        const next = await fetchPdk();
        setStatus(next);
        setError(null);

        if (next.connected) {
          const [doorsResult, holdersResult] = await Promise.all([
            fetchPdkDoors(),
            fetchPdkHolders(query),
          ]);
          setDoors(doorsResult.doors);
          setDoorTotal(doorsResult.total);
          setHolders(holdersResult.holders);
          setHolderTotal(holdersResult.total);
        } else {
          setDoors([]);
          setHolders([]);
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Could not read the PDK system';
        if (mode === 'load') setError(message);
        else setNotice({ tone: 'error', message });
      } finally {
        if (mode === 'load') setLoading(false);
        if (mode === 'refresh') setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load('load');
  }, [load]);

  /**
   * Open the system picker.
   *
   * The list is asked of PDK, not typed in: a dealer's API client can reach
   * several customers, and the app should offer the ones it can actually use
   * rather than a field where a system id has to be pasted correctly.
   */
  const openChooser = async () => {
    setChoosing(true);
    setSystemsLoading(true);
    try {
      setSystems(await fetchPdkSystems());
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not list the PDK systems',
      });
    } finally {
      setSystemsLoading(false);
    }
  };

  /**
   * Remember the choice.
   *
   * The server confirms it with PDK before storing it, so a system that cannot be
   * reached is refused here instead of looking connected until the first door.
   */
  const chooseSystem = async (systemId: string) => {
    setChoosing(false);
    setLoading(true);
    try {
      const next = await selectPdkSystem(systemId);
      setStatus(next);
      setNotice({
        tone: 'success',
        message: `Connected to ${next.systemName ?? 'the selected system'}.`,
      });
      await load('load', search);
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'That system could not be selected',
      });
      setLoading(false);
    }
  };

  // Holders are searched on the server, because the list is one page deep: a
  // local filter would claim someone is missing when they are simply on page 2.
  useEffect(() => {
    if (!status?.connected) return;

    const timer = setTimeout(() => {
      fetchPdkHolders(search)
        .then((result) => {
          setHolders(result.holders);
          setHolderTotal(result.total);
        })
        .catch(() => {
          // The list keeps what it has; the banner already said PDK is unhappy.
        });
    }, 350);

    return () => clearTimeout(timer);
  }, [search, status?.connected]);

  const open = async () => {
    if (!confirming) return;
    setOpening(true);
    try {
      await openPdkDoor(confirming.id);
      setNotice({ tone: 'success', message: `${confirming.name ?? 'Door'} opened.` });
      setConfirming(null);
      await load('silent', search);
    } catch (cause) {
      setNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'The door could not be opened',
      });
    } finally {
      setOpening(false);
    }
  };

  const figures: MetroFigure[] = [
    {
      label: 'Doors',
      value: doorTotal === null ? String(doors.length) : String(doorTotal),
      hint: doors.filter((door) => door.state?.relayOpen).length
        ? `${doors.filter((door) => door.state?.relayOpen).length} open now`
        : 'All closed',
    },
    {
      label: 'Holders',
      value: holderTotal === null ? String(holders.length) : String(holderTotal),
      hint: `${holders.filter((holder) => !holder.enabled).length} disabled in this page`,
    },
    {
      label: 'System',
      value: status?.systemName ?? '—',
      hint: status?.systemId ?? 'Not configured',
    },
  ];

  const doorsPane = (
    <>
      <Text style={[styles.paneTitle, { color: theme.textDim }]}>
        DOORS · {doors.length}
        {doorTotal !== null && doorTotal > doors.length ? ` OF ${doorTotal}` : ''}
      </Text>

      {doors.length === 0 ? (
        <Text style={[styles.note, { color: theme.textDim }]}>
          No doors are on this PDK system yet. They are configured in pdk.io.
        </Text>
      ) : (
        <MetroList>
          {doors.map((door) => {
            const state = doorStateLabel(door);
            return (
              <MetroListRow
                key={door.id}
                title={door.name ?? 'Door'}
                subtitle={[door.cloudNodeName, door.type].filter(Boolean).join(' · ')}
                badge={{ label: state.label, tone: state.tone }}
                accessory={
                  <MetroButton
                    label="Open"
                    variant="ghost"
                    size="compact"
                    onPress={() => setConfirming(door)}
                  />
                }
              />
            );
          })}
        </MetroList>
      )}
    </>
  );

  const holdersPane = (
    <>
      <Text style={[styles.paneTitle, { color: theme.textDim }]}>
        HOLDERS · {holders.length}
        {holderTotal !== null && holderTotal > holders.length ? ` OF ${holderTotal}` : ''}
      </Text>

      <View>
        <MetroField
          label="Search holders"
          hideLabel
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or email"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {holders.length === 0 ? (
        <Text style={[styles.note, { color: theme.textDim }]}>
          {search ? `Nobody matches “${search}”.` : 'No holders on this system yet.'}
        </Text>
      ) : (
        <MetroList>
          {holders.map((holder) => (
            <MetroListRow
              key={holder.id}
              title={holder.name}
              subtitle={[holder.email, holder.groups.join(', ')].filter(Boolean).join(' · ')}
              value={holder.expireDate ? whenDate(holder.expireDate) : 'No expiry'}
              badge={
                holder.enabled ? undefined : { label: 'Disabled', tone: 'danger' as const }
              }
            />
          ))}
        </MetroList>
      )}
    </>
  );

  return (
    <MetroBoardPage
      eyebrow="Admin · Integrations"
      title="PDK"
      subtitle={
        loading
          ? 'Checking the PDK system…'
          : status?.connected
            ? `PDK access control${status.systemName ? ` · ${status.systemName}` : ''}`
            : status?.systemSelected
              ? 'PDK did not answer'
              : 'No PDK system selected'
      }
      width="wide"
      onRefresh={() => void load('refresh', search)}
      refreshing={refreshing}
      action={
        <View style={styles.actions}>
          <MetroButton
            label="‹ Integrations"
            variant="ghost"
            onPress={() => router.navigate('/admin/integrations')}
          />
          <MetroButton
            label="Check"
            variant="ghost"
            disabled={loading}
            onPress={() => void load('refresh', search)}
          />
          {status?.configured ? (
            <MetroButton
              label={status.systemSelected ? 'Change system' : 'Choose system'}
              onPress={() => void openChooser()}
            />
          ) : null}
        </View>
      }>
      {notice ? (
        <MetroBanner
          tone={notice.tone}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      {status?.needsAttention && !loading ? (
        <MetroBanner
          tone={status.configured ? 'error' : 'info'}
          message={status.needsAttention}
        />
      ) : null}

      {loading ? (
        <MetroLoading label="Checking PDK" />
      ) : error ? (
        <MetroError message={error} onRetry={() => void load('load')} />
      ) : !status?.configured ? (
        <MetroEmpty
          title="PDK is not configured"
          message="The server needs PDK_CLIENT_ID and PDK_CLIENT_SECRET. Once the API client credentials are set, this page lists the systems they can reach and reads the one you choose."
        />
      ) : !status.systemSelected ? (
        <MetroEmpty
          title="Choose a PDK system"
          message="This API client can reach one or more systems. Pick the one this app should work on — the choice is remembered, so it is not an environment variable."
          action={<MetroButton label="Choose system" onPress={() => void openChooser()} />}
        />
      ) : !status.connected ? (
        <MetroEmpty
          title="PDK did not answer"
          message={
            status.needsAttention ??
            'The credentials are set but PDK refused them. Check the API client and the system id.'
          }
        />
      ) : board ? (
        <>
          <MetroFigures figures={figures} size="medium" />
          <MetroBoard>
            <MetroPane grow={1.3}>{doorsPane}</MetroPane>
            <MetroPane grow={1}>{holdersPane}</MetroPane>
          </MetroBoard>
        </>
      ) : (
        <>
          <MetroFigures figures={figures} size="medium" />
          <MetroSection title="Doors">{doorsPane}</MetroSection>
          <MetroSection title="Holders">{holdersPane}</MetroSection>
        </>
      )}

      <MetroSheet
        visible={choosing}
        title="Choose a PDK system"
        description="The systems this API client can reach. The choice is remembered for every administrator, not just this device."
        onClose={() => setChoosing(false)}
        actions={
          <MetroButton label="Cancel" variant="ghost" onPress={() => setChoosing(false)} />
        }>
        {systemsLoading ? (
          <MetroLoading label="Asking PDK for the systems" />
        ) : systems.length === 0 ? (
          <Text style={[styles.note, { color: theme.textDim }]}>
            PDK did not list a system for this API client. Check the client's permissions in
            pdk.io, then try again.
          </Text>
        ) : (
          <MetroList>
            {systems.map((choice) => (
              <MetroListRow
                key={choice.systemId}
                title={choice.name}
                subtitle={choice.systemId}
                badge={
                  choice.systemId === status?.systemId
                    ? { label: 'Current', tone: 'accent' }
                    : undefined
                }
                onPress={() => void chooseSystem(choice.systemId)}
              />
            ))}
          </MetroList>
        )}
      </MetroSheet>

      <MetroDialog
        visible={confirming !== null}
        title={`Open ${confirming?.name ?? 'this door'}?`}
        message="The door releases now. Only open a door for someone you have seen or spoken to."
        onClose={() => setConfirming(null)}
        actions={[
          { label: 'Open door', loading: opening, onPress: () => void open() },
          { label: 'Cancel', variant: 'ghost', onPress: () => setConfirming(null) },
        ]}
      />
    </MetroBoardPage>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  paneTitle: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  note: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
});
