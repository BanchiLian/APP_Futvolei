import type { Request } from 'express';

import type { Prisma } from '../generated/prisma/client.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';

/**
 * The audit trail (section 7).
 *
 * Records role changes, attendance edits, cancellations, settings changes, every
 * super admin action — and, just as importantly, **blocked attempts**. An attacker
 * probing for the super admin should leave a trail.
 */

export interface AuditEntry {
  /** Null for anonymous actions, such as a failed login. */
  actorId?: string | null;
  /** Dotted verb: `user.role.changed`, `auth.login.failed`, `super_admin.blocked`. */
  action: string;
  entity: string;
  entityId?: string | null;
  /** Context for the action; use `{ before, after }` for changes. */
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
}

/** Anything with an `auditLog` delegate: the client or a transaction client. */
type AuditClient = Pick<typeof prisma, 'auditLog'>;

/**
 * Writes one audit entry.
 *
 * Never throws: failing to log must not fail the user's request. A write that
 * does fail is logged at error level, loudly enough to be alerted on.
 *
 * Pass the transaction client when the entry must be atomic with the change it
 * describes — a recorded change that was rolled back is worse than no record.
 */
export async function recordAudit(entry: AuditEntry, client: AuditClient = prisma): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent?.slice(0, 255) ?? null,
      },
    });
  } catch (error) {
    logger.error({ err: error, action: entry.action }, 'failed to write audit log');
  }
}

/** Pulls the request context every audit entry should carry. */
export function auditContextFrom(req: Request): Pick<AuditEntry, 'ip' | 'userAgent'> {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  };
}
