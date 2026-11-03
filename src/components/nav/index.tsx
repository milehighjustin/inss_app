import { router, usePathname } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMetro } from '@/components/metro';
import { AppName } from '@/constants/app';
import { MetroType, Metrics, Radius, Spacing } from '@/constants/metro';
import { visibleSections, type AppSection } from '@/constants/sections';
import { useAuth } from '@/lib/auth/session';

/**
 * The app's own chrome.
 *
 * A fixed top bar with a menu button, and one drawer that holds the sections.
 * The drawer is mounted once at the shell, so it opens from any signed-in
 * screen — no tab row competing with the content.
 *
 * Metro rules apply: flat colour fields, square corners (only the avatar is a
 * circle), type-led hierarchy, the user's accent colour.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useMetro();

  return (
    <View style={[styles.shell, { backgroundColor: theme.background }]}>
      <TopBar menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />
      <View style={styles.slot}>{children}</View>
      <MenuDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function useIdentity() {
  const { user } = useAuth();
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Signed in';
  const initials =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((part) => part![0]!.toUpperCase())
      .join('')
      .slice(0, 2) ||
    (user?.username?.[0] ?? '?').toUpperCase();

  return { user, name, initials };
}

/** True when the section owns the current path. `/` only matches itself. */
function isCurrent(pathname: string, section: AppSection) {
  const href = String(section.href);
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The one section to mark as current.
 *
 * Sections nest (`/investor/files` sits under `/investor`), so the closest — the
 * longest matching href — wins rather than every ancestor.
 */
function currentSectionName(pathname: string, sections: AppSection[]) {
  return sections
    .filter((section) => isCurrent(pathname, section))
    .sort((left, right) => String(right.href).length - String(left.href).length)[0]?.name;
}

function TopBar({ menuOpen, onOpenMenu }: { menuOpen: boolean; onOpenMenu: () => void }) {
  const theme = useMetro();
  const insets = useSafeAreaInsets();
  const { user, name, initials } = useIdentity();
  const [menuHovered, setMenuHovered] = useState(false);

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
      <View style={[styles.accentLine, { backgroundColor: theme.accent }]} />

      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          accessibilityState={{ expanded: menuOpen }}
          aria-expanded={menuOpen}
          onPress={onOpenMenu}
          onHoverIn={() => setMenuHovered(true)}
          onHoverOut={() => setMenuHovered(false)}
          style={({ pressed }) => [
            styles.menuButton,
            {
              backgroundColor: pressed || menuHovered ? theme.surface : 'transparent',
            },
          ]}>
          <View style={[styles.bar, { backgroundColor: theme.text }]} />
          <View style={[styles.bar, { backgroundColor: theme.text }]} />
          <View style={[styles.bar, { backgroundColor: theme.text }]} />
        </Pressable>

        <View style={styles.topBarText}>
          <Text style={[styles.brand, { color: theme.textDim }]}>{AppName}</Text>
          <Text numberOfLines={1} style={[styles.who, { color: theme.text }]}>
            {name}
          </Text>
          {user?.roles?.length ? (
            <Text numberOfLines={1} style={[styles.roles, { color: theme.textDim }]}>
              {user.roles.map((role) => role.charAt(0).toUpperCase() + role.slice(1)).join(' · ')}
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open account"
          onPress={() => router.navigate('/account')}
          style={({ pressed }) => [
            styles.avatar,
            { backgroundColor: theme.accent, opacity: pressed ? 0.75 : 1 },
          ]}>
          <Text style={[styles.avatarText, { color: theme.onAccent }]}>{initials}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Left-hand nav, opened from the top bar on every screen.
 *
 * The panel is a flat colour plane with hairline separators and an accent bar
 * on the current section. It is positioned above the scrim so taps land on the
 * links, not the backdrop.
 */
function MenuDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useMetro();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { user, name } = useIdentity();
  const sections = visibleSections(user?.roles);

  // Escape closes it on the web; Modal already handles Android's back button.
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  const panelWidth = Math.min(Math.round(width * 0.82), 320);

  // No fade: Metro is a flat language, and closing must not wait on an
  // animation before the panel leaves the screen.
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.drawerRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={onClose}
          style={styles.scrim}
        />

        <View
          style={[
            styles.drawer,
            {
              width: panelWidth,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              backgroundColor: theme.background,
              borderRightColor: theme.border,
            },
          ]}>
          <View style={[styles.drawerHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.drawerBrand, { color: theme.textDim }]}>
              {AppName.toUpperCase()}
            </Text>
            <Text numberOfLines={2} style={[styles.drawerTitle, { color: theme.text }]}>
              {name}
            </Text>
          </View>

          <ScrollView
            style={styles.drawerScroll}
            contentContainerStyle={styles.drawerLinks}
            showsVerticalScrollIndicator={false}>
            {sections.map((section) => {
              const current = section.name === currentSectionName(pathname, sections);

              return (
                <Pressable
                  key={section.name}
                  accessibilityRole="link"
                  accessibilityLabel={section.label}
                  aria-current={current ? 'page' : undefined}
                  onPress={() => {
                    onClose();
                    // navigate, not push: a nav link reuses the screen in the
                    // stack instead of growing history every time.
                    router.navigate(section.href);
                  }}
                  style={({ pressed }) => [
                    styles.drawerLink,
                    { backgroundColor: pressed ? theme.surface : 'transparent' },
                  ]}>
                  <View
                    style={[
                      styles.drawerMarker,
                      { backgroundColor: current ? theme.accent : 'transparent' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.drawerLabel,
                      { color: current ? theme.text : theme.textDim },
                    ]}>
                    {section.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
  accentLine: {
    height: 6,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Metrics.gutter,
    paddingVertical: 12,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    width: 22,
    height: 2,
  },
  topBarText: {
    flex: 1,
    gap: 2,
  },
  brand: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  who: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  roles: {
    fontSize: MetroType.subtle.fontSize,
    lineHeight: MetroType.subtle.lineHeight,
    fontWeight: MetroType.subtle.fontWeight,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: MetroType.body.fontSize,
    fontWeight: 600,
  },
  drawerRoot: {
    flex: 1,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  drawer: {
    // Positioned + zIndex so the panel paints (and receives taps) above the
    // absolutely positioned scrim rather than under it.
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
    borderRightWidth: 1,
  },
  drawerHeader: {
    paddingHorizontal: Metrics.gutter,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    gap: 2,
  },
  drawerBrand: {
    fontSize: MetroType.eyebrow.fontSize,
    lineHeight: MetroType.eyebrow.lineHeight,
    letterSpacing: MetroType.eyebrow.letterSpacing,
    fontWeight: MetroType.eyebrow.fontWeight,
  },
  drawerTitle: {
    fontSize: MetroType.subheader.fontSize,
    lineHeight: MetroType.subheader.lineHeight,
    fontWeight: MetroType.subheader.fontWeight,
  },
  drawerScroll: {
    flex: 1,
  },
  drawerLinks: {
    paddingVertical: Spacing.two,
  },
  drawerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: Metrics.gutter,
  },
  drawerMarker: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 12,
  },
  drawerLabel: {
    fontSize: MetroType.body.fontSize,
    lineHeight: MetroType.body.lineHeight,
    fontWeight: 600,
  },
});
