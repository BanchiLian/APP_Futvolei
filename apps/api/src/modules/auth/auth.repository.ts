import type { Role } from '@futcheck/shared';

import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { USER_SAFE_SELECT, type SafeUser } from '../users/user.serializer.js';

/**
 * Data access for authentication.
 *
 * Every function takes an optional client so the same code works inside a
 * transaction — the service needs several of these steps to commit or fail
 * together (token rotation, password reset).
 */
type Db = Prisma.TransactionClient | typeof prisma;

/** Login is the only place that needs the hash, so it is its own function. */
export interface UserWithCredentials extends SafeUser {
  passwordHash: string;
  deletedAt: Date | null;
}

export function findUserByEmailWithCredentials(
  email: string,
  db: Db = prisma,
): Promise<UserWithCredentials | null> {
  return db.user.findUnique({
    where: { email },
    select: { ...USER_SAFE_SELECT, passwordHash: true, deletedAt: true },
  });
}

export function findActiveUserByEmail(email: string, db: Db = prisma): Promise<SafeUser | null> {
  return db.user.findFirst({
    where: { email, deletedAt: null, isActive: true },
    select: USER_SAFE_SELECT,
  });
}

export function createUser(
  data: {
    name: string;
    email: string;
    phone: string;
    passwordHash: string;
    role: Role;
    termsAcceptedAt: Date;
  },
  db: Db = prisma,
): Promise<SafeUser> {
  return db.user.create({ data, select: USER_SAFE_SELECT });
}

export async function touchLastLogin(userId: string, db: Db = prisma): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

export async function updatePasswordHash(
  userId: string,
  passwordHash: string,
  db: Db = prisma,
): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { passwordHash } });
}

// -----------------------------------------------------------------------------
// Refresh tokens
// -----------------------------------------------------------------------------

export interface StoredRefreshToken {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: SafeUser & { deletedAt: Date | null };
}

export function findRefreshTokenByHash(
  tokenHash: string,
  db: Db = prisma,
): Promise<StoredRefreshToken | null> {
  return db.refreshToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { ...USER_SAFE_SELECT, deletedAt: true } },
    },
  });
}

export async function createRefreshToken(
  data: { userId: string; tokenHash: string; expiresAt: Date; userAgent?: string | null },
  db: Db = prisma,
): Promise<void> {
  await db.refreshToken.create({
    data: {
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent?.slice(0, 255) ?? null,
    },
  });
}

/**
 * Revokes one token only if it is still live, and reports whether it did.
 *
 * The `revokedAt: null` guard is what makes rotation safe under concurrency: two
 * simultaneous refreshes cannot both succeed, so the same token can never yield
 * two valid sessions.
 */
export async function revokeRefreshTokenIfLive(id: string, db: Db = prisma): Promise<boolean> {
  const result = await db.refreshToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return result.count === 1;
}

export async function revokeAllRefreshTokens(userId: string, db: Db = prisma): Promise<number> {
  const result = await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return result.count;
}

// -----------------------------------------------------------------------------
// Password reset tokens
// -----------------------------------------------------------------------------

export interface StoredPasswordResetToken {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  user: { id: string; role: Role; isActive: boolean; deletedAt: Date | null };
}

export function findPasswordResetTokenByHash(
  tokenHash: string,
  db: Db = prisma,
): Promise<StoredPasswordResetToken | null> {
  return db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { id: true, role: true, isActive: true, deletedAt: true } },
    },
  });
}

export async function createPasswordResetToken(
  data: { userId: string; tokenHash: string; expiresAt: Date },
  db: Db = prisma,
): Promise<void> {
  await db.passwordResetToken.create({ data });
}

/** Issuing a new reset link must retire the previous ones. */
export async function invalidatePasswordResetTokens(
  userId: string,
  db: Db = prisma,
): Promise<void> {
  await db.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

export async function markPasswordResetTokenUsed(id: string, db: Db = prisma): Promise<boolean> {
  const result = await db.passwordResetToken.updateMany({
    where: { id, usedAt: null },
    data: { usedAt: new Date() },
  });

  return result.count === 1;
}
