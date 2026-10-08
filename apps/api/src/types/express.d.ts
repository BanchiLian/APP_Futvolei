import type { Permission, Role, VenueRole } from '@futcheck/shared';

/** A CT where this person is staff, and in which capacity. */
export interface VenueMembership {
  venueId: string;
  role: VenueRole;
}

/** Who is making this request, resolved fresh from the database on every call. */
export interface AuthContext {
  userId: string;
  role: Role;
  /**
   * What this account could do *somewhere*: its own role's permissions plus
   * those of every CT it is staff at.
   *
   * This is the right question for the route gate and the wrong one for a
   * decision about a specific CT — an owner of one CT must not manage another.
   * Narrow it with `venueAuthFor` before acting on a CT's data.
   */
  permissions: readonly Permission[];
  /** Every CT this person runs or teaches at. Empty for an ordinary player. */
  memberships: readonly VenueMembership[];
}

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware. Absent on public routes. */
      auth?: AuthContext;
    }
  }
}
