import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { MetroBanner } from '@/components/metro';
import { Spacing } from '@/constants/metro';
import type { InvestorTarget } from '@/lib/investor';

/**
 * The strip an administrator sees over someone else's portal.
 *
 * v1 offered this as an "Investor View" tab inside the investor's own admin page,
 * so whose numbers were on screen was never in doubt. Here the preview is a full
 * screen of its own, which loses that context — this puts it back at the top of
 * every preview screen, with the ways out beside it.
 */
export function ActingAsNotice({
  target,
  actions,
}: {
  target: InvestorTarget;
  actions?: ReactNode;
}) {
  return (
    <MetroBanner
      tone="info"
      message={`Administrator preview: this is ${target.name}'s portal, exactly as they see it.`}>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </MetroBanner>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
