/**
 * RBAC — permission based, never `if (role === ...)`.
 *
 * Adding a capability means adding a permission here and granting it to roles in
 * `ROLE_PERMISSIONS`. Call sites (the API's `requirePermission` middleware and the
 * web app's `can()` composable) never learn about roles.
 *
 * The backend is the only source of truth: the web app uses this map to hide
 * actions, the API uses it to refuse them.
 */

import { ROLES, VENUE_ROLES, type Role, type VenueRole } from './enums.js';

export const PERMISSIONS = {
  /** Log in, edit own profile, change own photo and password. Everyone has it. */
  PROFILE_MANAGE_OWN: 'profile:manage:own',

  /** See the aula (Mon–Thu) agenda. */
  SESSION_VIEW_AULA: 'session:view:aula',
  /** See the dayuse (Fri–Sun) agenda. */
  SESSION_VIEW_DAYUSE: 'session:view:dayuse',

  /** Answer "Vou"/"Não vou" for oneself on an aula. */
  SESSION_RSVP_AULA: 'session:rsvp:aula',
  /** Answer "Vou"/"Não vou" for oneself on a dayuse. */
  SESSION_RSVP_DAYUSE: 'session:rsvp:dayuse',
  /** Answer on behalf of any user, on any session type. */
  SESSION_RSVP_ON_BEHALF: 'session:rsvp:on-behalf',

  /** See who confirmed (name and photo) on an aula. */
  SESSION_ATTENDEES_VIEW_AULA: 'session:attendees:view:aula',
  /** See who confirmed (name and photo) on a dayuse. */
  SESSION_ATTENDEES_VIEW_DAYUSE: 'session:attendees:view:dayuse',

  /** Create, edit and cancel sessions. */
  SESSION_MANAGE: 'session:manage',
  /** CRUD the weekly schedule templates and trigger session generation. */
  SCHEDULE_MANAGE: 'schedule:manage',

  /** Mark/edit attendance, limited to own sessions and within the edit deadline. */
  ATTENDANCE_MANAGE_OWN: 'attendance:manage:own',
  /** Mark/edit attendance on any session, with no deadline. */
  ATTENDANCE_MANAGE_ANY: 'attendance:manage:any',

  /** List and search every user (the super admin is still filtered out for admins). */
  USER_VIEW_ANY: 'user:view:any',
  /** See only the users booked into one's own sessions. */
  USER_VIEW_OWN_SESSIONS: 'user:view:own-sessions',
  /** Create, edit, activate and deactivate users. */
  USER_MANAGE: 'user:manage',
  /** Assign DAYUSE, ALUNO or PROFESSOR. */
  USER_ROLE_ASSIGN_BASIC: 'user:role:assign:basic',
  /** See the access-role label of other users. Hidden from everyone else by design. */
  USER_ROLE_LABEL_VIEW: 'user:role-label:view',

  /** Create, promote, demote and deactivate ADMIN users. Super admin only. */
  ADMIN_MANAGE: 'admin:manage',

  /** Full dashboard and reports. */
  REPORT_VIEW_ANY: 'report:view:any',
  /** Dashboard and reports restricted to one's own sessions. */
  REPORT_VIEW_OWN: 'report:view:own',

  /** Read and write system settings (section 6 parameters). */
  SETTINGS_MANAGE: 'settings:manage',

  /** Read the full audit log. Super admin only. */
  AUDIT_VIEW: 'audit:view',

  /** Browse the training centres (CTs) and their agendas. Everyone has it. */
  VENUE_VIEW: 'venue:view',
  /** Create and edit training centres. */
  VENUE_MANAGE: 'venue:manage',
  /** Add and remove the people who run a CT: its owners and its professors. */
  VENUE_STAFF_MANAGE: 'venue:staff:manage',

  /** See the photo feed. */
  FEED_VIEW: 'feed:view',
  /** Publish a photo to the feed. */
  FEED_POST: 'feed:post',
  /** Remove anyone's post, not just one's own. */
  FEED_MODERATE: 'feed:moderate',

  /**
   * Browse the community directory: name, photo and skill level of members who
   * chose to appear. Never e-mail, phone or access role (LGPD, ADR-26).
   */
  COMMUNITY_VIEW: 'community:view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_VALUES = Object.values(PERMISSIONS) as readonly Permission[];

// -----------------------------------------------------------------------------
// Role → permissions
// -----------------------------------------------------------------------------

/**
 * What every signed-in member can do regardless of role: manage their own
 * profile, find training centres and browse the community.
 */
const MEMBER_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.PROFILE_MANAGE_OWN,
  PERMISSIONS.VENUE_VIEW,
  PERMISSIONS.COMMUNITY_VIEW,
  PERMISSIONS.FEED_VIEW,
  PERMISSIONS.FEED_POST,
];

/** Lowest tier: dayuse-only player. Never sees the aula agenda. */
const DAYUSE_PERMISSIONS: readonly Permission[] = [
  ...MEMBER_PERMISSIONS,
  PERMISSIONS.SESSION_VIEW_DAYUSE,
  PERMISSIONS.SESSION_RSVP_DAYUSE,
  PERMISSIONS.SESSION_ATTENDEES_VIEW_DAYUSE,
];

/** Student: everything a dayuse user can do, plus the aula agenda. */
const ALUNO_PERMISSIONS: readonly Permission[] = [
  ...DAYUSE_PERMISSIONS,
  PERMISSIONS.SESSION_VIEW_AULA,
  PERMISSIONS.SESSION_RSVP_AULA,
  PERMISSIONS.SESSION_ATTENDEES_VIEW_AULA,
];

/**
 * Professor: runs aulas but does not book them (they are the responsible, not an
 * attendee). Plays dayuse like anyone else.
 */
const PROFESSOR_PERMISSIONS: readonly Permission[] = [
  ...MEMBER_PERMISSIONS,
  PERMISSIONS.SESSION_VIEW_AULA,
  PERMISSIONS.SESSION_VIEW_DAYUSE,
  PERMISSIONS.SESSION_RSVP_DAYUSE,
  PERMISSIONS.SESSION_ATTENDEES_VIEW_AULA,
  PERMISSIONS.SESSION_ATTENDEES_VIEW_DAYUSE,
  PERMISSIONS.ATTENDANCE_MANAGE_OWN,
  PERMISSIONS.USER_VIEW_OWN_SESSIONS,
  PERMISSIONS.REPORT_VIEW_OWN,
];

/**
 * Admin: runs the arena and also plays in it.
 *
 * Holds the personal RSVP permissions like any player, *plus* the ability to
 * answer on behalf of anyone else. The two are distinct on purpose: revoking the
 * personal ones later would turn an admin back into pure staff without touching
 * their management powers.
 */
const ADMIN_PERMISSIONS: readonly Permission[] = [
  ...MEMBER_PERMISSIONS,
  PERMISSIONS.SESSION_VIEW_AULA,
  PERMISSIONS.SESSION_VIEW_DAYUSE,
  PERMISSIONS.SESSION_RSVP_AULA,
  PERMISSIONS.SESSION_RSVP_DAYUSE,
  PERMISSIONS.SESSION_RSVP_ON_BEHALF,
  PERMISSIONS.SESSION_ATTENDEES_VIEW_AULA,
  PERMISSIONS.SESSION_ATTENDEES_VIEW_DAYUSE,
  PERMISSIONS.SESSION_MANAGE,
  PERMISSIONS.SCHEDULE_MANAGE,
  PERMISSIONS.ATTENDANCE_MANAGE_ANY,
  PERMISSIONS.USER_VIEW_ANY,
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.USER_ROLE_ASSIGN_BASIC,
  PERMISSIONS.USER_ROLE_LABEL_VIEW,
  PERMISSIONS.REPORT_VIEW_ANY,
  PERMISSIONS.SETTINGS_MANAGE,
  PERMISSIONS.VENUE_MANAGE,
  PERMISSIONS.FEED_MODERATE,
];

/**
 * Super admin: every admin permission, plus admin management and the audit log.
 *
 * The only account with authority everywhere. Every other kind of staff is tied
 * to a CT through `VENUE_ROLE_PERMISSIONS` below.
 */
const SUPER_ADMIN_PERMISSIONS: readonly Permission[] = [
  ...ADMIN_PERMISSIONS,
  PERMISSIONS.VENUE_STAFF_MANAGE,
  PERMISSIONS.ADMIN_MANAGE,
  PERMISSIONS.AUDIT_VIEW,
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.SUPER_ADMIN]: SUPER_ADMIN_PERMISSIONS,
  [ROLES.ADMIN]: ADMIN_PERMISSIONS,
  [ROLES.PROFESSOR]: PROFESSOR_PERMISSIONS,
  [ROLES.ALUNO]: ALUNO_PERMISSIONS,
  [ROLES.DAYUSE]: DAYUSE_PERMISSIONS,
};

// -----------------------------------------------------------------------------
// Venue role → permissions (authority inside one CT)
// -----------------------------------------------------------------------------

/**
 * Professor at a CT: runs the sessions they are responsible for.
 *
 * Deliberately narrow. A professor marks attendance for their own sessions and
 * sees who is coming; they do not touch the grid, the staff or anyone else's
 * session, because `ATTENDANCE_MANAGE_OWN` is checked against the session's
 * responsible in the service.
 */
const VENUE_PROFESSOR_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.SESSION_VIEW_AULA,
  PERMISSIONS.SESSION_VIEW_DAYUSE,
  PERMISSIONS.SESSION_ATTENDEES_VIEW_AULA,
  PERMISSIONS.SESSION_ATTENDEES_VIEW_DAYUSE,
  PERMISSIONS.ATTENDANCE_MANAGE_OWN,
  PERMISSIONS.USER_VIEW_OWN_SESSIONS,
  PERMISSIONS.REPORT_VIEW_OWN,
];

/**
 * Owner of a CT: everything that happens there.
 *
 * Note what is absent: `USER_MANAGE`, `USER_ROLE_ASSIGN_BASIC`, `SETTINGS_MANAGE`,
 * `ADMIN_MANAGE` and `AUDIT_VIEW`. Accounts and system-wide settings belong to
 * the whole network, not to one CT, so they stay with the super admin. An owner
 * runs their CT; they do not get to edit the people who visit it.
 */
const VENUE_OWNER_PERMISSIONS: readonly Permission[] = [
  ...VENUE_PROFESSOR_PERMISSIONS,
  PERMISSIONS.SESSION_RSVP_ON_BEHALF,
  PERMISSIONS.SESSION_MANAGE,
  PERMISSIONS.SCHEDULE_MANAGE,
  PERMISSIONS.ATTENDANCE_MANAGE_ANY,
  PERMISSIONS.USER_VIEW_ANY,
  PERMISSIONS.USER_ROLE_LABEL_VIEW,
  PERMISSIONS.REPORT_VIEW_ANY,
  PERMISSIONS.VENUE_MANAGE,
  PERMISSIONS.VENUE_STAFF_MANAGE,
  PERMISSIONS.FEED_MODERATE,
];

export const VENUE_ROLE_PERMISSIONS: Record<VenueRole, readonly Permission[]> = {
  [VENUE_ROLES.OWNER]: VENUE_OWNER_PERMISSIONS,
  [VENUE_ROLES.PROFESSOR]: VENUE_PROFESSOR_PERMISSIONS,
};

// -----------------------------------------------------------------------------
// Query helpers — used by the API middleware and the web `can()` composable.
// -----------------------------------------------------------------------------

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * What a user may do *inside one CT*: what their account can do anywhere, plus
 * what their membership of that CT grants.
 *
 * Callers must pass the membership for the CT being acted on. Passing `null`
 * yields the account-wide permissions alone, which is the correct answer for
 * someone who is not staff there — including an owner looking at a CT that is
 * not theirs.
 */
export function permissionsInVenue(
  role: Role,
  venueRole: VenueRole | null | undefined,
): readonly Permission[] {
  const global = ROLE_PERMISSIONS[role];
  if (!venueRole) return global;

  return [...new Set([...global, ...VENUE_ROLE_PERMISSIONS[venueRole]])];
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasPermission(
  granted: readonly Permission[] | undefined,
  permission: Permission,
): boolean {
  return granted?.includes(permission) ?? false;
}

export function hasAllPermissions(
  granted: readonly Permission[] | undefined,
  required: readonly Permission[],
): boolean {
  return required.every((permission) => hasPermission(granted, permission));
}

export function hasAnyPermission(
  granted: readonly Permission[] | undefined,
  required: readonly Permission[],
): boolean {
  return required.some((permission) => hasPermission(granted, permission));
}
