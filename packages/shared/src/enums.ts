/**
 * Canonical domain enums.
 *
 * This file is the single source of truth. `prisma/schema.prisma` mirrors these
 * values, and `apps/api/src/lib/prisma.test.ts` asserts the two never drift apart.
 *
 * Values are plain const objects (not TypeScript `enum`) so the syntax stays
 * fully erasable and the same literals can be reused by Zod schemas.
 */

// -----------------------------------------------------------------------------
// Roles
// -----------------------------------------------------------------------------

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  PROFESSOR: 'PROFESSOR',
  ALUNO: 'ALUNO',
  DAYUSE: 'DAYUSE',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_VALUES = Object.values(ROLES) as readonly Role[];

/**
 * Authority *inside one CT*, which is a different question from the account-wide
 * role above.
 *
 * The product is a network of training centres: the person who runs a CT must be
 * able to do everything there and nothing anywhere else. A global role cannot
 * express that, so authority over a CT comes from membership in it. Only the
 * super admin is global, by design.
 */
export const VENUE_ROLES = {
  /** Runs the CT: its grid, its sessions, its staff, its attendance. */
  OWNER: 'OWNER',
  /** Teaches at the CT: attendance for the sessions they are responsible for. */
  PROFESSOR: 'PROFESSOR',
} as const;

export type VenueRole = (typeof VENUE_ROLES)[keyof typeof VENUE_ROLES];

export const VENUE_ROLE_VALUES = Object.values(VENUE_ROLES) as readonly VenueRole[];

export const VENUE_ROLE_LABELS: Record<VenueRole, string> = {
  [VENUE_ROLES.OWNER]: 'Dono do CT',
  [VENUE_ROLES.PROFESSOR]: 'Professor',
};

/**
 * The role every public sign-up produces. Never configurable, never negotiable:
 * `POST /auth/register` ignores any role sent by the client.
 */
export const PUBLIC_SIGNUP_ROLE: Role = ROLES.DAYUSE;

/**
 * Roles an ADMIN may assign to someone else.
 * Deliberately excludes ADMIN (super admin only) and SUPER_ADMIN (nobody).
 */
export const ADMIN_ASSIGNABLE_ROLES = [ROLES.DAYUSE, ROLES.ALUNO, ROLES.PROFESSOR] as const;
export type AdminAssignableRole = (typeof ADMIN_ASSIGNABLE_ROLES)[number];

/**
 * Roles a SUPER_ADMIN may assign. Still excludes SUPER_ADMIN: that role exists
 * only through `npm run superadmin:create` and is guarded by a partial unique index.
 */
export const SUPER_ADMIN_ASSIGNABLE_ROLES = [...ADMIN_ASSIGNABLE_ROLES, ROLES.ADMIN] as const;
export type SuperAdminAssignableRole = (typeof SUPER_ADMIN_ASSIGNABLE_ROLES)[number];

/**
 * Every role the application layer is allowed to write, ever.
 * `SUPER_ADMIN` is absent on purpose — no endpoint or schema may accept it.
 */
export const ASSIGNABLE_ROLES = SUPER_ADMIN_ASSIGNABLE_ROLES;
export type AssignableRole = SuperAdminAssignableRole;

export function isAssignableRole(value: unknown): value is AssignableRole {
  return ASSIGNABLE_ROLES.includes(value as AssignableRole);
}

// -----------------------------------------------------------------------------
// Sessions
// -----------------------------------------------------------------------------

export const SESSION_TYPES = {
  AULA: 'AULA',
  DAYUSE: 'DAYUSE',
} as const;

export type SessionType = (typeof SESSION_TYPES)[keyof typeof SESSION_TYPES];

export const SESSION_TYPE_VALUES = Object.values(SESSION_TYPES) as readonly SessionType[];

export const SESSION_STATUSES = {
  ABERTA: 'ABERTA',
  CANCELADA: 'CANCELADA',
  ENCERRADA: 'ENCERRADA',
} as const;

export type SessionStatus = (typeof SESSION_STATUSES)[keyof typeof SESSION_STATUSES];

export const SESSION_STATUS_VALUES = Object.values(SESSION_STATUSES) as readonly SessionStatus[];

// -----------------------------------------------------------------------------
// Bookings (RSVP + attendance live on the same row, in different fields)
// -----------------------------------------------------------------------------

export const BOOKING_STATUSES = {
  /** User answered "Vou" and holds a seat. */
  CONFIRMADA: 'CONFIRMADA',
  /** User explicitly answered "Não vou" — distinct from never having answered. */
  NAO_VOU: 'NAO_VOU',
  /** Session was full when the user answered "Vou"; holds `waitlistPosition`. */
  LISTA_ESPERA: 'LISTA_ESPERA',
  /** The arena cancelled the session; the answer is preserved for history. */
  CANCELADA_PELA_ARENA: 'CANCELADA_PELA_ARENA',
  /** Attendance confirmed by professor/admin (or self check-in). */
  PRESENTE: 'PRESENTE',
  /** Confirmed but did not show up. */
  FALTOU: 'FALTOU',
} as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES];

export const BOOKING_STATUS_VALUES = Object.values(BOOKING_STATUSES) as readonly BookingStatus[];

/** Statuses that occupy a seat against the session capacity. */
export const SEAT_TAKING_STATUSES = [
  BOOKING_STATUSES.CONFIRMADA,
  BOOKING_STATUSES.PRESENTE,
  BOOKING_STATUSES.FALTOU,
] as const;

/** What the user actually sends when answering. Attendance is a separate concept. */
export const RSVP_RESPONSES = {
  VOU: 'VOU',
  NAO_VOU: 'NAO_VOU',
} as const;

export type RsvpResponse = (typeof RSVP_RESPONSES)[keyof typeof RSVP_RESPONSES];

export const RSVP_RESPONSE_VALUES = Object.values(RSVP_RESPONSES) as readonly RsvpResponse[];

// -----------------------------------------------------------------------------
// Users
// -----------------------------------------------------------------------------

export const SKILL_LEVELS = {
  INICIANTE: 'INICIANTE',
  INTERMEDIARIO: 'INTERMEDIARIO',
  AVANCADO: 'AVANCADO',
} as const;

export type SkillLevel = (typeof SKILL_LEVELS)[keyof typeof SKILL_LEVELS];

export const SKILL_LEVEL_VALUES = Object.values(SKILL_LEVELS) as readonly SkillLevel[];

// -----------------------------------------------------------------------------
// Weekdays — 0 = Sunday, matching both `Date#getDay()` and `schedule_templates.weekday`.
// -----------------------------------------------------------------------------

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS_PT: Record<Weekday, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

export const WEEKDAY_SHORT_LABELS_PT: Record<Weekday, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
}
