import {
  BOOKING_STATUSES,
  ERROR_CODES,
  ROLES,
  superAdminPasswordSchema,
  type MeResponse,
  type SessionSummaryDto,
  type UpdateProfileInput,
} from '@futcheck/shared';

import { recordAudit } from '../../lib/audit.js';
import { badRequest, notFound, unauthorized } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { processSquareImage } from '../../lib/images.js';
import { prisma } from '../../lib/prisma.js';
import { buildKey, deleteObject, keyFromUrl, publicUrl, saveObject } from '../../lib/storage.js';
import type { AuthContext } from '../../types/express.js';
import { issueSession, type IssuedSession, type RequestContext } from '../auth/auth.service.js';
import { SESSION_SUMMARY_SELECT, buildSessionSummaries } from '../sessions/session.summaries.js';
import { USER_SAFE_SELECT, toMeResponse } from '../users/user.serializer.js';

/**
 * The caller's own account. Every function here acts on `auth.userId` and takes
 * no user id from the request, which is what makes IDOR impossible by design:
 * there is no parameter to tamper with.
 */

async function loadSelf(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: USER_SAFE_SELECT,
  });

  if (!user) throw notFound();
  return user;
}

export async function getMe(auth: AuthContext): Promise<MeResponse> {
  return toMeResponse(await loadSelf(auth.userId));
}

export async function updateMe(
  auth: AuthContext,
  input: UpdateProfileInput,
  ctx: RequestContext,
): Promise<MeResponse> {
  const before = await loadSelf(auth.userId);

  const updated = await prisma.user.update({
    where: { id: auth.userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.birthDate !== undefined
        ? { birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00Z`) : null }
        : {}),
      ...(input.skillLevel !== undefined ? { skillLevel: input.skillLevel } : {}),
      ...(input.showInCommunity !== undefined ? { showInCommunity: input.showInCommunity } : {}),
    },
    select: USER_SAFE_SELECT,
  });

  // Only the names of the fields that changed: the audit trail must not become a
  // second copy of the member's personal data.
  const changed = (Object.keys(input) as Array<keyof UpdateProfileInput>).filter(
    (key) => input[key] !== undefined,
  );

  await recordAudit({
    actorId: auth.userId,
    action: 'user.profile.updated',
    entity: 'user',
    entityId: auth.userId,
    metadata: { fields: changed, wasVisible: before.showInCommunity },
    ...ctx,
  });

  return toMeResponse(updated);
}

/**
 * Changes the caller's password after proving they know the current one.
 *
 * Every other session is revoked — a password change is often a reaction to a
 * suspected leak — and a fresh session is issued for this device, so the user who
 * just changed it is not logged out for their trouble.
 */
export async function changeMyPassword(
  auth: AuthContext,
  input: { currentPassword: string; newPassword: string },
  ctx: RequestContext,
): Promise<IssuedSession> {
  const user = await prisma.user.findFirst({
    where: { id: auth.userId, deletedAt: null },
    select: { ...USER_SAFE_SELECT, passwordHash: true },
  });

  if (!user) throw unauthorized();

  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    await recordAudit({
      actorId: auth.userId,
      action: 'user.password.change_failed',
      entity: 'user',
      entityId: auth.userId,
      ...ctx,
    });

    throw badRequest(ERROR_CODES.INVALID_CREDENTIALS, 'A senha atual está incorreta.');
  }

  // The owner account keeps its 12-character floor (section 4.1).
  if (user.role === ROLES.SUPER_ADMIN) {
    const strict = superAdminPasswordSchema.safeParse(input.newPassword);
    if (!strict.success) {
      throw badRequest(
        ERROR_CODES.PASSWORD_TOO_WEAK,
        strict.error.issues[0]?.message ?? 'A senha não atende aos requisitos mínimos.',
      );
    }
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: auth.userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId: auth.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await recordAudit({
    actorId: auth.userId,
    action: 'user.password.changed',
    entity: 'user',
    entityId: auth.userId,
    ...ctx,
  });

  const { passwordHash: _omit, ...safe } = user;
  return issueSession(safe, ctx);
}

const HISTORY_LIMIT = 50;

/** "Minhas sessões": upcoming answers, or past sessions with their attendance. */
export async function listMyBookings(
  auth: AuthContext,
  period: 'upcoming' | 'past',
): Promise<SessionSummaryDto[]> {
  const now = new Date();

  const rows = await prisma.session.findMany({
    where: {
      bookings: {
        some: {
          userId: auth.userId,
          // A decline is an answer worth remembering upcoming, noise in history.
          ...(period === 'past' ? { status: { not: BOOKING_STATUSES.NAO_VOU } } : {}),
        },
      },
      startsAt: period === 'upcoming' ? { gte: now } : { lt: now },
    },
    orderBy: { startsAt: period === 'upcoming' ? 'asc' : 'desc' },
    take: HISTORY_LIMIT,
    select: SESSION_SUMMARY_SELECT,
  });

  return buildSessionSummaries(rows, auth.userId);
}

// -----------------------------------------------------------------------------
// Profile photo
// -----------------------------------------------------------------------------

/** Full-size avatar and the small one lists render. */
const AVATAR_SIZE = 512;
const AVATAR_THUMBNAIL_SIZE = 128;

/**
 * Replaces the caller's profile photo.
 *
 * The image is decoded and re-encoded, which is what removes the EXIF location a
 * phone writes into a photo — a profile picture must not publish where it was
 * taken. The previous files are deleted only after the new ones are stored, so a
 * failure halfway leaves the old photo intact rather than none at all.
 */
export async function updateMyAvatar(
  auth: AuthContext,
  file: Express.Multer.File,
  ctx: RequestContext,
): Promise<MeResponse> {
  const current = await loadSelf(auth.userId);

  const [full, thumbnail] = await Promise.all([
    processSquareImage(file.buffer, AVATAR_SIZE),
    processSquareImage(file.buffer, AVATAR_THUMBNAIL_SIZE),
  ]);

  const imageKey = buildKey('avatars');
  const thumbnailKey = buildKey('avatars');

  await Promise.all([saveObject(imageKey, full.data), saveObject(thumbnailKey, thumbnail.data)]);

  const updated = await prisma.user.update({
    where: { id: auth.userId },
    data: { avatarUrl: publicUrl(imageKey), avatarThumbnailUrl: publicUrl(thumbnailKey) },
    select: USER_SAFE_SELECT,
  });

  await Promise.all([
    deleteObject(keyFromUrl(current.avatarUrl)),
    deleteObject(keyFromUrl(current.avatarThumbnailUrl)),
  ]);

  await recordAudit({
    actorId: auth.userId,
    action: 'user.avatar.updated',
    entity: 'user',
    entityId: auth.userId,
    ...ctx,
  });

  return toMeResponse(updated);
}

export async function removeMyAvatar(auth: AuthContext, ctx: RequestContext): Promise<MeResponse> {
  const current = await loadSelf(auth.userId);

  const updated = await prisma.user.update({
    where: { id: auth.userId },
    data: { avatarUrl: null, avatarThumbnailUrl: null },
    select: USER_SAFE_SELECT,
  });

  await Promise.all([
    deleteObject(keyFromUrl(current.avatarUrl)),
    deleteObject(keyFromUrl(current.avatarThumbnailUrl)),
  ]);

  await recordAudit({
    actorId: auth.userId,
    action: 'user.avatar.removed',
    entity: 'user',
    entityId: auth.userId,
    ...ctx,
  });

  return toMeResponse(updated);
}
