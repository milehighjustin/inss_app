import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { MetroBanner, MetroButton, MetroScreen, Tile } from '@/components/metro';
import { AppName } from '@/constants/app';
import { Metrics, tileField } from '@/constants/metro';
import { KPI_ROLES, hasAnyRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/session';
import { desktopPushStatus, desktopPushSupported } from '@/lib/push/browser';
import { phonePushStatus, phonePushSupported } from '@/lib/push/phone';

/**
 * The hub. Everything here is a square tile that goes somewhere real, per
 * METRO.md: on phones two stretched columns, on desktop more fixed squares.
 *
 * The page is `wide` so the tiles start at the left gutter and the full window
 * is usable — a dashboard, not a centred column.
 *
 * Which tiles appear follows the same role gates as the drawer, so the home
 * screen and the menu never disagree. An investor opens the app on Portfolio —
 * that is the screen their account exists for.
 */
export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  const field = tileField(width - Metrics.gutter * 2);
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'there';

  const roles = user?.roles;
  const showKpi = hasAnyRole(roles, KPI_ROLES);
  const showInvestor = roles?.includes('investor') ?? false;

  return (
    <MetroScreen eyebrow={AppName} title="Welcome back" subtitle={name} width="wide">
      <AlertsBanner tags={user?.notificationTags ?? []} />

      <View style={[styles.tileRow, { gap: field.gap }]}>
        {showInvestor ? (
          <Tile
            title="Portfolio"
            subtitle="Equity and reports"
            size={field.size}
            onPress={() => router.push('/investor')}
          />
        ) : null}
        {showKpi ? (
          <Tile
            title="KPI"
            subtitle="Facility performance"
            size={field.size}
            onPress={() => router.push('/kpi')}
          />
        ) : null}
        {showInvestor ? (
          <Tile
            title="Files"
            subtitle="Your documents"
            size={field.size}
            onPress={() => router.push('/investor/files')}
          />
        ) : null}
        <Tile
          title="Account"
          subtitle="Your profile"
          size={field.size}
          onPress={() => router.push('/account')}
        />
      </View>
    </MetroScreen>
  );
}

/**
 * The one prompt a tagged person gets.
 *
 * **Tags only, deliberately.** An investor is never asked on arrival: their
 * documents are addressed to them, but alerts are opt-in per device and belong in
 * Account, where the switch is. Pushing a banner at someone who has not asked for
 * alerts is exactly what this is not for.
 *
 * A tagged account is different — an administrator has assigned it a job that
 * includes being told — so it is nudged once while this device is not registered,
 * and never again after it is.
 */
function AlertsBanner({ tags }: { tags: string[] }) {
  const [off, setOff] = useState(false);

  useEffect(() => {
    let live = true;

    if (tags.length === 0) {
      setOff(false);
      return;
    }

    const check = phonePushSupported()
      ? phonePushStatus().then((status) => supported(status) && !status.registered)
      : desktopPushSupported()
        ? desktopPushStatus().then((status) => !status.subscribed)
        : Promise.resolve(false);

    check
      .then((value) => {
        if (live) setOff(value);
      })
      .catch(() => {
        if (live) setOff(false);
      });

    return () => {
      live = false;
    };
  }, [tags]);

  if (!off) return null;

  return (
    <MetroBanner
      tone="info"
      message={`You are on the ${tags.join(', ')} alert list. Turn on notifications to be told when something needs it.`}>
      <View style={styles.bannerAction}>
        <MetroButton
          label="Turn on notifications"
          size="compact"
          onPress={() => router.push('/account')}
        />
      </View>
    </MetroBanner>
  );
}

/** A device that cannot receive alerts at all is not "switched off". */
function supported(status: { supported: boolean; permission: string }): boolean {
  return status.supported && status.permission !== 'unsupported';
}

const styles = StyleSheet.create({
  bannerAction: {
    flexDirection: 'row',
    marginTop: 8,
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
