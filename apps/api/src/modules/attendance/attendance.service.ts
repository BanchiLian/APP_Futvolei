import {
  BOOKING_STATUSES,
  ERROR_CODES,
  PERMISSIONS,
  hasPermission,
  now,
  toIso,
  type AttendanceEntryDto,
  type AttendanceMarkInput,
  type AttendanceSheetDto,
  type BookingStatus,
  type PublicUserSummary,
  type SessionSummaryDto,
} from '@futcheck/shared';

import { AppError, badRequest, forbidden, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { recordAudit } from '../../lib/audit.js';
import { venueAuthFor } from '../../lib/venueAccess.js';
import type { AuthContext } from '../../types/express.js';
import { getSettings } from '../settings/settings.repository.js';
import { SESSION_SUMMARY_SELECT, buildSessionSummaries } from '../sessions/session.summaries.js';
import { attendanceEditability } from './attendanceRules.js';

/** Statuses that put someone on the checklist at all. */
const ON_THE_SHEET: BookingStatus[] = [
  BOOKING_STATUSES.CONFIRMADA,
  BOOKING_STATUSES.PRESENTE,
  BOOKING_STATUSES.FALTOU,
  BOOKING_STATUSES.LISTA_ESPERA,
];

/** Everything the sheet needs, plus the two ids the venue scope is resolved from. */
const SESSION_FOR_SHEET = {
  ...SESSION_SUMMARY_SELECT,
  venueId: true,
  responsibleId: true,
} as const;

/** The same shape every other screen shows a person in: name and photo only. */
function publicUser(user: {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarThumbnailUrl: string | null;
}): PublicUserSummary {
  return { id: user.id, name: user.name, avatarUrl: user.avatarThumbnailUrl ?? user.avatarUrl };
}

const PERSON_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  avatarThumbnailUrl: true,
} as const;

/**
 * Loads the session together with the caller's authority *at its CT*.
 *
 * Every attendance operation starts here, so the venue scope is never skipped:
 * a professor at one CT must not reach a sheet at another, and the route
 * middleware cannot know which CT a session id belongs to.
 */
async function sessionWithVenueScope(auth: AuthContext, sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: SESSION_FOR_SHEET,
  });

  if (!session) throw notFound(ERROR_CODES.NOT_FOUND);

  return { session, scoped: await venueAuthFor(auth, session.venueId) };
}

function editabilityFor(
  session: { status: SessionSummaryDto['status']; startsAt: Date; responsibleId: string | null },
  scopedPermissions: readonly string[],
  settings: Awaited<ReturnType<typeof getSettings>>,
  userId: string,
) {
  return attendanceEditability({
    session: { status: session.status, startsAt: session.startsAt },
    now: now(),
    settings,
    permissions: scopedPermissions as never,
    isResponsible: session.responsibleId === userId,
  });
}

export async function getAttendanceSheet(
  auth: AuthContext,
  sessionId: string,
): Promise<AttendanceSheetDto> {
  const { session, scoped } = await sessionWithVenueScope(auth, sessionId);

  const maySee =
    hasPermission(scoped.permissions, PERMISSIONS.ATTENDANCE_MANAGE_ANY) ||
    hasPermission(scoped.permissions, PERMISSIONS.ATTENDANCE_MANAGE_OWN);

  if (!maySee) throw forbidden(ERROR_CODES.FORBIDDEN);

  const settings = await getSettings();

  const bookings = await prisma.booking.findMany({
    where: { sessionId, status: { in: ON_THE_SHEET } },
    select: {
      status: true,
      isWalkIn: true,
      checkedInAt: true,
      waitlistPosition: true,
      user: { select: PERSON_SELECT },
      checkedInBy: { select: PERSON_SELECT },
    },
    orderBy: [{ status: 'asc' }, { user: { name: 'asc' } }],
  });

  const entries: AttendanceEntryDto[] = bookings.map((booking) => {
    const person = publicUser(booking.user);

    return {
      userId: person.id,
      name: person.name,
      avatarUrl: person.avatarUrl,
      status: booking.status,
      isWalkIn: booking.isWalkIn,
      checkedInAt: booking.checkedInAt ? toIso(booking.checkedInAt) : null,
      checkedInBy: booking.checkedInBy ? publicUser(booking.checkedInBy) : null,
      waitlistPosition: booking.waitlistPosition,
    };
  });

  const editability = editabilityFor(session, scoped.permissions, settings, auth.userId);

  const present = entries.filter((e) => e.status === BOOKING_STATUSES.PRESENTE).length;
  const absent = entries.filter((e) => e.status === BOOKING_STATUSES.FALTOU).length;
  const expected = entries.filter((e) => e.status !== BOOKING_STATUSES.LISTA_ESPERA).length;

  const [summary] = await buildSessionSummaries([session], auth.userId);

  return {
    session: summary as SessionSummaryDto,
    entries,
    editability: {
      canEdit: editability.canEdit,
      blockedReason: editability.blockedReason,
      opensAt: toIso(editability.opensAt),
      editDeadline: editability.editDeadline ? toIso(editability.editDeadline) : null,
    },
    summary: { expected, present, absent, pending: expected - present - absent },
  };
}

/** Refuses unless this caller may edit this sheet at this moment. */
async function assertEditable(auth: AuthContext, sessionId: string) {
  const { session, scoped } = await sessionWithVenueScope(auth, sessionId);
  const settings = await getSettings();

  const editability = editabilityFor(session, scoped.permissions, settings, auth.userId);

  if (!editability.canEdit) {
    const reason = editability.blockedReason ?? ERROR_CODES.FORBIDDEN;

    // "You may not" is a 403; "not yet" and "too late" are states of the
    // session, which is a 409.
    const status =
      reason === ERROR_CODES.FORBIDDEN || reason === ERROR_CODES.ATTENDANCE_NOT_RESPONSIBLE
        ? 403
        : 409;

    throw new AppError(reason, status);
  }

  return { session, scoped };
}

/**
 * Writes the checklist.
 *
 * The whole sheet arrives at once and the marks are absolute, never deltas, so a
 * retry over a bad connection at the arena cannot double-count anyone. Only rows
 * that actually change are written, which keeps the audit entry meaningful.
 */
export async function markAttendance(
  auth: AuthContext,
  sessionId: string,
  input: AttendanceMarkInput,
): Promise<AttendanceSheetDto> {
  const { session } = await assertEditable(auth, sessionId);

  const userIds = input.entries.map((entry) => entry.userId);

  const current = await prisma.booking.findMany({
    where: { sessionId, userId: { in: userIds } },
    select: { id: true, userId: true, status: true },
  });

  const byUser = new Map(current.map((booking) => [booking.userId, booking]));

  if (userIds.some((id) => !byUser.has(id))) {
    // Someone on the sheet has no booking here: the client is stale, or guessing
    // ids. Either way the right answer is to refuse the whole sheet.
    throw badRequest(ERROR_CODES.VALIDATION_ERROR);
  }

  const changes = input.entries.filter(
    (entry) => byUser.get(entry.userId)?.status !== entry.status,
  );
  const markedAt = now();

  if (changes.length > 0) {
    await prisma.$transaction(
      changes.map((entry) => {
        const cleared = entry.status === BOOKING_STATUSES.CONFIRMADA;

        return prisma.booking.update({
          where: { id: byUser.get(entry.userId)?.id },
          data: {
            status: entry.status,
            // Undoing a mark also clears who made it.
            checkedInAt: cleared ? null : markedAt,
            checkedInById: cleared ? null : auth.userId,
          },
        });
      }),
    );

    await recordAudit({
      actorId: auth.userId,
      action: 'attendance.marked',
      entity: 'session',
      entityId: sessionId,
      metadata: {
        venueId: session.venueId,
        changed: changes.length,
        present: changes.filter((c) => c.status === BOOKING_STATUSES.PRESENTE).length,
        absent: changes.filter((c) => c.status === BOOKING_STATUSES.FALTOU).length,
      },
    });
  }

  return getAttendanceSheet(auth, sessionId);
}

/**
 * Adds someone who turned up without answering.
 *
 * Allowed even on a full session: the person is standing on the sand, and a
 * checklist that cannot record what happened is worse than none. The seat count
 * is left alone, which is exactly why `isWalkIn` is its own column.
 */
export async function addWalkIn(
  auth: AuthContext,
  sessionId: string,
  userId: string,
): Promise<AttendanceSheetDto> {
  const { session } = await assertEditable(auth, sessionId);

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, isActive: true },
    select: { id: true },
  });

  if (!user) throw notFound(ERROR_CODES.NOT_FOUND);

  const markedAt = now();

  await prisma.booking.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    create: {
      sessionId,
      userId,
      status: BOOKING_STATUSES.PRESENTE,
      isWalkIn: true,
      checkedInAt: markedAt,
      checkedInById: auth.userId,
    },
    // Already answered: mark them present instead of creating a second row.
    update: {
      status: BOOKING_STATUSES.PRESENTE,
      checkedInAt: markedAt,
      checkedInById: auth.userId,
    },
  });

  await recordAudit({
    actorId: auth.userId,
    action: 'attendance.walk_in',
    entity: 'session',
    entityId: sessionId,
    metadata: { venueId: session.venueId, userId },
  });

  return getAttendanceSheet(auth, sessionId);
}

/** The sessions this person runs in a window — the professor's "my sessions". */
export async function listMyResponsibleSessions(
  auth: AuthContext,
  range: { from: Date; to: Date },
): Promise<SessionSummaryDto[]> {
  const sessions = await prisma.session.findMany({
    where: { responsibleId: auth.userId, startsAt: { gte: range.from, lte: range.to } },
    select: SESSION_FOR_SHEET,
    orderBy: { startsAt: 'asc' },
  });

  return buildSessionSummaries(sessions, auth.userId);
}
