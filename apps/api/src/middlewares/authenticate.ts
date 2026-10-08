import type { RequestHandler } from 'express';

import {
  ERROR_CODES,
  VENUE_ROLE_PERMISSIONS,
  permissionsForRole,
  type Permission,
} from '@futcheck/shared';

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
      select: {
        id: true,
        role: true,
        isActive: true,
        // In the same round trip: every request needs to know which CTs this
        // person runs, and a second query per request would not scale.
        venueMemberships: { select: { venueId: true, role: true } },
      },
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

    // The union answers "could this account ever do this, anywhere?", which is
    // what the route gate needs. Narrowing it to one CT is the service's job.
    const reachable = new Set<Permission>(permissionsForRole(user.role));
    for (const membership of user.venueMemberships) {
      for (const permission of VENUE_ROLE_PERMISSIONS[membership.role]) {
        reachable.add(permission);
      }
    }

    req.auth = {
      userId: user.id,
      role: user.role,
      permissions: [...reachable],
      memberships: user.venueMemberships,
    };

    next();
  } catch (error) {
    next(error);
  }
};
