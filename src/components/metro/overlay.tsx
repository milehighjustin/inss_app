import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MetroType, Metrics, Radius, Shadow, Spacing } from '@/constants/metro';
import { MetroButton, type MetroButtonProps } from './button';
import { useMetro } from './use-metro';

/** Dimmed backdrop shared by the overlays. */
function Scrim({ onClose }: { onClose: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onClose} style={styles.scrim} />;
}

export interface MetroSheetProps {
  visible: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the content, for form actions. */
  actions?: ReactNode;
}

/**
 * Bottom sheet. A soft-cornered plane lifted off the page by one shadow: it is
 * something laid over the app, so it is allowed to float. Used for option
 * pickers and small forms.
 */
export function MetroSheet({
  visible,
  title,
  description,
  onClose,
  children,
  actions,
}: MetroSheetProps) {
  const theme = useMetro();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Scrim onClose={onClose} />
        <View
          style={[styles.sheet, { backgroundColor: theme.background, boxShadow: Shadow.overlay }]}>
          <View style={[styles.sheetGrabber, { backgroundColor: theme.border }]} />
          {/*
            The body scrolls, and the sheet is bounded, because the things that
            open in a sheet list options: every property, every kiosk, every role.
            Without this the list simply runs off the bottom of the screen and the
            options past the fold cannot be reached at all — there is nothing to
            drag. The grabber and the pinned actions stay outside so the close
            targets never scroll away.
          */}
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetBody}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled>
            {title ? <Text style={[styles.sheetTitle, { color: theme.text }]}>{title}</Text> : null}
            {description ? (
              <Text style={[styles.body, { color: theme.textDim }]}>{description}</Text>
            ) : null}
            {children}
          </ScrollView>
          {actions ? <View style={styles.sheetActions}>{actions}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export interface MetroPanelProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** `right` is for report links and other secondary actions. */
  accessory?: ReactNode;
}

/**
 * A large detail panel — v1's "big" modal.
 *
 * The sheet is for small choices; this is the one that holds a whole property:
 * nearly the full window on a desktop, the whole screen on a phone, with its own
 * scroll and a flat header that keeps the title in view.
 */
export function MetroPanel({
  visible,
  title,
  subtitle,
  onClose,
  children,
  accessory,
}: MetroPanelProps) {
  const theme = useMetro();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.panelRoot}>
        <Scrim onClose={onClose} />
        <View
          style={[
            styles.panel,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              boxShadow: Shadow.overlay,
              paddingTop: insets.top > 0 ? insets.top : 0,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 0,
            },
          ]}>
          <View style={[styles.panelHeader, { borderBottomColor: theme.border }]}>
            <View style={styles.panelHeaderText}>
              <Text numberOfLines={2} style={[styles.panelTitle, { color: theme.text }]}>
                {title}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} style={[styles.panelSubtitle, { color: theme.textDim }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {accessory}
            <MetroButton label="Close" variant="ghost" onPress={onClose} />
          </View>

          <ScrollView
            style={styles.panelBody}
            contentContainerStyle={styles.panelContent}
            showsVerticalScrollIndicator>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export interface MetroDialogAction {
  label: string;
  onPress: () => void;
  variant?: MetroButtonProps['variant'];
  loading?: boolean;
  destructive?: boolean;
}

export interface MetroDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  actions: MetroDialogAction[];
  onClose: () => void;
}

/** Centred confirm/result dialog. */
export function MetroDialog({ visible, title, message, actions, onClose }: MetroDialogProps) {
  const theme = useMetro();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dialogRoot}>
        <Scrim onClose={onClose} />
        <View
          style={[styles.dialog, { backgroundColor: theme.background, boxShadow: Shadow.overlay }]}>
          <Text style={[styles.dialogTitle, { color: theme.text }]}>{title}</Text>
          {/* A dialog's message is usually one line, but a long one must scroll
              rather than push the buttons off the bottom of the screen. */}
          {message ? (
            <ScrollView style={styles.dialogScroll} showsVerticalScrollIndicator>
              <Text style={[styles.body, { color: theme.textDim }]}>{message}</Text>
            </ScrollView>
          ) : null}
          <View style={styles.dialogActions}>
            {actions.map((action) => (
              <MetroButton
                key={action.label}
                label={action.label}
                variant={action.variant ?? 'primary'}
                color={action.destructive ? 'danger' : 'accent'}
                loading={action.loading}
                onPress={action.onPress}
                style={styles.dialogAction}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    // Positioned + zIndex so the panel paints (and receives taps) above the
    // absolutely positioned scrim rather than under it.
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 640,
    // Never taller than the window: the body scrolls inside this, in every
    // platform, so a long option list is reachable instead of clipped.
    maxHeight: '88%',
    borderTopLeftRadius: Radius.card + 6,
    borderTopRightRadius: Radius.card + 6,
  },
  sheetScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetGrabber: {
    height: 3,
    width: 44,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginTop: 10,
  },
  sheetBody: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  sheetTitle: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  sheetActions: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  panelRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  panel: {
    // Positioned + zIndex so the panel paints (and receives taps) above the
    // absolutely positioned scrim rather than under it.
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 1040,
    maxHeight: '94%',
    borderWidth: 1,
    borderRadius: Radius.card + 6,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Metrics.gutter,
    paddingVertical: Spacing.three,
  },
  panelHeaderText: {
    flex: 1,
    gap: 2,
  },
  panelTitle: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  panelSubtitle: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: MetroType.subtle.fontWeight,
  },
  panelBody: {
    flexGrow: 0,
  },
  panelContent: {
    padding: Metrics.gutter,
    gap: Spacing.four,
  },
  dialogRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialog: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    borderRadius: Radius.card + 4,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  dialogScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  dialogTitle: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  dialogActions: {
    gap: Spacing.two,
  },
  dialogAction: {
    width: '100%',
  },
  body: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: MetroType.body.fontWeight,
  },
});
