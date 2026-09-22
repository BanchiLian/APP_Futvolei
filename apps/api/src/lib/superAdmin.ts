import {
  ERROR_CODES,
  ROLES,
  isAssignableRole,
  type AssignableRole,
  type Role,
} from '@futcheck/shared';

import { forbidden } from './errors.js';

/**
 * Super admin protections (section 4.1), as reusable guards.
 *
 * These are the application layer of a three-layer guarantee. The database caps
 * the role at one row with a partial unique index, the Zod schemas never accept
 * the value, and these functions stop the remaining paths.
 *
 * Every refusal here is a security event, so callers pair them with an audit entry.
 */

export function isSuperAdmin(role: Role): boolean {
  return role === ROLES.SUPER_ADMIN;
}

/**
 * Guards every write of a role. SUPER_ADMIN is never assignable — not by an
 * admin, not by the super admin themselves, not by any endpoint.
 */
export function assertRoleIsAssignable(role: string): asserts role is AssignableRole {
  if (!isAssignableRole(role)) {
    throw forbidden(
      ERROR_CODES.ROLE_NOT_ASSIGNABLE,
      'Este perfil de acesso não pode ser atribuído.',
    );
  }
}

/**
 * Guards every mutation that targets another user: edit, role change, activation,
 * deletion.
 *
 * Nobody but the super admin may act on the super admin — an ADMIN attempting it
 * is exactly the escalation this exists to stop. The error is deliberately vague
 * (`SUPER_ADMIN_PROTECTED`, "esta operação não é permitida") so it does not
 * confirm which account is the owner.
 */
export function assertCanMutateUser(params: {
  actorId: string;
  targetId: string;
  targetRole: Role;
}): void {
  if (!isSuperAdmin(params.targetRole)) {
    return;
  }

  if (params.actorId !== params.targetId) {
    throw forbidden(ERROR_CODES.SUPER_ADMIN_PROTECTED, 'Esta operação não é permitida.');
  }
}

/**
 * Only the super admin may grant or remove ADMIN (section 4.2).
 */
export function assertCanAssignRole(params: {
  actorRole: Role;
  desiredRole: AssignableRole;
}): void {
  if (params.desiredRole === ROLES.ADMIN && !isSuperAdmin(params.actorRole)) {
    throw forbidden(
      ERROR_CODES.ROLE_NOT_ASSIGNABLE,
      'Apenas o super admin pode definir ou remover administradores.',
    );
  }
}

/**
 * Prisma `where` fragment that hides the super admin from listings, searches and
 * reports for everyone else — including ADMIN (section 4.1, "Visibilidade").
 *
 * Spread it into the where clause of every user query that an admin can reach.
 */
export function superAdminVisibilityFilter(actorRole: Role): {
  role?: { not: typeof ROLES.SUPER_ADMIN };
} {
  return isSuperAdmin(actorRole) ? {} : { role: { not: ROLES.SUPER_ADMIN } };
}
