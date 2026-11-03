import type { AuthUser } from '@/lib/auth/api';

/**
 * Whether anything is ever addressed to this account — eligibility, not enrolment.
 *
 * Being eligible means alerts *can* be sent here; it does not turn them on and it
 * does not ask. A device is only registered when its owner presses Enable in
 * Account, and each device decides for itself.
 *
 * Alerts reach people two ways, and they are not the same vocabulary:
 *
 * - **Tags** — the names staff share. A QR code or a manual send names one, and
 *   everyone carrying it hears.
 * - **Documents** — addressed to people directly. A posted statement goes to the
 *   investors who can read the file, which is nobody's tag and cannot be picked
 *   from a list.
 *
 * So a tagged account and an investor are both allowed to enable alerts; anybody
 * else has nothing to switch on, so the control is not offered at all.
 */
export function receivesAlerts(user: AuthUser | null | undefined): boolean {
  if (!user) return false;

  return (user.notificationTags?.length ?? 0) > 0 || (user.roles?.includes('investor') ?? false);
}
