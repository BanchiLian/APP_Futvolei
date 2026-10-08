import {
  BOOKING_STATUSES,
  PERMISSIONS,
  hasPermission,
  toIso,
  type VenuePeopleDto,
  type VenuePeopleQuery,
  type VenuePersonDto,
} from '@futcheck/shared';

import { prisma } from '../../lib/prisma.js';
import { requireVenuePermission } from '../../lib/venueAccess.js';
import type { AuthContext } from '../../types/express.js';

/**
 * The people of one CT.
 *
 * There is no enrolment table: someone belongs to a CT because they answered for
 * its sessions. That is the honest definition — it is the same thing the arena
 * means by "meus alunos" — and it needs no migration and no second source of
 * truth to drift from the bookings.
 *
 * Two levels of visibility, both scoped to this CT and nothing beyond it:
 *
 * - whoever runs the CT sees the players **and** the staff, with account labels;
 * - whoever teaches there sees the players only, without labels, because who is
 *   staff and what someone's plan is are the owner's business.
 */

/** Statuses that mean the person was actually expected, not just browsing. */
const COUNTS_AS_BOOKED = [
  BOOKING_STATUSES.CONFIRMADA,
  BOOKING_STATUSES.PRESENTE,
  BOOKING_STATUSES.FALTOU,
  BOOKING_STATUSES.LISTA_ESPERA,
];

export async function listVenuePeople(
  auth: AuthContext,
  venueId: string,
  query: VenuePeopleQuery,
): Promise<VenuePeopleDto> {
  const scoped = requireVenuePermission(auth, venueId, PERMISSIONS.VENUE_PEOPLE_VIEW);

  const seesStaff = hasPermission(scoped.permissions, PERMISSIONS.VENUE_STAFF_MANAGE);
  const seesLabels = hasPermission(scoped.permissions, PERMISSIONS.USER_ROLE_LABEL_VIEW);

  const search = query.q?.trim();

  // Everyone with a booking at this CT, with their counts in one grouped query
  // rather than one per person.
  const grouped = await prisma.booking.groupBy({
    by: ['userId'],
    where: {
      session: { venueId },
      status: { in: COUNTS_AS_BOOKED },
    },
    _count: { _all: true },
  });

  const attendedRows = await prisma.booking.groupBy({
    by: ['userId'],
    where: { session: { venueId }, status: BOOKING_STATUSES.PRESENTE },
    _count: { _all: true },
  });

  const lastRows = await prisma.booking.groupBy({
    by: ['userId'],
    where: { session: { venueId }, status: { in: COUNTS_AS_BOOKED } },
    _max: { createdAt: true },
  });

  const attended = new Map(attendedRows.map((row) => [row.userId, row._count._all]));
  const lastSeen = new Map(lastRows.map((row) => [row.userId, row._max.createdAt]));
  const booked = new Map(grouped.map((row) => [row.userId, row._count._all]));

  const memberships = await prisma.venueMember.findMany({
    where: { venueId },
    select: { userId: true, role: true },
  });

  const venueRoleOf = new Map(memberships.map((member) => [member.userId, member.role]));

  // The staff belong to the CT even before they have played there, so their ids
  // are unioned with the ones that came from bookings.
  const ids = [...new Set([...booked.keys(), ...venueRoleOf.keys()])];

  if (ids.length === 0) return { staff: [], players: [] };

  const users = await prisma.user.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      avatarThumbnailUrl: true,
      skillLevel: true,
      role: true,
    },
    orderBy: { name: 'asc' },
  });

  const people: VenuePersonDto[] = users.map((user) => {
    const when = lastSeen.get(user.id);

    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarThumbnailUrl ?? user.avatarUrl,
      skillLevel: user.skillLevel,
      venueRole: venueRoleOf.get(user.id) ?? null,
      // Withheld from a professor: the product's promise is that an account
      // label is not something other members get to read (section 4.2).
      role: seesLabels ? user.role : null,
      attended: attended.get(user.id) ?? 0,
      booked: booked.get(user.id) ?? 0,
      lastSeenAt: when ? toIso(when) : null,
    };
  });

  return {
    staff: seesStaff ? people.filter((person) => person.venueRole !== null) : [],
    // A professor sees the players; the staff list is not theirs to read.
    players: people.filter((person) => person.venueRole === null),
  };
}
