import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroField,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroPanel,
  MetroPivot,
  MetroSection,
  MetroSelect,
  MetroTextArea,
} from '@/components/metro';
import { useMetro } from '@/components/metro/use-metro';
import { Spacing } from '@/constants/metro';
import {
  addLocationNote,
  dateValue,
  deleteLocationNote,
  fetchLocation,
  listDepartments,
  LOCATION_STATUS_OPTIONS,
  updateLocation,
  type AdminLocation,
  type Department,
  type LocationPatch,
} from '@/lib/admin/locations';

/** The manual inputs v1 keeps on a location, in its order and with its labels. */
const MANUAL_FIELDS = [
  { key: 'internalId', label: 'Internal ID', kind: 'text' },
  { key: 'acquisitionDate', label: 'Acquisition Date', kind: 'date' },
  { key: 'valuationDate', label: 'Valuation Date', kind: 'date' },
  { key: 'budgetOccupancy', label: 'Budget Occupancy', kind: 'number' },
  { key: 'propertyValue', label: 'Property Value (estimated)', kind: 'number' },
  { key: 'operatingCashReserves', label: 'Operating Cash + Reserves', kind: 'number' },
  { key: 'loanInterestRate', label: 'Loan Interest Rate', kind: 'number' },
  { key: 'loanMaturityDate', label: 'Loan Maturity Date', kind: 'date' },
  { key: 'issPromote', label: 'ISS Promote (estimated)', kind: 'number' },
  { key: 'projectedCapitalCalls', label: 'Projected Capital Calls', kind: 'number' },
  { key: 'closingCostPct', label: 'Closing Cost (%)', kind: 'number' },
] as const;

type ManualKey = (typeof MANUAL_FIELDS)[number]['key'];

const TABS = [
  { value: 'manual', label: 'Manual Inputs' },
  { value: 'notes', label: 'Notes' },
];

function initialForm(location: AdminLocation): Record<ManualKey, string> {
  const form = {} as Record<ManualKey, string>;
  for (const field of MANUAL_FIELDS) {
    const value = location[field.key];
    form[field.key] =
      field.kind === 'date' ? dateValue(String(value)) : String(value ?? '');
  }
  return form;
}

/**
 * One location, as the Investor Portal's admin edits it.
 *
 * v1 splits this into Manual Inputs and Notes; both live here as tabs. Status
 * and the QuickBooks link save the moment they change (v1's behaviour), while
 * the manual inputs collect into one Update, so a half-typed form is never
 * written. Every save is the location endpoint's own validation.
 */
export function LocationPanel({
  location,
  onClose,
  onSaved,
}: {
  location: AdminLocation;
  onClose: () => void;
  onSaved: (location: AdminLocation) => void;
}) {
  const theme = useMetro();
  const [tab, setTab] = useState('manual');
  const [record, setRecord] = useState<AdminLocation>(location);
  const [notes, setNotes] = useState(location.notes);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState(() => initialForm(location));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  /** Reload the full record (the list rows carry no notes). */
  const load = useCallback(async () => {
    try {
      const [full, depts] = await Promise.all([fetchLocation(location.id), listDepartments()]);
      setRecord(full);
      setNotes(full.notes);
      setForm(initialForm(full));
      setDepartments(depts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this location');
    } finally {
      setLoading(false);
    }
  }, [location.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = (saved: AdminLocation) => {
    setRecord(saved);
    setForm(initialForm(saved));
    onSaved(saved);
  };

  const savePatch = async (patch: LocationPatch, message: string) => {
    setSaving(true);
    setError(null);
    try {
      apply(await updateLocation(location.id, patch));
      setNotice(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The location could not be saved');
    } finally {
      setSaving(false);
    }
  };

  const saveManualInputs = async () => {
    const patch: Record<string, string | number> = {};
    for (const field of MANUAL_FIELDS) {
      const value = form[field.key].trim();
      if (field.kind === 'number') {
        const amount = value === '' ? 0 : Number(value);
        if (!Number.isFinite(amount) || amount < 0) {
          setError(`${field.label} must be a number of zero or more.`);
          return;
        }
        patch[field.key] = amount;
      } else if (field.kind === 'date') {
        if (value && Number.isNaN(new Date(value).getTime())) {
          setError(`${field.label} must be a date like 2026-10-25.`);
          return;
        }
        patch[field.key] = value;
      } else {
        patch[field.key] = value;
      }
    }

    await savePatch(patch as LocationPatch, 'Manual inputs saved.');
  };

  const submitNote = async () => {
    const content = noteDraft.trim();
    if (!content) {
      setError('Write the note before saving it.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const note = await addLocationNote(location.id, content);
      setNotes((rows) => [note, ...rows]);
      setNoteDraft('');
      setNotice('Note added to the property.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The note could not be saved');
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async (noteId: string) => {
    setSaving(true);
    setError(null);
    try {
      await deleteLocationNote(location.id, noteId);
      setNotes((rows) => rows.filter((note) => note.id !== noteId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The note could not be deleted');
    } finally {
      setSaving(false);
    }
  };

  const departmentOptions = departments.map((department) => ({
    value: department.id,
    label: department.name,
  }));

  return (
    <MetroPanel
      visible
      title={record.departmentName || record.name || 'Property'}
      subtitle={record.internalId ? `Internal ID ${record.internalId}` : undefined}
      onClose={onClose}>
      {error ? <MetroBanner message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? (
        <MetroBanner tone="success" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      {loading ? (
        <MetroLoading label="Loading location" />
      ) : (
        <>
          <MetroSection
            title="Status"
            hint="The status the investor portal shows for this property."
            accessory={
              <Text style={[styles.status, { color: theme.textDim }]}>
                {record.status || 'Unknown'}
              </Text>
            }>
            <MetroSelect
              label="Change status"
              options={LOCATION_STATUS_OPTIONS}
              value={record.status}
              onChange={(value) => void savePatch({ status: value as AdminLocation['status'] }, 'Status saved.')}
              disabled={saving}
            />
          </MetroSection>

          <MetroSection
            title="Link to QuickBooks"
            hint="The department whose books this property reports from.">
            <Text style={[styles.value, { color: theme.text }]}>
              {record.departmentName || 'Not linked'}
            </Text>
            <MetroSelect
              label="QuickBooks department"
              options={departmentOptions}
              value={record.departmentId}
              placeholder={departments.length ? 'Choose a department' : 'No departments loaded'}
              onChange={(value) => {
                const department = departments.find((entry) => entry.id === value);
                if (!department) return;
                void savePatch(
                  { departmentId: department.id, departmentName: department.name },
                  'QuickBooks link saved.',
                );
              }}
              disabled={saving || departments.length === 0}
            />
          </MetroSection>

          <MetroPivot tabs={TABS} value={tab} onChange={setTab} />

          {tab === 'manual' ? (
            <MetroSection
              title="Manual inputs"
              hint="What the investor reports and the property page are built from.">
              {MANUAL_FIELDS.map((field) => (
                <MetroField
                  key={field.key}
                  label={field.label}
                  value={form[field.key]}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, [field.key]: value }))
                  }
                  keyboardType={field.kind === 'number' ? 'numeric' : 'default'}
                  placeholder={field.kind === 'date' ? 'YYYY-MM-DD' : undefined}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ))}
              <View>
                <MetroButton
                  label="Update"
                  loading={saving}
                  onPress={() => void saveManualInputs()}
                />
              </View>
            </MetroSection>
          ) : (
            <>
              <MetroSection
                title="Create note"
                hint="Shown on the investor portal's page for this property.">
                <MetroTextArea
                  label="Note"
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  placeholder="What the investors should know"
                  rows={3}
                />
                <View>
                  <MetroButton
                    label="Add note"
                    loading={saving}
                    onPress={() => void submitNote()}
                  />
                </View>
              </MetroSection>

              <MetroSection title="Notes" hint="Newest first.">
                {notes.length === 0 ? (
                  <Text style={[styles.value, { color: theme.textDim }]}>
                    No notes for this property yet.
                  </Text>
                ) : (
                  <MetroList>
                    {notes.map((note) => (
                      <MetroListRow
                        key={note.id}
                        title={note.createdByName ?? 'Administrator'}
                        subtitle={note.content}
                        value={new Date(note.createdAt).toLocaleDateString()}
                        accessory={
                          <MetroButton
                            label="Delete"
                            variant="ghost"
                            size="compact"
                            color="danger"
                            disabled={saving}
                            onPress={() => void removeNote(note.id)}
                          />
                        }
                      />
                    ))}
                  </MetroList>
                )}
              </MetroSection>
            </>
          )}
        </>
      )}
    </MetroPanel>
  );
}

const styles = StyleSheet.create({
  value: {
    fontSize: 14,
  },
  status: {
    fontSize: 13,
  },
});
