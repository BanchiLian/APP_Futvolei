import {
  BOOKING_STATUSES,
  PERMISSIONS,
  SEAT_TAKING_STATUSES,
  SESSION_TYPES,
  hasPermission,
  type BookingStatus,
  type Permission,
  type SessionStatus,
  type SessionSummaryDto,
  type SessionType,
} from '@futcheck/shared';

import { prisma } from '../../lib/prisma.js';
import { toPublicUserSummary } from '../users/user.serializer.js';

/** Everything a session summary needs, and nothing else (no N+1, no over-fetch). */
export const SESSION_SUMMARY_SELECT = {
  id: true,
  type: true,
  status: true,
  startsAt: true,
  endsAt: true,
  title: true,
  capacity: true,
  cancelReason: true,
  venue: { select: { id: true, name: true } },
  responsible: {
    select: { id: true, name: true, avatarUrl: true, avatarThumbnailUrl: true },
  },
} as const;

export interface SessionRow {
  id: string;
  type: SessionType;
  status: SessionStatus;
  startsAt: Date;
  endsAt: Date;
  title: string | null;
  capacity: number;
  cancelReason: string | null;
  venue: { id: string; name: string };
  responsible: {
    id: string;
    name: string;
    avatarUrl: string | null;
    avatarThumbnailUrl: string | null;
  } | null;
}

/** Session types the caller may see. The agenda is filtered by this, never by role. */
export function visibleSessionTypes(permissions: readonly Permission[]): SessionType[] {
  const types: SessionType[] = [];
  if (hasPermission(permissions, PERMISSIONS.SESSION_VIEW_AULA)) types.push(SESSION_TYPES.AULA);
  if (hasPermission(permissions, PERMISSIONS.SESSION_VIEW_DAYUSE)) types.push(SESSION_TYPES.DAYUSE);
  return types;
}

const COUNTED_STATUSES: BookingStatus[] = [...SEAT_TAKING_STATUSES, BOOKING_STATUSES.LISTA_ESPERA];

/**
 * Turns session rows into summaries with seat counts and the viewer's own answer.
 *
 * Two queries in total — one grouped count, one lookup of the viewer's bookings —
 * whatever the number of sessions, which is what keeps the agenda fast as the
 * week fills up (section 11: no N+1).
 */
export async function buildSessionSummaries(
  rows: SessionRow[],
  viewerId: string,
): Promise<SessionSummaryDto[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  const [counts, mine] = await Promise.all([
    prisma.booking.groupBy({
      by: ['sessionId', 'status'],
      where: { sessionId: { in: ids }, status: { in: COUNTED_STATUSES } },
      _count: { _all: true },
    }),
    prisma.booking.findMany({
      where: { sessionId: { in: ids }, userId: viewerId },
      select: { sessionId: true, status: true, waitlistPosition: true },
    }),
  ]);

  const confirmed = new Map<string, number>();
  const waitlisted = new Map<string, number>();

  for (const group of counts) {
    const target = group.status === BOOKING_STATUSES.LISTA_ESPERA ? waitlisted : confirmed;
    target.set(group.sessionId, (target.get(group.sessionId) ?? 0) + group._count._all);
  }

  const mineBySession = new Map(mine.map((booking) => [booking.sessionId, booking]));

  return rows.map((row) => {
    const confirmedCount = confirmed.get(row.id) ?? 0;
    const own = mineBySession.get(row.id);

    return {
      id: row.id,
      type: row.type,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      title: row.title,
      capacity: row.capacity,
      confirmedCount,
      waitlistCount: waitlisted.get(row.id) ?? 0,
      // Walk-ins can push attendance past capacity; seats never go negative.
      availableSeats: Math.max(0, row.capacity - confirmedCount),
      venue: row.venue,
      responsible: row.responsible ? toPublicUserSummary(row.responsible) : null,
      cancelReason: row.cancelReason,
      myBookingStatus: own?.status ?? null,
      myWaitlistPosition: own?.waitlistPosition ?? null,
    };
  });
}
