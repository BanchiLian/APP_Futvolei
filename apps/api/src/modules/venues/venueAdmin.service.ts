import {
  BOOKING_STATUSES,
  ERROR_CODES,
  PERMISSIONS,
  SESSION_STATUSES,
  SESSION_TYPES,
  VENUE_ROLES,
  now,
  toIso,
  type CancelSessionInput,
  type ScheduleTemplateDto,
  type ScheduleTemplateInput,
  type VenueAdminDto,
  type VenueStaffInput,
  type VenueStaffDto,
  type VenueWriteInput,
  type Weekday,
} from '@futcheck/shared';

import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { recordAudit } from '../../lib/audit.js';
import { requireVenuePermission, venueRoleAt } from '../../lib/venueAccess.js';
import type { AuthContext } from '../../types/express.js';
import { toVenueAdminDto } from '../staff/staff.service.js';

/**
 * Running a CT.
 *
 * Every function here narrows to the CT first. The route can only ask whether
 * this kind of account could ever manage a CT; whether it may manage *this* one
 * is a question only the service can answer, and skipping it is how one owner
 * would end up editing another owner's arena.
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

const PERSON_SELECT = { id: true, name: true, avatarUrl: true, avatarThumbnailUrl: true } as const;

function avatarOf(user: { avatarUrl: string | null; avatarThumbnailUrl: string | null }) {
  return user.avatarThumbnailUrl ?? user.avatarUrl;
}

// -----------------------------------------------------------------------------
// The CT itself
// -----------------------------------------------------------------------------

export async function getVenueForAdmin(auth: AuthContext, venueId: string): Promise<VenueAdminDto> {
  requireVenuePermission(auth, venueId, PERMISSIONS.VENUE_MANAGE);

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: VENUE_ADMIN_SELECT,
  });
  if (!venue) throw notFound(ERROR_CODES.NOT_FOUND);

  return toVenueAdminDto(venue, venueRoleAt(auth, venueId));
}

export async function updateVenue(
  auth: AuthContext,
  venueId: string,
  input: VenueWriteInput,
): Promise<VenueAdminDto> {
  requireVenuePermission(auth, venueId, PERMISSIONS.VENUE_MANAGE);

  const venue = await prisma.venue.update({
    where: { id: venueId },
    data: {
      name: input.name,
      description: input.description ?? null,
      address: input.address,
      city: input.city,
      state: input.state,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: input.phone ?? null,
      instagram: input.instagram ?? null,
      // An edited CT is no longer just what OpenStreetMap said about it.
      source: 'MANUAL',
      externalId: null,
    },
    select: VENUE_ADMIN_SELECT,
  });

  await recordAudit({
    actorId: auth.userId,
    action: 'venue.updated',
    entity: 'venue',
    entityId: venueId,
    metadata: { name: input.name },
  });

  return toVenueAdminDto(venue, venueRoleAt(auth, venueId));
}

/**
 * Creates a CT and hands it to an owner.
 *
 * Network-level on purpose: a CT appearing in the directory is a decision about
 * the network, so it needs `ADMIN_MANAGE`, which only the super admin holds. The
 * owner then runs it without ever being able to create another.
 */
export async function createVenue(
  auth: AuthContext,
  input: VenueWriteInput & { ownerId?: string | null },
): Promise<VenueAdminDto> {
  const venue = await prisma.$transaction(async (tx) => {
    const created = await tx.venue.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        address: input.address,
        city: input.city,
        state: input.state,
        latitude: input.latitude,
        longitude: input.longitude,
        phone: input.phone ?? null,
        instagram: input.instagram ?? null,
        source: 'MANUAL',
      },
      select: VENUE_ADMIN_SELECT,
    });

    if (input.ownerId) {
      await tx.venueMember.create({
        data: { venueId: created.id, userId: input.ownerId, role: VENUE_ROLES.OWNER },
      });
    }

    return created;
  });

  await recordAudit({
    actorId: auth.userId,
    action: 'venue.created',
    entity: 'venue',
    entityId: venue.id,
    metadata: { name: input.name, ownerId: input.ownerId ?? null },
  });

  return toVenueAdminDto(venue, input.ownerId === auth.userId ? VENUE_ROLES.OWNER : null);
}

// -----------------------------------------------------------------------------
// Who runs it
// -----------------------------------------------------------------------------

export async function listStaff(auth: AuthContext, venueId: string): Promise<VenueStaffDto[]> {
  requireVenuePermission(auth, venueId, PERMISSIONS.VENUE_STAFF_MANAGE);

  const members = await prisma.venueMember.findMany({
    where: { venueId },
    select: { role: true, createdAt: true, user: { select: PERSON_SELECT } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });

  return members.map((member) => ({
    userId: member.user.id,
    name: member.user.name,
    avatarUrl: avatarOf(member.user),
    role: member.role,
    since: toIso(member.createdAt),
  }));
}

export async function setStaff(
  auth: AuthContext,
  venueId: string,
  input: VenueStaffInput,
): Promise<VenueStaffDto[]> {
  requireVenuePermission(auth, venueId, PERMISSIONS.VENUE_STAFF_MANAGE);

  const user = await prisma.user.findFirst({
    where: { id: input.userId, deletedAt: null, isActive: true },
    select: { id: true },
  });

  if (!user) throw notFound(ERROR_CODES.NOT_FOUND);

  await prisma.venueMember.upsert({
    where: { venueId_userId: { venueId, userId: input.userId } },
    create: { venueId, userId: input.userId, role: input.role },
    update: { role: input.role },
  });

  await recordAudit({
    actorId: auth.userId,
    action: 'venue.staff.set',
    entity: 'venue',
    entityId: venueId,
    metadata: { userId: input.userId, role: input.role },
  });

  return listStaff(auth, venueId);
}

export async function removeStaff(
  auth: AuthContext,
  venueId: string,
  userId: string,
): Promise<VenueStaffDto[]> {
  requireVenuePermission(auth, venueId, PERMISSIONS.VENUE_STAFF_MANAGE);

  const owners = await prisma.venueMember.count({
    where: { venueId, role: VENUE_ROLES.OWNER },
  });

  const target = await prisma.venueMember.findUnique({
    where: { venueId_userId: { venueId, userId } },
    select: { role: true },
  });

  if (!target) throw notFound(ERROR_CODES.NOT_FOUND);

  // A CT with nobody in charge is unrunnable, and nothing else in the product
  // would notice. Refusing here is cheaper than discovering it later.
  if (target.role === VENUE_ROLES.OWNER && owners <= 1) {
    throw conflict(ERROR_CODES.CONFLICT, 'O CT ficaria sem nenhum dono.');
  }

  await prisma.venueMember.delete({ where: { venueId_userId: { venueId, userId } } });

  await recordAudit({
    actorId: auth.userId,
    action: 'venue.staff.removed',
    entity: 'venue',
    entityId: venueId,
    metadata: { userId },
  });

  return listStaff(auth, venueId);
}

// -----------------------------------------------------------------------------
// The weekly grid
// -----------------------------------------------------------------------------

const TEMPLATE_SELECT = {
  id: true,
  type: true,
  weekday: true,
  startTime: true,
  endTime: true,
  capacity: true,
  title: true,
  isActive: true,
  responsible: { select: PERSON_SELECT },
} as const;

type TemplateRow = {
  id: string;
  type: (typeof SESSION_TYPES)[keyof typeof SESSION_TYPES];
  weekday: number;
  startTime: string;
  endTime: string;
  capacity: number;
  title: string | null;
  isActive: boolean;
  responsible: {
    id: string;
    name: string;
    avatarUrl: string | null;
    avatarThumbnailUrl: string | null;
  } | null;
};

function toTemplateDto(row: TemplateRow): ScheduleTemplateDto {
  return {
    id: row.id,
    type: row.type,
    weekday: row.weekday as Weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    capacity: row.capacity,
    title: row.title,
    isActive: row.isActive,
    responsible: row.responsible
      ? {
          id: row.responsible.id,
          name: row.responsible.name,
          avatarUrl: avatarOf(row.responsible),
        }
      : null,
  };
}

export async function listSchedule(
  auth: AuthContext,
  venueId: string,
): Promise<ScheduleTemplateDto[]> {
  requireVenuePermission(auth, venueId, PERMISSIONS.SCHEDULE_MANAGE);

  const rows = await prisma.scheduleTemplate.findMany({
    where: { venueId },
    select: TEMPLATE_SELECT,
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
  });

  return rows.map(toTemplateDto);
}

/** The rules the database also enforces, checked here to answer in Portuguese. */
async function assertTemplateIsSound(venueId: string, input: ScheduleTemplateInput): Promise<void> {
  if (input.endTime <= input.startTime) {
    throw unprocessable(ERROR_CODES.VALIDATION_ERROR, 'O fim precisa ser depois do início.');
  }

  if (input.type === SESSION_TYPES.AULA && !input.responsibleId) {
    throw unprocessable(ERROR_CODES.SCHEDULE_RESPONSIBLE_REQUIRED);
  }

  if (input.responsibleId) {
    const teaches = await prisma.venueMember.findUnique({
      where: { venueId_userId: { venueId, userId: input.responsibleId } },
      select: { userId: true },
    });

    // The responsible has to be staff *here*: otherwise a CT could put someone
    // else's professor on its grid, and that person would then be able to mark
    // attendance at a CT they never agreed to work at.
    if (!teaches) {
      throw unprocessable(
        ERROR_CODES.VALIDATION_ERROR,
        'O responsável precisa fazer parte da equipe deste CT.',
      );
    }
  }
}

export async function createTemplate(
  auth: AuthContext,
  venueId: string,
  input: ScheduleTemplateInput,
): Promise<ScheduleTemplateDto> {
  requireVenuePermission(auth, venueId, PERMISSIONS.SCHEDULE_MANAGE);
  await assertTemplateIsSound(venueId, input);

  const row = await prisma.scheduleTemplate.create({
    data: {
      venueId,
      type: input.type,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      capacity: input.capacity,
      title: input.title ?? null,
      responsibleId: input.responsibleId ?? null,
      isActive: input.isActive,
    },
    select: TEMPLATE_SELECT,
  });

  await recordAudit({
    actorId: auth.userId,
    action: 'schedule.created',
    entity: 'schedule_template',
    entityId: row.id,
    metadata: { venueId, type: input.type, weekday: input.weekday, startTime: input.startTime },
  });

  return toTemplateDto(row);
}

export async function updateTemplate(
  auth: AuthContext,
  venueId: string,
  templateId: string,
  input: ScheduleTemplateInput,
): Promise<ScheduleTemplateDto> {
  requireVenuePermission(auth, venueId, PERMISSIONS.SCHEDULE_MANAGE);
  await assertTemplateIsSound(venueId, input);

  const existing = await prisma.scheduleTemplate.findFirst({
    where: { id: templateId, venueId },
    select: { id: true },
  });

  if (!existing) throw notFound(ERROR_CODES.NOT_FOUND);

  const row = await prisma.scheduleTemplate.update({
    where: { id: templateId },
    data: {
      type: input.type,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      capacity: input.capacity,
      title: input.title ?? null,
      responsibleId: input.responsibleId ?? null,
      isActive: input.isActive,
    },
    select: TEMPLATE_SELECT,
  });

  await recordAudit({
    actorId: auth.userId,
    action: 'schedule.updated',
    entity: 'schedule_template',
    entityId: templateId,
    metadata: { venueId },
  });

  return toTemplateDto(row);
}

/**
 * Takes a slot off the grid.
 *
 * Deactivates rather than deletes whenever sessions were already generated from
 * it: those sessions have people booked, and the history of who played where is
 * the point of the product.
 */
export async function removeTemplate(
  auth: AuthContext,
  venueId: string,
  templateId: string,
): Promise<{ deleted: boolean }> {
  requireVenuePermission(auth, venueId, PERMISSIONS.SCHEDULE_MANAGE);

  const template = await prisma.scheduleTemplate.findFirst({
    where: { id: templateId, venueId },
    select: { id: true, _count: { select: { sessions: true } } },
  });

  if (!template) throw notFound(ERROR_CODES.NOT_FOUND);

  const hasHistory = template._count.sessions > 0;

  if (hasHistory) {
    await prisma.scheduleTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });
  } else {
    await prisma.scheduleTemplate.delete({ where: { id: templateId } });
  }

  await recordAudit({
    actorId: auth.userId,
    action: hasHistory ? 'schedule.deactivated' : 'schedule.deleted',
    entity: 'schedule_template',
    entityId: templateId,
    metadata: { venueId },
  });

  return { deleted: !hasHistory };
}

// -----------------------------------------------------------------------------
// Calling off a session
// -----------------------------------------------------------------------------

/**
 * Cancels a session — rain, a holiday, a court that flooded.
 *
 * Everyone's answer is preserved as CANCELADA_PELA_ARENA instead of deleted, so
 * the history stays honest and nobody is recorded as having missed something the
 * arena called off.
 */
export async function cancelSession(
  auth: AuthContext,
  sessionId: string,
  input: CancelSessionInput,
): Promise<{ cancelled: number }> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, venueId: true, status: true },
  });

  if (!session) throw notFound(ERROR_CODES.NOT_FOUND);

  requireVenuePermission(auth, session.venueId, PERMISSIONS.SESSION_MANAGE);

  if (session.status === SESSION_STATUSES.CANCELADA) {
    throw conflict(ERROR_CODES.SESSION_ALREADY_CANCELLED);
  }

  const cancelledAt = now();

  const affected = await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: sessionId },
      data: { status: SESSION_STATUSES.CANCELADA, cancelReason: input.reason, cancelledAt },
    });

    const { count } = await tx.booking.updateMany({
      where: {
        sessionId,
        status: { in: [BOOKING_STATUSES.CONFIRMADA, BOOKING_STATUSES.LISTA_ESPERA] },
      },
      data: { status: BOOKING_STATUSES.CANCELADA_PELA_ARENA, waitlistPosition: null },
    });

    return count;
  });

  await recordAudit({
    actorId: auth.userId,
    action: 'session.cancelled',
    entity: 'session',
    entityId: sessionId,
    metadata: { venueId: session.venueId, reason: input.reason, affected },
  });

  return { cancelled: affected };
}
