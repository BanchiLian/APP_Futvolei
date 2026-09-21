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

import { ROLES, type Role } from './enums.js';

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
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_VALUES = Object.values(PERMISSIONS) as readonly Permission[];

// -----------------------------------------------------------------------------
// Role → permissions
// -----------------------------------------------------------------------------

/** Lowest tier: dayuse-only player. Never sees the aula agenda. */
const DAYUSE_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.PROFILE_MANAGE_OWN,
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
  PERMISSIONS.PROFILE_MANAGE_OWN,
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
 * Admin: runs the arena. Answers RSVPs on behalf of anyone (including themselves)
 * rather than holding a personal booking permission — see docs/permissoes.md.
 */
const ADMIN_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.PROFILE_MANAGE_OWN,
  PERMISSIONS.SESSION_VIEW_AULA,
  PERMISSIONS.SESSION_VIEW_DAYUSE,
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
];

/** Super admin: every admin permission, plus admin management and the audit log. */
const SUPER_ADMIN_PERMISSIONS: readonly Permission[] = [
  ...ADMIN_PERMISSIONS,
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
// Query helpers — used by the API middleware and the web `can()` composable.
// -----------------------------------------------------------------------------

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
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
