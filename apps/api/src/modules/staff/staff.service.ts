import {
  PERMISSIONS,
  VENUE_ROLES,
  hasPermission,
  permissionsInVenue,
  type SessionSummaryDto,
  type VenueAdminDto,
  type VenueRole,
} from '@futcheck/shared';

import { prisma } from '../../lib/prisma.js';
import { ownedVenueIds, venueRoleAt } from '../../lib/venueAccess.js';
import type { AuthContext } from '../../types/express.js';
import { SESSION_SUMMARY_SELECT, buildSessionSummaries } from '../sessions/session.summaries.js';

/**
 * Everything the staff panel opens with.
 *
 * One call, because the three kinds of staff need the same screen filled from
 * different angles: whoever runs a CT needs its whole day, whoever teaches needs
 * only the sessions they answer for, and the super admin needs to pick a CT
 * first. Three endpoints would have put that branching in the client, where it
 * could disagree with the server.
 */

const VENUE_ADMIN_SELECT = {
  id: true,
  name: true,
  description: true,
  address: true,
  city: true,
  state: true,
  latitude: true,
  longitude: true,
  phone: true,
  instagram: true,
  isActive: true,
  source: true,
} as const;

type VenueRow = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  latitude: unknown;
  longitude: unknown;
  phone: string | null;
  instagram: string | null;
  isActive: boolean;
  source: string;
};

export function toVenueAdminDto(venue: VenueRow, myRole: VenueRole | null): VenueAdminDto {
  return {
    id: venue.id,
    name: venue.name,
    description: venue.description,
    address: venue.address,
    city: venue.city,
    state: venue.state,
    latitude: Number(venue.latitude),
    longitude: Number(venue.longitude),
    phone: venue.phone,
    instagram: venue.instagram,
    isActive: venue.isActive,
    source: venue.source,
    myRole,
  };
}

/**
 * The CTs this person may act in.
 *
 * A super admin has authority everywhere, but "everywhere" is ninety CTs and
 * growing, so they get the ones they are explicitly attached to plus a search;
 * listing the whole network here would make the panel slower the more the
 * product succeeds.
 */
export async function listMyVenues(auth: AuthContext, search?: string): Promise<VenueAdminDto[]> {
  const isNetworkWide = hasPermission(auth.permissions, PERMISSIONS.ADMIN_MANAGE);
  const memberVenueIds = auth.memberships.map((membership) => membership.venueId);

  const where = isNetworkWide
    ? search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : { id: { in: memberVenueIds } }
    : { id: { in: memberVenueIds } };

  const venues = await prisma.venue.findMany({
    where,
    select: VENUE_ADMIN_SELECT,
    orderBy: { name: 'asc' },
    take: 30,
  });

  return venues.map((venue) => toVenueAdminDto(venue, venueRoleAt(auth, venue.id)));
}

/**
 * The sessions the panel should show.
 *
 * Whoever runs a CT sees everything that happens there, including sessions
 * another professor answers for — that was the gap: the panel used to show only
 * "mine", which is right for a professor and wrong for an owner.
 */
export async function listPanelSessions(
  auth: AuthContext,
  range: { from: Date; to: Date },
  venueId?: string,
): Promise<SessionSummaryDto[]> {
  const owned = ownedVenueIds(auth);
  const isNetworkWide = hasPermission(auth.permissions, PERMISSIONS.ADMIN_MANAGE);

  /** A CT whose whole agenda this caller may see. */
  function runsWholeVenue(id: string): boolean {
    if (isNetworkWide) return true;
    return hasPermission(
      permissionsInVenue(auth.role, venueRoleAt(auth, id)),
      PERMISSIONS.ATTENDANCE_MANAGE_ANY,
    );
  }

  const whereVenue =
    venueId && runsWholeVenue(venueId)
      ? { venueId }
      : venueId
        ? { venueId, responsibleId: auth.userId }
        : {
            OR: [
              // Everything at the CTs this person runs...
              ...(owned.length > 0 ? [{ venueId: { in: owned } }] : []),
              // ...plus whatever they personally answer for, anywhere.
              { responsibleId: auth.userId },
            ],
          };

  const sessions = await prisma.session.findMany({
    where: { ...whereVenue, startsAt: { gte: range.from, lte: range.to } },
    select: { ...SESSION_SUMMARY_SELECT, venueId: true, responsibleId: true },
    orderBy: { startsAt: 'asc' },
    take: 200,
  });

  return buildSessionSummaries(sessions, auth.userId);
}

/** Is this person staff anywhere at all? Drives whether the panel is offered. */
export function isStaffSomewhere(auth: AuthContext): boolean {
  return auth.memberships.length > 0 || hasPermission(auth.permissions, PERMISSIONS.ADMIN_MANAGE);
}

/** The CTs this person owns, for screens that may only act on those. */
export function ownedVenues(auth: AuthContext): string[] {
  return auth.memberships
    .filter((membership) => membership.role === VENUE_ROLES.OWNER)
    .map((membership) => membership.venueId);
}
