import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/metro';
import { MetroButton } from './button';
import { useMetro } from './use-metro';

/**
 * Page controls for a list that is longer than one page.
 *
 * A pager, not infinite scroll: a supervisor reading a shift that ended at 14:05
 * needs to know where they are and be able to go back to it, and a list that
 * grows as you drag makes the row numbers meaningless.
 *
 * The count in the middle is the useful part — "26–50 of 312" says both where
 * this page starts and how much there is — and it is the one thing here that is
 * not a button, so it reads as a caption rather than an action.
 */
export interface MetroPagerProps {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  loading?: boolean;
}

export function MetroPager({ page, pageSize, total, onChange, loading = false }: MetroPagerProps) {
  const theme = useMetro();
  if (total === 0) return null;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <View style={styles.row}>
      <MetroButton
        label="‹ Prev"
        size="compact"
        variant="ghost"
        disabled={page <= 1 || loading}
        onPress={() => onChange(page - 1)}
        style={styles.button}
      />
      <Text style={[styles.label, { color: theme.textDim }]}>
        {first}–{last} of {total} · page {page} of {pageCount}
      </Text>
      <MetroButton
        label="Next ›"
        size="compact"
        variant="ghost"
        disabled={page >= pageCount || loading}
        onPress={() => onChange(page + 1)}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  // The pager is a control row on every width, so its buttons stay intrinsic
  // even on a phone, where the kit would otherwise stretch them.
  button: {
    alignSelf: 'center',
  },
  label: {
    fontSize: 12,
  },
});
