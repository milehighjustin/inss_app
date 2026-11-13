import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import {
  MetroBanner,
  MetroButton,
  MetroDialog,
  MetroEmpty,
  MetroError,
  MetroField,
  MetroFigures,
  MetroBoardPage,
  MetroList,
  MetroListArea,
  MetroListRow,
  MetroLoading,
  MetroPanel,
  MetroSection,
  MetroToggle,
  type MetroFigure,
} from '@/components/metro';
import { useMetro } from '@/components/metro/use-metro';
import { Spacing } from '@/constants/metro';
import { copyText } from '@/lib/clipboard';
import {
  createQrCode,
  listQrCodes,
  qrCodeSvg,
  updateQrCode,
  type QrCode,
} from '@/lib/admin/qr-codes';
import { AdminPivot } from './admin-pivot';
import { AdminToolbar } from './admin-toolbar';
import { QrNotifySection } from './qr-notify';
import { QrPlacementSection } from './qr-placement';

/**
 * Admin → QR Codes.
 *
 * A code is printed once and lives as long as its id: this screen draws it, hands
 * over the two addresses to program a sign and a kiosk with, and lets the
 * destination change without reprinting anything. Deactivating takes the code out
 * of service — v1 hides inactive codes from this list, and so does v2.
 */
export function QrAdmin() {
  const [codes, setCodes] = useState<QrCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selected, setSelected] = useState<QrCode | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (includeInactive: boolean) => {
    setLoading(true);
    setError(null);
    try {
      setCodes(await listQrCodes(includeInactive));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load QR codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(showInactive);
  }, [load, showInactive]);

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return codes;
    return codes.filter((code) =>
      `${code.name} ${code.url}`.toLowerCase().includes(clean),
    );
  }, [codes, query]);

  const activeCodes = codes.filter((code) => code.active).length;

  const figures: MetroFigure[] = [
    { label: 'Codes', value: String(codes.length) },
    { label: 'Active', value: String(activeCodes) },
    {
      label: 'Alerting',
      value: String(
        codes.filter((code) => code.notifyTags.length + code.notifyUserIds.length > 0).length,
      ),
      hint: 'Codes with tags to tell when they are scanned',
    },
  ];

  const replace = (updated: QrCode) => {
    setCodes((rows) => {
      const exists = rows.some((row) => row.id === updated.id);
      const next = exists
        ? rows.map((row) => (row.id === updated.id ? updated : row))
        : [updated, ...rows];
      return next.filter((row) => showInactive || row.active);
    });
    setSelected((current) => (current && current.id === updated.id ? updated : current));
  };

  return (
    <MetroBoardPage
      eyebrow="Admin"
      title="QR Codes"
      subtitle="Each code is a fixed id that forwards somewhere you can change later."
      width="wide">
      <AdminPivot />

      {notice ? <MetroBanner tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      <AdminToolbar
        count={`${visible.length} of ${codes.length}`}
        actions={
          <>
            <MetroButton
              label="Refresh"
              variant="ghost"
              onPress={() => void load(showInactive)}
            />
            <MetroButton label="Create QR code" onPress={() => setCreating(true)} />
          </>
        }>
        <View style={styles.search}>
          <MetroField
            label="Search codes"
            hideLabel
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or destination"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </AdminToolbar>

      {loading ? null : <MetroFigures figures={figures} size="medium" />}

      <MetroToggle
        label="Show deactivated codes"
        description="Deactivated codes no longer resolve, but their history stays."
        value={showInactive}
        onChange={setShowInactive}
      />

      <MetroListArea>
      {loading ? (
        <MetroLoading label="Loading QR codes" />
      ) : visible.length === 0 ? (
        <MetroEmpty
          title="No QR codes"
          message={
            query
              ? `Nothing matches “${query}”.`
              : 'Create a code for a sign, then point it at the page it should open.'
          }
          action={<MetroButton label="Create QR code" onPress={() => setCreating(true)} />}
        />
      ) : (
        <MetroList>
          {visible.map((code) => (
            <MetroListRow
              key={code.id}
              title={code.name || 'Untitled code'}
              subtitle={code.url}
              badge={code.active ? undefined : { label: 'Deactivated', tone: 'danger' }}
              onPress={() => setSelected(code)}
            />
          ))}
        </MetroList>
      )}

      {selected ? (
        // Keyed by id: opening another code must start from that code's values,
        // not keep the previous one's half-edited form.
        <QrPanel
          key={selected.id}
          code={selected}
          onClose={() => setSelected(null)}
          onChange={replace}
          onNotice={setNotice}
        />
      ) : null}

      {creating ? (
        <CreateQrPanel
          onClose={() => setCreating(false)}
          onCreated={(code) => {
            setCreating(false);
            replace(code);
            setNotice(`“${code.name}” created.`);
          }}
        />
      ) : null}
      </MetroListArea>
    </MetroBoardPage>
  );
}

function QrPanel({
  code,
  onClose,
  onChange,
  onNotice,
}: {
  code: QrCode;
  onClose: () => void;
  onChange: (code: QrCode) => void;
  onNotice: (message: string) => void;
}) {
  const theme = useMetro();
  const [svg, setSvg] = useState<string | null>(null);
  const [url, setUrl] = useState(code.url);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    qrCodeSvg(code.id)
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'The code could not be drawn');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code.id]);

  const saveUrl = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateQrCode(code.id, { url: url.trim() });
      onChange(updated);
      onNotice('Destination updated. Every printed copy of the code now points there.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The destination could not be saved');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateQrCode(code.id, { active: false });
      onChange(updated);
      setConfirming(false);
      onNotice(`“${code.name}” deactivated.`);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The code could not be deactivated');
    } finally {
      setSaving(false);
    }
  };

  const copy = async (value: string, label: string) => {
    const copied = await copyText(value);
    onNotice(copied ? `${label} copied.` : `Copy was blocked — select the address instead.`);
  };

  return (
    <MetroPanel
      visible
      title={code.name || 'QR code'}
      subtitle={code.active ? 'Active' : 'Deactivated'}
      onClose={onClose}>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      <MetroSection title="QR code" hint="This is what gets printed.">
        <View style={styles.codeFrame}>
          {loading ? (
            <MetroLoading label="Drawing the code" />
          ) : svg ? (
            <SvgXml xml={svg} width={240} height={240} />
          ) : (
            <Text style={[styles.value, { color: theme.textDim }]}>
              The code could not be loaded.
            </Text>
          )}
        </View>
      </MetroSection>

      <MetroSection
        title="QR code URL"
        hint="Make your own code elsewhere that links to the same page.">
        <Text selectable style={[styles.address, { color: theme.text }]}>
          {code.links.code}
        </Text>
        <View>
          <MetroButton
            label="Copy address"
            variant="ghost"
            onPress={() => void copy(code.links.code, 'Address')}
          />
        </View>
      </MetroSection>

      <MetroSection
        title="Display page"
        hint="Program a kiosk or a screen to open this to show the code.">
        <Text selectable style={[styles.address, { color: theme.text }]}>
          {code.links.kiosk}
        </Text>
        <View>
          <MetroButton
            label="Copy display address"
            variant="ghost"
            onPress={() => void copy(code.links.kiosk, 'Display address')}
          />
        </View>
      </MetroSection>

      <MetroSection title="Destination" hint="Where scanning the code sends people.">
        <MetroField
          label="URL"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://"
        />
        <View>
          <MetroButton
            label="Save destination"
            loading={saving}
            disabled={url.trim() === code.url}
            onPress={() => void saveUrl()}
          />
        </View>
      </MetroSection>

      <QrPlacementSection code={code} onChange={onChange} onNotice={onNotice} />

      <QrNotifySection code={code} onChange={onChange} onNotice={onNotice} />

      {code.active ? (
        <MetroSection
          title="Deactivate"
          hint="The code stops resolving. Printed copies can no longer be used.">
          <View>
            <MetroButton
              label="Deactivate code"
              variant="ghost"
              color="danger"
              disabled={saving}
              onPress={() => setConfirming(true)}
            />
          </View>
        </MetroSection>
      ) : null}

      <MetroDialog
        visible={confirming}
        title="Deactivate this code?"
        message="Anyone scanning a printed copy will stop reaching the destination."
        onClose={() => setConfirming(false)}
        actions={[
          { label: 'Deactivate', destructive: true, loading: saving, onPress: () => void deactivate() },
          { label: 'Keep it active', variant: 'ghost', onPress: () => setConfirming(false) },
        ]}
      />
    </MetroPanel>
  );
}

function CreateQrPanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (code: QrCode) => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Name the code so you can find it later.');
      return;
    }
    if (!url.trim()) {
      setError('Enter the address the code should open.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      onCreated(await createQrCode(name.trim(), url.trim()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The code could not be created');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MetroPanel visible title="Create QR code" subtitle="It gets an id immediately; the picture comes from that." onClose={onClose}>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}

      <MetroSection title="Name" hint="For this list only — it is never printed.">
        <MetroField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Front gate — Maple Street"
        />
      </MetroSection>

      <MetroSection title="Destination" hint="The page a scan should open.">
        <MetroField
          label="URL"
          value={url}
          onChangeText={setUrl}
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </MetroSection>

      <View>
        <MetroButton label="Create QR code" loading={saving} onPress={() => void submit()} />
      </View>
    </MetroPanel>
  );
}

const styles = StyleSheet.create({
  search: {
    flex: 1,
    // A phone wraps the rest of the toolbar under it rather than squeezing the field away.
    minWidth: 220,
  },
  codeFrame: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
  },
  address: {
    fontSize: 13,
  },
  value: {
    fontSize: 13,
  },
});
