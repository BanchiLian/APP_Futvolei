import {
  BOOKING_STATUSES,
  ERROR_CODES,
  PERMISSIONS,
  SESSION_STATUSES,
  SESSION_TYPES,
  addDays,
  businessDateKeyRange,
  businessDateTime,
  businessWeekday,
  hasPermission,
  type SessionDetailDto,
  type SessionSummaryDto,
  type SessionsQuery,
} from '@futcheck/shared';

import { notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthContext } from '../../types/express.js';
import { rsvpAvailability } from '../bookings/rsvpRules.js';
import { getSettings } from '../settings/settings.repository.js';
import { toPublicUserSummary } from '../users/user.serializer.js';
import {
  SESSION_SUMMARY_SELECT,
  buildSessionSummaries,
  visibleSessionTypes,
} from './session.summaries.js';

const DEFAULT_RANGE_DAYS = 14;
const MAX_SESSIONS = 200;

/** Open and cancelled sessions: a cancellation is news the user needs to see. */
const LISTED_STATUSES = [SESSION_STATUSES.ABERTA, SESSION_STATUSES.CANCELADA];

export async function listSessions(
  auth: AuthContext,
  query: SessionsQuery,
): Promise<SessionSummaryDto[]> {
  const allowed = visibleSessionTypes(auth.permissions);
  const types = query.type ? allowed.filter((type) => type === query.type) : allowed;

  if (types.length === 0) return [];

  const from = query.from ?? new Date();
  const to = query.to ?? addDays(from, DEFAULT_RANGE_DAYS);

  const rows = await prisma.session.findMany({
    where: {
      type: { in: types },
      status: { in: LISTED_STATUSES },
      startsAt: { gte: from, lt: to },
      venue: { isActive: true },
      ...(query.venueId ? { venueId: query.venueId } : {}),
    },
    select: SESSION_SUMMARY_SELECT,
    orderBy: { startsAt: 'asc' },
    take: MAX_SESSIONS,
  });

  return buildSessionSummaries(rows, auth.userId);
}

/**
 * A session the caller may not see answers exactly like one that does not exist:
 * 404, not 403, so the aula agenda cannot be probed by id from a dayuse account.
 */
export async function getSessionDetail(
  auth: AuthContext,
  sessionId: string,
): Promise<SessionDetailDto> {
  const row = await prisma.session.findFirst({
    where: {
      id: sessionId,
      type: { in: visibleSessionTypes(auth.permissions) },
      venue: { isActive: true },
    },
    select: SESSION_SUMMARY_SELECT,
  });

  if (!row) {
    throw notFound(ERROR_CODES.NOT_FOUND, 'Sessão não encontrada.');
  }

  const canSeeAttendees = hasPermission(
    auth.permissions,
    row.type === SESSION_TYPES.AULA
      ? PERMISSIONS.SESSION_ATTENDEES_VIEW_AULA
      : PERMISSIONS.SESSION_ATTENDEES_VIEW_DAYUSE,
  );

  const [[summary], settings, attendees] = await Promise.all([
    buildSessionSummaries([row], auth.userId),
    getSettings(),
    canSeeAttendees
      ? prisma.booking.findMany({
          where: {
            sessionId,
            status: { in: [BOOKING_STATUSES.CONFIRMADA, BOOKING_STATUSES.PRESENTE] },
            user: { isActive: true, deletedAt: null },
          },
          // First to confirm, first listed.
          orderBy: { respondedAt: 'asc' },
          // Name and photo only (LGPD, section 11).
          select: {
            user: { select: { id: true, name: true, avatarUrl: true, avatarThumbnailUrl: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  if (!summary) {
    throw notFound(ERROR_CODES.NOT_FOUND, 'Sessão não encontrada.');
  }

  const availability = rsvpAvailability({
    session: { type: row.type, status: row.status, startsAt: row.startsAt },
    now: new Date(),
    settings,
    permissions: auth.permissions,
    currentStatus: summary.myBookingStatus,
  });

  return {
    ...summary,
    attendees: attendees.map((booking) => toPublicUserSummary(booking.user)),
    rsvp: {
      canAnswer: availability.canAnswer,
      blockedReason: availability.blockedReason,
      opensAt: availability.window.opensAt.toISOString(),
      changeDeadline: availability.window.changeDeadline.toISOString(),
    },
  };
}

// -----------------------------------------------------------------------------
// Generation from the weekly grids
// -----------------------------------------------------------------------------

export interface GenerationResult {
  created: number;
  considered: number;
}

/**
 * Materialises the sessions of the next N weeks from every active grid of every
 * active CT.
 *
 * Idempotent by construction, not by checking first: `createMany` with
 * `skipDuplicates` becomes `ON CONFLICT DO NOTHING` against the unique
 * `(template_id, starts_at)` key, so running it twice — or two instances running
 * it at once — can never duplicate a session (ADR-09).
 *
 * Weekdays and wall-clock times are resolved in the business timezone, so a
 * Sunday 19:00 dayuse is Sunday 19:00 in São Paulo whatever the server clock says.
 */
export async function generateSessions(
  options: { from?: Date; weeks?: number } = {},
): Promise<GenerationResult> {
  const from = options.from ?? new Date();
  const weeks = options.weeks ?? (await getSettings())['sessions.generationWeeksAhead'];

  const templates = await prisma.scheduleTemplate.findMany({
    where: { isActive: true, venue: { isActive: true } },
    select: {
      id: true,
      venueId: true,
      type: true,
      weekday: true,
      startTime: true,
      endTime: true,
      capacity: true,
      responsibleId: true,
      title: true,
    },
  });

  const data: Array<{
    templateId: string;
    venueId: string;
    type: (typeof templates)[number]['type'];
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    responsibleId: string | null;
    title: string | null;
  }> = [];

  for (const dateKey of businessDateKeyRange(from, weeks * 7)) {
    // Noon is safely inside the day whatever the offset, so it names the weekday.
    const weekday = businessWeekday(businessDateTime(dateKey, '12:00'));

    for (const template of templates) {
      if (template.weekday !== weekday) continue;

      const startsAt = businessDateTime(dateKey, template.startTime);
      if (startsAt <= from) continue;

      data.push({
        templateId: template.id,
        venueId: template.venueId,
        type: template.type,
        startsAt,
        endsAt: businessDateTime(dateKey, template.endTime),
        capacity: template.capacity,
        responsibleId: template.responsibleId,
        title: template.title,
      });
    }
  }

  const { count } = await prisma.session.createMany({ data, skipDuplicates: true });

  logger.info({ created: count, considered: data.length, weeks }, 'sessions generated');

  return { created: count, considered: data.length };
}
