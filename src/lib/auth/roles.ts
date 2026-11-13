/**
 * Role gating, kept faithful to v1.
 *
 * v1's AppShell passes a "model" (all / development / administrator / manager /
 * supervisor / investor) and each level lists the roles it admits. That is not a
 * single ladder — an investor is admitted by `investor` and by `administrator`,
 * but not by `manager` — so the sets are copied rather than ranked.
 */

export type AccessModel =
  | 'all'
  | 'development'
  | 'administrator'
  | 'manager'
  | 'supervisor'
  | 'investor';

/**
 * The KPI board's audience.
 *
 * `kpi` is the group an administrator adds someone to: it is what puts the KPI
 * tile on their home screen and lets them read the board. The other three keep
 * their way in because they could read it before the role existed — the same
 * shape Support has.
 *
 * It is not one of v1's models — `supervisor` also admits managers, but
 * `investor` would be dragged in by none of them and is excluded here.
 */
export const KPI_ROLES = ['kpi', 'administrator', 'manager', 'supervisor'] as const;

/**
 * The Support panel's audience.
 *
 * `support` is the group an administrator adds someone to — it is what puts the
 * tile on their home screen. The other three are here because the performance
 * report lives in this panel now and they could read it from Admin before.
 */
export const SUPPORT_ROLES = ['support', 'administrator', 'manager', 'supervisor'] as const;

/** Who may read every session, not only their own. */
export const SESSION_STAFF_ROLES = ['administrator', 'manager', 'supervisor'] as const;

/**
 * Kiosk Connect's audience — the operators who answer calls, and the roles that
 * maintain the devices.
 *
 * `kiosk` is the group an administrator adds an operator to; it puts the tile on
 * their home screen and lets them open the console. The rest are v1's nav set,
 * which the API accepts on the token route. A kiosk itself is not in this list:
 * a screen sitting in a lobby opens a device link and never signs in.
 */
export const CONNECT_ROLES = [
  'kiosk',
  'administrator',
  'developer',
  'manager',
  'supervisor',
] as const;

const MODEL_ROLES: Record<Exclude<AccessModel, 'all'>, string[]> = {
  development: ['developer'],
  administrator: ['administrator', 'developer'],
  manager: ['administrator', 'developer', 'manager'],
  supervisor: ['administrator', 'developer', 'manager', 'supervisor'],
  investor: ['administrator', 'developer', 'investor'],
};

/**
 * How a role is written for people.
 *
 * A capitalised slug is right for most of them; `kpi` is an acronym and would
 * read as a typo, so the few that need it are named here rather than in each
 * screen that prints a list of roles.
 */
const ROLE_LABELS: Record<string, string> = {
  kpi: 'KPI',
  kiosk: 'Kiosk',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

export function hasRole(roles: string[] | null | undefined, role: string): boolean {
  return Boolean(roles?.includes(role));
}

/** True when the user holds at least one of `required`. */
export function hasAnyRole(
  roles: string[] | null | undefined,
  required: readonly string[],
): boolean {
  if (!roles?.length) return false;
  return required.some((role) => roles.includes(role));
}

/** True when the user holds any role that the given v1 access model admits. */
export function hasAccess(
  roles: string[] | null | undefined,
  model: AccessModel = 'all',
): boolean {
  if (model === 'all') return true;
  if (!roles?.length) return false;
  return MODEL_ROLES[model].some((role) => roles.includes(role));
}
