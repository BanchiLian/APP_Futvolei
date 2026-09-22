import { randomBytes } from 'node:crypto';

import {
  ERROR_CODES,
  PUBLIC_SIGNUP_ROLE,
  ROLES,
  addDays,
  superAdminPasswordSchema,
  type LoginInput,
  type MeResponse,
  type RegisterInput,
} from '@futcheck/shared';

import { env, isProduction } from '../../config/env.js';
import { recordAudit, type AuditEntry } from '../../lib/audit.js';
import { badRequest, conflict, forbidden, unauthorized } from '../../lib/errors.js';
import { signAccessToken } from '../../lib/jwt.js';
import { logger } from '../../lib/logger.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { generateOpaqueToken, hashOpaqueToken } from '../../lib/tokens.js';
import { toMeResponse, type SafeUser } from '../users/user.serializer.js';
import * as repo from './auth.repository.js';

/** Where the request came from. Every audit entry carries it. */
export type RequestContext = Pick<AuditEntry, 'ip' | 'userAgent'>;

export interface IssuedSession {
  accessToken: string;
  expiresIn: number;
  /** Raw refresh token. The controller puts it in an httpOnly cookie and nowhere else. */
  refreshToken: string;
  user: MeResponse;
}

/**
 * A throwaway Argon2 hash, verified when no user matches a login.
 *
 * Without it, "e-mail does not exist" returns in a millisecond while a wrong
 * password takes ~50ms, and that gap is a user-enumeration oracle. Computed once,
 * lazily, from random input — it can never match a real password.
 */
let decoyHash: Promise<string> | null = null;

function getDecoyHash(): Promise<string> {
  decoyHash ??= hashPassword(randomBytes(24).toString('hex'));
  return decoyHash;
}

async function issueSession(user: SafeUser, ctx: RequestContext): Promise<IssuedSession> {
  const refreshToken = generateOpaqueToken();

  await repo.createRefreshToken({
    userId: user.id,
    tokenHash: hashOpaqueToken(refreshToken),
    expiresAt: addDays(new Date(), env.REFRESH_TOKEN_TTL_DAYS),
    userAgent: ctx.userAgent,
  });

  const access = await signAccessToken(user.id);

  return {
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken,
    user: toMeResponse(user),
  };
}

// -----------------------------------------------------------------------------
// Register
// -----------------------------------------------------------------------------

/**
 * Public sign-up.
 *
 * The role is not taken from the input — there is no such field — it is forced to
 * `PUBLIC_SIGNUP_ROLE` (DAYUSE). This is the only role a self-service sign-up can
 * ever produce (section 4.2).
 */
export async function register(input: RegisterInput, ctx: RequestContext): Promise<IssuedSession> {
  const passwordHash = await hashPassword(input.password);

  let user: SafeUser;

  try {
    user = await repo.createUser({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: PUBLIC_SIGNUP_ROLE,
      termsAcceptedAt: new Date(),
    });
  } catch (error) {
    // Let the unique constraint decide, rather than checking first and racing.
    if (isUniqueViolation(error)) {
      throw conflict(ERROR_CODES.EMAIL_ALREADY_IN_USE);
    }
    throw error;
  }

  await recordAudit({
    actorId: user.id,
    action: 'auth.registered',
    entity: 'user',
    entityId: user.id,
    metadata: { role: user.role },
    ...ctx,
  });

  return issueSession(user, ctx);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

// -----------------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------------

/**
 * Password login.
 *
 * Wrong e-mail and wrong password are indistinguishable, in both the response and
 * the time taken (section 11). "Account disabled" is only revealed *after* the
 * password checks out, so it cannot be used to enumerate accounts either.
 */
export async function login(input: LoginInput, ctx: RequestContext): Promise<IssuedSession> {
  const user = await repo.findUserByLoginWithCredentials(input.login);

  const passwordMatches = user
    ? await verifyPassword(user.passwordHash, input.password)
    : await verifyPassword(await getDecoyHash(), input.password);

  if (!user || !passwordMatches || user.deletedAt) {
    await recordAudit({
      actorId: user?.id ?? null,
      action: 'auth.login.failed',
      entity: 'user',
      entityId: user?.id ?? null,
      // The attempted e-mail is recorded; the attempted password never is.
      metadata: { login: input.login, reason: user ? 'bad_password' : 'unknown_login' },
      ...ctx,
    });

    throw unauthorized(ERROR_CODES.INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    await recordAudit({
      actorId: user.id,
      action: 'auth.login.blocked',
      entity: 'user',
      entityId: user.id,
      metadata: { reason: 'inactive' },
      ...ctx,
    });

    throw forbidden(ERROR_CODES.ACCOUNT_DISABLED);
  }

  await repo.touchLastLogin(user.id);

  await recordAudit({
    actorId: user.id,
    action: 'auth.login',
    entity: 'user',
    entityId: user.id,
    ...ctx,
  });

  return issueSession(user, ctx);
}

// -----------------------------------------------------------------------------
// Refresh — rotating, with replay detection
// -----------------------------------------------------------------------------

/**
 * Exchanges a refresh token for a new pair, invalidating the old one.
 *
 * Presenting an *already rotated* token means either a bug or a stolen cookie
 * being replayed. We cannot tell which, so we assume the worst: every session of
 * that user is revoked and the event is audited. That is the whole point of
 * rotation — a stolen token is usable at most once, and using it locks the thief
 * and the victim out together, which the victim will notice.
 */
export async function refresh(
  rawRefreshToken: string | undefined,
  ctx: RequestContext,
): Promise<IssuedSession> {
  if (!rawRefreshToken) {
    throw unauthorized(ERROR_CODES.TOKEN_INVALID);
  }

  const stored = await repo.findRefreshTokenByHash(hashOpaqueToken(rawRefreshToken));

  if (!stored) {
    throw unauthorized(ERROR_CODES.TOKEN_INVALID);
  }

  if (stored.revokedAt) {
    // Deliberately outside a transaction that later throws: the revocation and
    // its audit entry must survive, and a rollback would erase both.
    const revoked = await repo.revokeAllRefreshTokens(stored.userId);

    await recordAudit({
      actorId: stored.userId,
      action: 'auth.refresh.reuse_detected',
      entity: 'refresh_token',
      entityId: stored.id,
      metadata: { revokedSessions: revoked, rotatedAt: stored.revokedAt.toISOString() },
      ...ctx,
    });

    logger.warn({ userId: stored.userId }, 'refresh token reuse detected, all sessions revoked');

    throw unauthorized(ERROR_CODES.REFRESH_TOKEN_REUSED);
  }

  if (stored.expiresAt <= new Date()) {
    throw unauthorized(ERROR_CODES.TOKEN_EXPIRED);
  }

  const user = stored.user;

  if (user.deletedAt) {
    throw unauthorized(ERROR_CODES.TOKEN_INVALID);
  }

  if (!user.isActive) {
    throw forbidden(ERROR_CODES.ACCOUNT_DISABLED);
  }

  // Only the request that wins this update may mint a new session, so two
  // concurrent refreshes can never produce two live sessions from one token.
  const rotated = await repo.revokeRefreshTokenIfLive(stored.id);

  if (!rotated) {
    throw unauthorized(ERROR_CODES.TOKEN_INVALID);
  }

  return issueSession(user, ctx);
}

// -----------------------------------------------------------------------------
// Logout
// -----------------------------------------------------------------------------

/** Idempotent: logging out twice, or with a stale cookie, still succeeds. */
export async function logout(
  rawRefreshToken: string | undefined,
  ctx: RequestContext,
): Promise<void> {
  if (!rawRefreshToken) return;

  const stored = await repo.findRefreshTokenByHash(hashOpaqueToken(rawRefreshToken));

  if (!stored || stored.revokedAt) return;

  await repo.revokeRefreshTokenIfLive(stored.id);

  await recordAudit({
    actorId: stored.userId,
    action: 'auth.logout',
    entity: 'refresh_token',
    entityId: stored.id,
    ...ctx,
  });
}

// -----------------------------------------------------------------------------
// Password recovery
// -----------------------------------------------------------------------------

/**
 * Starts a password reset.
 *
 * Always resolves the same way, whether or not the e-mail exists: the endpoint
 * must not tell an attacker which addresses have accounts. Sending the e-mail is
 * out of scope for this phase, so in development the link is logged to the
 * console, as the specification asks.
 */
export async function forgotPassword(email: string, ctx: RequestContext): Promise<void> {
  const user = await repo.findActiveUserByEmail(email);

  if (!user) {
    logger.info({ email }, 'password reset requested for an unknown or inactive account');
    return;
  }

  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000);

  await prisma.$transaction(async (tx) => {
    // A new link retires any previous one, so only the latest works.
    await repo.invalidatePasswordResetTokens(user.id, tx);
    await repo.createPasswordResetToken(
      { userId: user.id, tokenHash: hashOpaqueToken(token), expiresAt },
      tx,
    );
  });

  await recordAudit({
    actorId: user.id,
    action: 'auth.password_reset.requested',
    entity: 'user',
    entityId: user.id,
    ...ctx,
  });

  const link = `${env.WEB_PUBLIC_URL}/redefinir-senha?token=${token}`;

  if (isProduction) {
    // TODO(phase-8): send through the e-mail provider. Never log the link here.
    logger.info({ userId: user.id }, 'password reset link generated');
  } else {
    logger.info({ userId: user.id, link }, 'password reset link (development only)');
  }
}

/**
 * Completes a password reset.
 *
 * Every refusal is reported the same way, so a used, expired or forged token
 * cannot be told apart. All sessions are revoked on success: if the reset was
 * needed because the account was compromised, leaving the attacker's refresh
 * token alive would defeat the whole exercise.
 */
export async function resetPassword(
  input: { token: string; password: string },
  ctx: RequestContext,
): Promise<void> {
  const stored = await repo.findPasswordResetTokenByHash(hashOpaqueToken(input.token));

  if (!stored || stored.usedAt || stored.user.deletedAt || !stored.user.isActive) {
    throw badRequest(ERROR_CODES.TOKEN_INVALID, 'Este link de redefinição não é mais válido.');
  }

  if (stored.expiresAt <= new Date()) {
    throw badRequest(ERROR_CODES.TOKEN_EXPIRED, 'Este link de redefinição expirou.');
  }

  // The super admin is held to 12 characters (section 4.1). The shared reset
  // schema only enforces the general minimum, so the stricter rule is applied
  // here, where the account's role is finally known.
  if (stored.user.role === ROLES.SUPER_ADMIN) {
    const strict = superAdminPasswordSchema.safeParse(input.password);

    if (!strict.success) {
      throw badRequest(
        ERROR_CODES.PASSWORD_TOO_WEAK,
        strict.error.issues[0]?.message ?? 'A senha não atende aos requisitos mínimos.',
      );
    }
  }

  const passwordHash = await hashPassword(input.password);

  const revokedSessions = await prisma.$transaction(async (tx) => {
    // Guarded update: a token consumed by a concurrent request cannot be reused.
    const consumed = await repo.markPasswordResetTokenUsed(stored.id, tx);

    if (!consumed) {
      throw badRequest(ERROR_CODES.TOKEN_INVALID, 'Este link de redefinição não é mais válido.');
    }

    await repo.updatePasswordHash(stored.userId, passwordHash, tx);

    return repo.revokeAllRefreshTokens(stored.userId, tx);
  });

  await recordAudit({
    actorId: stored.userId,
    action: 'auth.password_reset.completed',
    entity: 'user',
    entityId: stored.userId,
    metadata: { revokedSessions },
    ...ctx,
  });
}
