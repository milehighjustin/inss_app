import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MetroBanner,
  MetroButton,
  MetroError,
  MetroFigures,
  MetroList,
  MetroListRow,
  MetroLoading,
  MetroScreen,
  MetroSection,
  useMetro,
  type MetroFigure,
} from '@/components/metro';
import { Spacing } from '@/constants/metro';
import { formatDuration, formatRate } from '@/lib/admin/performance';
import { hasRole } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/session';
import {
  elapsedSeconds,
  endReasonLabel,
  fetchSession,
  type SupportSession,
} from '@/lib/support/sessions';

/**
 * Support → one session.
 *
 * The question a supervisor asks about a shift is "was the desk covered, and by
 * how much". So the band is offered/answered/median/missed, and the lists below
 * it separate what *reached* the person from what they *did*: an alert nobody
 * clicked and an alert nobody received are different failures, and only the
 * second one is a delivery problem.
 *
 * A support account may open its own session and nothing else — the server
 * enforces that. The link into everyone's sessions is administrator-only, because
 * that list lives in Admin → Support and nowhere else.
 *
 * `backHref` is where the back button goes: the desk's page for a person's own
 * shift, the admin list for a supervisor reading someone else's.
 */
export interface SessionDetailProps {
  sessionId: string;
  backHref?: Href;
  backLabel?: string;
}

export function SessionDetail({
  sessionId,
  backHref = '/support',
  backLabel = '‹ Support',
}: SessionDetailProps) {
  const theme = useMetro();
  const { user } = useAuth();
  const staff = hasRole(user?.roles, 'administrator');

  const [session, setSession] = useState<SupportSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setSession(await fetchSession(sessionId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = session?.metrics;
  const duration = session?.active
    ? elapsedSeconds(session.startedAt, Date.now())
    : (session?.durationSeconds ?? 0);

  const figures: MetroFigure[] = [
    {
      label: 'Answered',
      value: formatRate(metrics?.answerRate ?? null),
      hint: metrics ? `${metrics.answered} of ${metrics.offered} offered` : undefined,
    },
    {
      label: 'Median answer',
      value: formatDuration(metrics?.medianAnswerSeconds ?? null),
      hint: 'From ringing to answered',
    },
    {
      label: 'Alerts received',
      value: String(metrics?.notifications ?? 0),
      hint: metrics ? `${metrics.clicked} clicked` : undefined,
    },
    {
      label: session?.active ? 'On the clock' : 'Session length',
      value: formatDuration(session ? duration : null),
      hint: session?.active ? 'Still open' : endReasonLabel(session?.endedReason),
    },
  ];

  return (
    <MetroScreen
      eyebrow="Support · Session"
      title={session ? session.name : 'Session'}
      subtitle={
        session
          ? `${new Date(session.startedAt).toLocaleString()}${session.endedAt ? ` → ${new Date(session.endedAt).toLocaleString()}` : ' → now'}`
          : undefined
      }
      width="wide"
      action={
        <MetroButton
          label={backLabel}
          variant="ghost"
          onPress={() => (router.canGoBack() ? router.back() : router.navigate(backHref))}
        />
      }>
      {error ? <MetroBanner message={error} tone="error" onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <MetroLoading label="Loading the session" />
      ) : error && !session ? (
        <MetroError message={error} onRetry={() => void load()} />
      ) : !session || !metrics ? null : (
        <>
          <MetroFigures figures={figures} size="medium" />

          <MetroSection title="Shift" hint="When the desk was held, and by whom.">
            <MetroList>
              <MetroListRow
                title="Started"
                value={new Date(session.startedAt).toLocaleString()}
              />
              <MetroListRow
                title="Ended"
                value={session.endedAt ? new Date(session.endedAt).toLocaleString() : 'Still open'}
              />
              <MetroListRow
                title="Ended because"
                value={session.active ? '—' : endReasonLabel(session.endedReason)}
              />
              <MetroListRow
                title="Listening for"
                subtitle="The tags this account carried when the shift began"
                value={session.tags.length ? session.tags.join(', ') : 'No tags'}
              />
              <MetroListRow title="Roles" value={session.roles.join(', ') || 'None'} />
            </MetroList>
          </MetroSection>

          <MetroSection
            title="What reached them"
            hint="One alert is one message, however many devices it arrived on.">
            <MetroList>
              <MetroListRow
                title="Alerts received"
                subtitle="Offered while free, or held while on a call"
                value={String(metrics.notifications)}
                emphasis
              />
              <MetroListRow
                title="Clicked"
                subtitle={`${metrics.answered} answered · ${metrics.ignored} ignored${
                  metrics.claimed > 0 ? ` · ${metrics.claimed} taken from the board` : ''
                }`}
                value={String(metrics.clicked)}
                emphasis
              />
              <MetroListRow
                title="Held during calls"
                subtitle="Rang after the call ended"
                value={String(metrics.held)}
                emphasis
              />
              <MetroListRow
                title="Missed"
                subtitle="Offered, never answered or ignored"
                value={String(metrics.missed)}
                emphasis
              />
            </MetroList>
          </MetroSection>

          <MetroSection title="How fast" hint="Measured from the moment the alert rang.">
            <MetroList>
              <MetroListRow
                title="Median answer"
                value={formatDuration(metrics.medianAnswerSeconds)}
                emphasis
              />
              <MetroListRow
                title="Average answer"
                value={formatDuration(metrics.averageAnswerSeconds)}
                emphasis
              />
              <MetroListRow
                title="Answer rate"
                subtitle={`${metrics.answered} of ${metrics.offered} offered`}
                value={formatRate(metrics.answerRate)}
                emphasis
              />
            </MetroList>
          </MetroSection>

          <MetroSection title="Calls" hint="Video calls taken during the shift.">
            <MetroList>
              <MetroListRow title="Calls" value={String(metrics.calls)} emphasis />
              <MetroListRow
                title="Time on the line"
                value={formatDuration(metrics.talkSeconds)}
                emphasis
              />
            </MetroList>
          </MetroSection>

          {staff ? (
            <View style={styles.action}>
              <MetroButton
                label={`All of ${session.name}’s sessions`}
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: '/admin/support/sessions',
                    params: { userId: session.userId, name: session.name },
                  })
                }
              />
            </View>
          ) : null}

          <Text style={[styles.footnote, { color: theme.textDim }]}>
            A held alert is not a missed one: it arrived while the person was already on a call and
            rang when that call ended. Missed means it was offered and nothing happened.
          </Text>
        </>
      )}
    </MetroScreen>
  );
}

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
  },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.two,
  },
});
