import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MetroType, Radius, Spacing } from '@/constants/metro';
import { MetroLabel } from './primitives';
import { useMetro } from './use-metro';

/** A file chosen on the device, or already on the server. */
export interface PickedFile {
  uri: string;
  name: string;
  /** Bytes, when the picker knows it. */
  size?: number;
  mimeType?: string;
}

export interface MetroFileFieldProps {
  label: string;
  /**
   * Opens the platform picker. The screen owns it — expo-document-picker for
   * documents, expo-image-picker for photos — so this component stays free of
   * a media dependency and works on every platform.
   */
  onPick: () => void;
  files: PickedFile[];
  onRemove?: (file: PickedFile) => void;
  /** Disable the picker and the remove buttons (e.g. while uploading). */
  busy?: boolean;
  error?: string;
  hint?: string;
  /** Maximum number of files; the label shows "2 of 5". */
  limit?: number;
  /** Copy on the tap target when nothing is chosen. */
  emptyLabel?: string;
}

function formatBytes(bytes?: number): string | null {
  if (bytes === undefined || Number.isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Attachment field: a square tap target that opens the picker, then a list of
 * what was chosen with the way to take it back. The Metro version of v1's
 * InputUpload — no drop zone illustration, just a rule, a label and a list.
 */
export function MetroFileField({
  label,
  onPick,
  files,
  onRemove,
  busy = false,
  error,
  hint,
  limit,
  emptyLabel = 'Choose a file',
}: MetroFileFieldProps) {
  const theme = useMetro();
  const atLimit = limit !== undefined && files.length >= limit;
  const disabled = busy || atLimit;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <MetroLabel>{label}</MetroLabel>
        {limit !== undefined ? (
          <Text style={[styles.counter, { color: theme.textDim }]}>
            {files.length} of {limit}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={emptyLabel}
        accessibilityState={{ disabled }}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={onPick}
        style={({ pressed }) => [
          styles.target,
          {
            borderColor: error ? theme.danger : theme.border,
            backgroundColor: pressed ? theme.surfaceStrong : theme.surface,
            opacity: disabled ? 0.5 : 1,
          },
        ]}>
        <Text style={[styles.targetLabel, { color: theme.text }]}>{emptyLabel}</Text>
        <Text style={[styles.targetMeta, { color: theme.textDim }]}>
          {busy ? 'Working…' : 'Documents and photos'}
        </Text>
      </Pressable>

      {files.length ? (
        <View style={[styles.files, { backgroundColor: theme.border }]}>
          {files.map((file) => {
            const size = formatBytes(file.size);
            return (
              <View key={`${file.uri}-${file.name}`} style={[styles.file, { backgroundColor: theme.surface }]}>
                <View style={styles.fileText}>
                  <Text numberOfLines={1} style={[styles.fileName, { color: theme.text }]}>
                    {file.name}
                  </Text>
                  {size ? <Text style={[styles.fileMeta, { color: theme.textDim }]}>{size}</Text> : null}
                </View>
                {onRemove ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${file.name}`}
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => onRemove(file)}
                    style={styles.remove}>
                    <Text style={[styles.removeText, { color: theme.textDim }]}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {error ? (
        <Text style={[styles.helper, { color: theme.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.helper, { color: theme.textDim }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  counter: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  target: {
    borderRadius: Radius.control,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: 14,
    gap: 4,
  },
  targetLabel: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: 600,
  },
  targetMeta: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  files: {
    gap: 1,
    borderRadius: Radius.card,
    overflow: 'hidden',
    marginTop: Spacing.one,
  },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileText: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 600,
  },
  fileMeta: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
  remove: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  removeText: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: 600,
    textDecorationLine: 'underline',
  },
  helper: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
});
