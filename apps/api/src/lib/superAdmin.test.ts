import { describe, expect, it } from 'vitest';

import { ERROR_CODES, ROLES, ROLE_VALUES, type AssignableRole } from '@futcheck/shared';

import { AppError } from './errors.js';
import {
  assertCanAssignRole,
  assertCanMutateUser,
  assertRoleIsAssignable,
  isSuperAdmin,
  superAdminVisibilityFilter,
} from './superAdmin.js';

const SUPER_ADMIN_ID = 'super-admin-id';
const ADMIN_ID = 'admin-id';

describe('assertRoleIsAssignable', () => {
  it('refuses SUPER_ADMIN from any caller', () => {
    // Section 4.1: the role is not assignable, promotable or creatable by the
    // application — not even by the super admin.
    expect(() => assertRoleIsAssignable(ROLES.SUPER_ADMIN)).toThrow(AppError);
    expect(() => assertRoleIsAssignable(ROLES.SUPER_ADMIN)).toThrow(
      expect.objectContaining({ code: ERROR_CODES.ROLE_NOT_ASSIGNABLE, status: 403 }),
    );
  });

  it('refuses anything that is not a known role', () => {
    for (const bogus of ['', 'super_admin', 'SUPERADMIN', 'ROOT', 'owner', 'Admin']) {
      expect(() => assertRoleIsAssignable(bogus)).toThrow(AppError);
    }
  });

  it('accepts the four assignable roles', () => {
    for (const role of [ROLES.DAYUSE, ROLES.ALUNO, ROLES.PROFESSOR, ROLES.ADMIN]) {
      expect(() => assertRoleIsAssignable(role)).not.toThrow();
    }
  });
});

describe('assertCanMutateUser', () => {
  it('blocks anyone from acting on the super admin', () => {
    expect(() =>
      assertCanMutateUser({
        actorId: ADMIN_ID,
        targetId: SUPER_ADMIN_ID,
        targetRole: ROLES.SUPER_ADMIN,
      }),
    ).toThrow(expect.objectContaining({ code: ERROR_CODES.SUPER_ADMIN_PROTECTED, status: 403 }));
  });

  it('gives a vague message, so it does not confirm who the owner is', () => {
    try {
      assertCanMutateUser({
        actorId: ADMIN_ID,
        targetId: SUPER_ADMIN_ID,
        targetRole: ROLES.SUPER_ADMIN,
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).toBe('Esta operação não é permitida.');
      expect(message.toLowerCase()).not.toContain('super');
    }
  });

  it('lets the super admin act on themselves', () => {
    expect(() =>
      assertCanMutateUser({
        actorId: SUPER_ADMIN_ID,
        targetId: SUPER_ADMIN_ID,
        targetRole: ROLES.SUPER_ADMIN,
      }),
    ).not.toThrow();
  });

  it('does not interfere with ordinary users', () => {
    for (const role of [ROLES.ADMIN, ROLES.PROFESSOR, ROLES.ALUNO, ROLES.DAYUSE]) {
      expect(() =>
        assertCanMutateUser({ actorId: ADMIN_ID, targetId: 'someone', targetRole: role }),
      ).not.toThrow();
    }
  });
});

describe('assertCanAssignRole', () => {
  it('stops an admin from creating or promoting another admin', () => {
    // Section 4.2: only the super admin grants or removes ADMIN.
    expect(() => assertCanAssignRole({ actorRole: ROLES.ADMIN, desiredRole: ROLES.ADMIN })).toThrow(
      expect.objectContaining({ code: ERROR_CODES.ROLE_NOT_ASSIGNABLE, status: 403 }),
    );
  });

  it('lets the super admin assign ADMIN', () => {
    expect(() =>
      assertCanAssignRole({ actorRole: ROLES.SUPER_ADMIN, desiredRole: ROLES.ADMIN }),
    ).not.toThrow();
  });

  it('lets an admin assign the three basic roles', () => {
    for (const role of [ROLES.DAYUSE, ROLES.ALUNO, ROLES.PROFESSOR] as AssignableRole[]) {
      expect(() =>
        assertCanAssignRole({ actorRole: ROLES.ADMIN, desiredRole: role }),
      ).not.toThrow();
    }
  });
});

describe('superAdminVisibilityFilter', () => {
  it('hides the super admin from everyone else, including admins', () => {
    for (const role of ROLE_VALUES.filter((candidate) => candidate !== ROLES.SUPER_ADMIN)) {
      expect(superAdminVisibilityFilter(role)).toEqual({ role: { not: ROLES.SUPER_ADMIN } });
    }
  });

  it('does not filter for the super admin themselves', () => {
    expect(superAdminVisibilityFilter(ROLES.SUPER_ADMIN)).toEqual({});
  });
});

describe('isSuperAdmin', () => {
  it('is true only for SUPER_ADMIN', () => {
    expect(isSuperAdmin(ROLES.SUPER_ADMIN)).toBe(true);

    for (const role of ROLE_VALUES.filter((candidate) => candidate !== ROLES.SUPER_ADMIN)) {
      expect(isSuperAdmin(role)).toBe(false);
    }
  });
});
