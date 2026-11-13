import type { Href } from 'expo-router';

import {
  CONNECT_ROLES,
  KPI_ROLES,
  SUPPORT_ROLES,
  hasAccess,
  hasAnyRole,
  type AccessModel,
} from '@/lib/auth/roles';

export interface AppSection {
  /** Stable key for lists and tests; routing uses `href`. */
  name: string;
  href: Href;
  label: string;
  /** Which v1 access model may see the section. Defaults to everyone signed in. */
  requires?: AccessModel;
  /**
   * One exact role, for screens v1 hard-checks rather than admitting a model's
   * whole role set (its admin page requires `administrator`, not developer).
   */
  requiresRole?: string;
  /**
   * Any one of these roles, for screens whose audience is not a v1 model. KPI,
   * for instance, is administrators, managers and supervisors — not investors,
   * which `manager` would have admitted.
   */
  requiresRoles?: readonly string[];
}

/**
 * Top-level sections of the app, in menu order.
 *
 * The nav drawer builds itself from this list, so a section that is added here
 * (with its route) appears everywhere at once. The role-gated sections that v1
 * keeps in its nav bar (Portfolio, Kiosk Connect) get added as each is ported —
 * see MIGRATION.md.
 */
export const SECTIONS: AppSection[] = [
  { name: 'home', href: '/', label: 'Home' },
  // Both job-group sections are gated the way Support is: the role an
  // administrator assigns, plus the roles that could reach the section before
  // that role existed.
  { name: 'kpi', href: '/kpi', label: 'KPI', requiresRoles: KPI_ROLES },
  // Kiosk Connect: the `kiosk` operator group, plus v1's administrator,
  // developer, manager and supervisor set.
  {
    name: 'kiosk-connect',
    href: '/kioskconnect',
    label: 'Kiosk Connect',
    requiresRoles: CONNECT_ROLES,
  },
  // v1's nav gives investors two entries: Portfolio (the snapshot and report
  // tabs) and Files (their documents). Both are gated on the `investor` role
  // itself, not on v1's "investor" shell model, exactly as its pages do.
  { name: 'portfolio', href: '/investor', label: 'Portfolio', requiresRole: 'investor' },
  { name: 'files', href: '/investor/files', label: 'Files', requiresRole: 'investor' },
  // The desk's own page: the shift that turns alerts on, the alerts still
  // answerable, and the person's own history. Everyone else's shifts and the
  // numbers are in Admin → Support, so this section has no admin part at all.
  { name: 'support', href: '/support', label: 'Support', requiresRoles: SUPPORT_ROLES },
  { name: 'admin', href: '/admin', label: 'Admin', requiresRole: 'administrator' },
  { name: 'account', href: '/account', label: 'Account' },
];

/** The sections this user may open. */
export function visibleSections(roles: string[] | null | undefined): AppSection[] {
  return SECTIONS.filter((section) => {
    if (section.requiresRoles && !hasAnyRole(roles, section.requiresRoles)) return false;
    if (section.requiresRole && !roles?.includes(section.requiresRole)) return false;
    return hasAccess(roles, section.requires ?? 'all');
  });
}
