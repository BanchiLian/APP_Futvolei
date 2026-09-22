import type { RequestHandler } from 'express';

import { ERROR_CODES, hasAllPermissions, type Permission } from '@futcheck/shared';

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
  return (req, _res, next) => {
    const auth = req.auth;

    if (!auth) {
      next(unauthorized(ERROR_CODES.UNAUTHORIZED));
      return;
    }

    if (hasAllPermissions(auth.permissions, required)) {
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
