import type { RequestHandler } from 'express';

import { ERROR_CODES, permissionsForRole } from '@futcheck/shared';

import { auditContextFrom, recordAudit } from '../lib/audit.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

function bearerTokenFrom(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

  return token;
}

/**
 * Resolves the caller from the access token.
 *
 * The user is re-read from the database on every request rather than trusted from
 * the token's claims. It costs one indexed lookup and buys correctness: a
 * demotion, a deactivation or a deletion takes effect immediately, instead of
 * lingering until the access token expires.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = bearerTokenFrom(req.get('authorization'));

  if (!token) {
    next(unauthorized(ERROR_CODES.UNAUTHORIZED));
    return;
  }

  try {
    const userId = await verifyAccessToken(token);

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true, isActive: true },
    });

    if (!user) {
      // The token is well-formed but its subject is gone. Nothing to say beyond
      // "not authenticated" — confirming the difference would leak information.
      next(unauthorized(ERROR_CODES.TOKEN_INVALID));
      return;
    }

    if (!user.isActive) {
      await recordAudit({
        actorId: user.id,
        action: 'auth.blocked.inactive',
        entity: 'user',
        entityId: user.id,
        metadata: { path: req.path },
        ...auditContextFrom(req),
      });

      next(forbidden(ERROR_CODES.ACCOUNT_DISABLED));
      return;
    }

    req.auth = {
      userId: user.id,
      role: user.role,
      permissions: permissionsForRole(user.role),
    };

    next();
  } catch (error) {
    next(error);
  }
};
