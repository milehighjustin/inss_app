import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MetroType, Radius, Spacing } from '@/constants/metro';
import { MetroButton } from './button';
import { useMetro } from './use-metro';

export type MetroBannerTone = 'error' | 'success' | 'info';

export interface MetroBannerProps {
  message: string;
  tone?: MetroBannerTone;
  onDismiss?: () => void;
  /** Extra content under the message. */
  children?: ReactNode;
}

/** Flat inline message with a coloured edge. Replaces per-screen error blocks. */
export function MetroBanner({ message, tone = 'error', onDismiss, children }: MetroBannerProps) {
  const theme = useMetro();
  const edge = tone === 'error' ? theme.danger : tone === 'success' ? theme.accent : theme.textDim;

  return (
    <View style={[styles.banner, { backgroundColor: theme.surface }]}>
      <View style={[styles.bannerEdge, { backgroundColor: edge }]} />
      <View style={styles.bannerBody}>
        <Text style={[styles.bannerText, { color: theme.text }]}>{message}</Text>
        {children}
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          onPress={onDismiss}
          style={styles.bannerClose}>
          <Text style={[styles.bannerCloseText, { color: theme.textDim }]}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export interface MetroEmptyProps {
  title: string;
  message?: string;
  /** Usually a button. */
  action?: ReactNode;
}

/** Nothing to show — and what to do about it. Also used for errors with a retry. */
export function MetroEmpty({ title, message, action }: MetroEmptyProps) {
  const theme = useMetro();

  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      {message ? (
        <Text style={[styles.emptyMessage, { color: theme.textDim }]}>{message}</Text>
      ) : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

/** "That failed" state: what happened, and the way to try again. */
export function MetroError({
  message,
  onRetry,
  retryLabel = 'Try again',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <MetroEmpty
      title="Something went wrong"
      message={message}
      action={
        onRetry ? <MetroButton label={retryLabel} variant="ghost" onPress={onRetry} /> : undefined
      }
    />
  );
}

/** Centred spinner. Use inside a screen body while its data loads. */
export function MetroLoading({ label }: { label?: string }) {
  const theme = useMetro();

  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.accent} />
      {label ? <Text style={[styles.loadingLabel, { color: theme.textDim }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  bannerEdge: {
    width: 4,
  },
  bannerBody: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 6,
  },
  bannerText: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: MetroType.subtle.fontWeight,
  },
  bannerClose: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  bannerCloseText: {
    fontSize: 20,
    lineHeight: 24,
  },
  empty: {
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  emptyTitle: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  emptyMessage: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
  },
  emptyAction: {
    marginTop: Spacing.one,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  loadingLabel: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
  },
});
