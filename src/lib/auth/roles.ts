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
 * The KPI board's audience: administrators, managers and supervisors.
 *
 * It is not one of v1's models — `supervisor` also admits managers, but
 * `investor` would be dragged in by none of them and is excluded here.
 */
export const KPI_ROLES = ['administrator', 'manager', 'supervisor'] as const;

/**
 * Kiosk Connect's audience — the console and the admin that maintains the
 * devices. v1's nav lists it for administrators, developers, managers and
 * supervisors, the same set the API accepts on the token route.
 */
export const CONNECT_ROLES = [
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
