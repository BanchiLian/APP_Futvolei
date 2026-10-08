import type { RequestHandler } from 'express';

import {
  ERROR_CODES,
  hasAllPermissions,
  hasAnyPermission,
  type Permission,
} from '@futcheck/shared';

import { auditContextFrom, recordAudit } from '../lib/audit.js';
import { forbidden, unauthorized } from '../lib/errors.js';

/**
 * Route-level authorization.
 *
 * This is the outer gate, not the whole story: services check ownership as well,
 * because a permission says *what* a role may do and never *to whose data*.
 * Skipping the service check is how IDOR bugs happen (section 4).
 *
 * A caller who is authenticated but lacks the permission is a privilege
 * escalation attempt, so it lands in the audit log.
 */
export function requirePermission(...required: Permission[]): RequestHandler {
  return gate(required, hasAllPermissions);
}

/**
 * Passes when the caller holds *any* of the listed permissions.
 *
 * For capabilities that several kinds of staff reach by different routes: a
 * professor marks attendance through `ATTENDANCE_MANAGE_OWN`, whoever runs the
 * CT through `ATTENDANCE_MANAGE_ANY`. The service still decides which sessions
 * each of them may actually touch.
 */
export function requireAnyPermission(...required: Permission[]): RequestHandler {
  return gate(required, hasAnyPermission);
}

function gate(
  required: Permission[],
  satisfies: (granted: readonly Permission[] | undefined, required: Permission[]) => boolean,
): RequestHandler {
  return (req, _res, next) => {
    const auth = req.auth;

    if (!auth) {
      next(unauthorized(ERROR_CODES.UNAUTHORIZED));
      return;
    }

    if (satisfies(auth.permissions, required)) {
      next();
      return;
    }

    void recordAudit({
      actorId: auth.userId,
      action: 'authz.blocked',
      entity: 'permission',
      metadata: {
        required,
        method: req.method,
        path: req.path,
      },
      ...auditContextFrom(req),
    });

    next(forbidden(ERROR_CODES.FORBIDDEN));
  };
}
