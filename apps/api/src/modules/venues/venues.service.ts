import {
  ERROR_CODES,
  SESSION_STATUSES,
  SESSION_TYPES,
  addDays,
  type SessionType,
  type VenueDetailDto,
  type VenueSummaryDto,
  type VenuesQuery,
} from '@futcheck/shared';

import type { Prisma } from '../../generated/prisma/client.js';
import { notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthContext } from '../../types/express.js';
import {
  SESSION_SUMMARY_SELECT,
  buildSessionSummaries,
  visibleSessionTypes,
} from '../sessions/session.summaries.js';
import { distanceKm, roundKm } from './geo.js';

const VENUE_SELECT = {
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
  // What the CT offers is derived from its live grid, never stored (schema note).
  templates: { where: { isActive: true }, select: { type: true }, distinct: ['type'] },
} satisfies Prisma.VenueSelect;

interface Coordinates {
  latitude: number;
  longitude: number;
}

function coordinatesFrom(query: Pick<VenuesQuery, 'lat' | 'lng'>): Coordinates | null {
  return query.lat !== undefined && query.lng !== undefined
    ? { latitude: query.lat, longitude: query.lng }
    : null;
}

type VenueRow = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: { toNumber(): number };
  longitude: { toNumber(): number };
  templates: Array<{ type: SessionType }>;
};

function baseSummary(
  venue: VenueRow,
  origin: Coordinates | null,
): Omit<VenueSummaryDto, 'nextDayuse'> {
  const point = { latitude: venue.latitude.toNumber(), longitude: venue.longitude.toNumber() };
  const types = new Set(venue.templates.map((template) => template.type));

  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    city: venue.city,
    state: venue.state,
    ...point,
    distanceKm: origin ? roundKm(distanceKm(origin, point)) : null,
    offersDayuse: types.has(SESSION_TYPES.DAYUSE),
    offersAula: types.has(SESSION_TYPES.AULA),
  };
}

/**
 * CTs near the caller, closest first — or alphabetical when no coordinates were
 * sent (the user declined location, or the browser has none).
 *
 * The coordinates are used for this one sort and discarded: they are neither
 * stored nor logged. Location is sensitive personal data under the LGPD.
 */
export async function listVenues(
  auth: AuthContext,
  query: VenuesQuery,
): Promise<VenueSummaryDto[]> {
  const origin = coordinatesFrom(query);

  const venues = await prisma.venue.findMany({
    where: {
      isActive: true,
      ...(query.dayuse === 'true'
        ? { templates: { some: { isActive: true, type: SESSION_TYPES.DAYUSE } } }
        : {}),
    },
    select: VENUE_SELECT,
    orderBy: { name: 'asc' },
  });

  const summaries = venues.map((venue) => baseSummary(venue, origin));

  // The next open dayuse per CT, in one query: `distinct` keeps the first row of
  // each venue once ordered by start time.
  const canSeeDayuse = visibleSessionTypes(auth.permissions).includes(SESSION_TYPES.DAYUSE);
  const nextRows = canSeeDayuse
    ? await prisma.session.findMany({
        where: {
          venueId: { in: venues.map((venue) => venue.id) },
          type: SESSION_TYPES.DAYUSE,
          status: SESSION_STATUSES.ABERTA,
          startsAt: { gt: new Date() },
        },
        orderBy: [{ venueId: 'asc' }, { startsAt: 'asc' }],
        distinct: ['venueId'],
        select: SESSION_SUMMARY_SELECT,
      })
    : [];

  const nextByVenue = new Map(
    (await buildSessionSummaries(nextRows, auth.userId)).map((summary) => [
      summary.venue.id,
      summary,
    ]),
  );

  const result = summaries.map((summary) => ({
    ...summary,
    nextDayuse: nextByVenue.get(summary.id) ?? null,
  }));

  if (origin) {
    result.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }

  return result;
}

const UPCOMING_DAYS = 14;
const UPCOMING_LIMIT = 30;

export async function getVenueDetail(
  auth: AuthContext,
  venueId: string,
  query: Pick<VenuesQuery, 'lat' | 'lng'>,
): Promise<VenueDetailDto> {
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, isActive: true },
    select: VENUE_SELECT,
  });

  if (!venue) {
    throw notFound(ERROR_CODES.NOT_FOUND, 'CT não encontrado.');
  }

  const now = new Date();
  const types = visibleSessionTypes(auth.permissions);

  const rows = types.length
    ? await prisma.session.findMany({
        where: {
          venueId,
          type: { in: types },
          status: { in: [SESSION_STATUSES.ABERTA, SESSION_STATUSES.CANCELADA] },
          startsAt: { gt: now, lt: addDays(now, UPCOMING_DAYS) },
        },
        orderBy: { startsAt: 'asc' },
        take: UPCOMING_LIMIT,
        select: SESSION_SUMMARY_SELECT,
      })
    : [];

  const upcomingSessions = await buildSessionSummaries(rows, auth.userId);

  return {
    ...baseSummary(venue, coordinatesFrom(query)),
    description: venue.description,
    phone: venue.phone,
    instagram: venue.instagram,
    nextDayuse:
      upcomingSessions.find(
        (session) =>
          session.type === SESSION_TYPES.DAYUSE && session.status === SESSION_STATUSES.ABERTA,
      ) ?? null,
    upcomingSessions,
  };
}
