import {
  ERROR_CODES,
  VENUE_ROLES,
  hasAllPermissions,
  permissionsInVenue,
  type Permission,
  type VenueRole,
} from '@futcheck/shared';

import { forbidden } from './errors.js';
import type { AuthContext } from '../types/express.js';

/**
 * Authorization scoped to one CT.
 *
 * The route middleware can only ask "may this kind of account ever do this?".
 * In a network of training centres the real question is "may this person do it
 * *here*", and only the service knows which CT is being acted on. So the narrow
 * check lives in the service layer, next to the data — which is also where an
 * IDOR would otherwise slip through.
 *
 * No I/O: `authenticate` already loaded the memberships with the user, so a
 * revoked owner stops being an owner on their very next request.
 */

export interface VenueAuthContext extends AuthContext {
  venueId: string;
  /**
   * Null when the caller is not staff at this CT — including a super admin, who
   * needs no membership because their authority is account-wide.
   */
  venueRole: VenueRole | null;
}

export function venueRoleAt(auth: AuthContext, venueId: string): VenueRole | null {
  return auth.memberships.find((membership) => membership.venueId === venueId)?.role ?? null;
}

/** What the caller may do inside one CT. Refuses nothing. */
export function venueAuthFor(auth: AuthContext, venueId: string): VenueAuthContext {
  const venueRole = venueRoleAt(auth, venueId);

  return {
    ...auth,
    venueId,
    venueRole,
    permissions: permissionsInVenue(auth.role, venueRole),
  };
}

/**
 * Narrows to one CT and refuses unless the caller's authority there covers
 * `required`. Returns the scoped context so callers do not resolve it twice.
 */
export function requireVenuePermission(
  auth: AuthContext,
  venueId: string,
  ...required: Permission[]
): VenueAuthContext {
  const scoped = venueAuthFor(auth, venueId);

  if (!hasAllPermissions(scoped.permissions, required)) {
    throw forbidden(ERROR_CODES.FORBIDDEN);
  }

  return scoped;
}

/** The CTs this person runs. Empty for a professor, and for everyone else. */
export function ownedVenueIds(auth: AuthContext): string[] {
  return auth.memberships
    .filter((membership) => membership.role === VENUE_ROLES.OWNER)
    .map((membership) => membership.venueId);
}

/** Every CT this person is staff at, whatever their capacity there. */
export function staffVenueIds(auth: AuthContext): string[] {
  return auth.memberships.map((membership) => membership.venueId);
}
