import { describe, expect, it } from 'vitest';

import {
  ADMIN_ASSIGNABLE_ROLES,
  ASSIGNABLE_ROLES,
  PUBLIC_SIGNUP_ROLE,
  ROLES,
  ROLE_VALUES,
  isAssignableRole,
} from './enums.js';
import {
  PERMISSIONS,
  PERMISSION_VALUES,
  ROLE_PERMISSIONS,
  hasAllPermissions,
  hasAnyPermission,
  permissionsForRole,
  roleHasPermission,
} from './permissions.js';

describe('permission matrix integrity', () => {
  it('covers every role', () => {
    for (const role of ROLE_VALUES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  it('grants only declared permissions', () => {
    for (const role of ROLE_VALUES) {
      for (const permission of permissionsForRole(role)) {
        expect(PERMISSION_VALUES).toContain(permission);
      }
    }
  });

  it('leaves no permission orphaned — every one is reachable by some role', () => {
    const granted = new Set(ROLE_VALUES.flatMap((role) => [...permissionsForRole(role)]));
    expect([...PERMISSION_VALUES].filter((permission) => !granted.has(permission))).toEqual([]);
  });

  it('never grants the same permission twice to a role', () => {
    for (const role of ROLE_VALUES) {
      const permissions = permissionsForRole(role);
      expect(new Set(permissions).size).toBe(permissions.length);
    }
  });
});

describe('super admin guarantees (section 4.1)', () => {
  it('never exposes SUPER_ADMIN as an assignable role', () => {
    expect(ASSIGNABLE_ROLES).not.toContain(ROLES.SUPER_ADMIN);
    expect(isAssignableRole(ROLES.SUPER_ADMIN)).toBe(false);
    expect(isAssignableRole('SUPER_ADMIN')).toBe(false);
  });

  it('holds every admin permission', () => {
    expect(
      hasAllPermissions(permissionsForRole(ROLES.SUPER_ADMIN), permissionsForRole(ROLES.ADMIN)),
    ).toBe(true);
  });

  it('exclusively manages admins and reads the audit log', () => {
    expect(roleHasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.ADMIN_MANAGE)).toBe(true);
    expect(roleHasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.AUDIT_VIEW)).toBe(true);

    for (const role of ROLE_VALUES.filter((candidate) => candidate !== ROLES.SUPER_ADMIN)) {
      expect(roleHasPermission(role, PERMISSIONS.ADMIN_MANAGE)).toBe(false);
      expect(roleHasPermission(role, PERMISSIONS.AUDIT_VIEW)).toBe(false);
    }
  });
});

describe('role assignment boundaries (section 4.2)', () => {
  it('lets an admin assign only DAYUSE, ALUNO and PROFESSOR', () => {
    expect([...ADMIN_ASSIGNABLE_ROLES]).toEqual([ROLES.DAYUSE, ROLES.ALUNO, ROLES.PROFESSOR]);
    expect(ADMIN_ASSIGNABLE_ROLES).not.toContain(ROLES.ADMIN);
    expect(ADMIN_ASSIGNABLE_ROLES).not.toContain(ROLES.SUPER_ADMIN);
  });

  it('creates public sign-ups as DAYUSE', () => {
    expect(PUBLIC_SIGNUP_ROLE).toBe(ROLES.DAYUSE);
  });

  it('shows the role label only to admins', () => {
    expect(roleHasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.USER_ROLE_LABEL_VIEW)).toBe(true);
    expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.USER_ROLE_LABEL_VIEW)).toBe(true);
    expect(roleHasPermission(ROLES.PROFESSOR, PERMISSIONS.USER_ROLE_LABEL_VIEW)).toBe(false);
    expect(roleHasPermission(ROLES.ALUNO, PERMISSIONS.USER_ROLE_LABEL_VIEW)).toBe(false);
    expect(roleHasPermission(ROLES.DAYUSE, PERMISSIONS.USER_ROLE_LABEL_VIEW)).toBe(false);
  });
});

describe('agenda visibility (section 4.3)', () => {
  it('hides the aula agenda from dayuse users', () => {
    expect(roleHasPermission(ROLES.DAYUSE, PERMISSIONS.SESSION_VIEW_AULA)).toBe(false);
    expect(roleHasPermission(ROLES.DAYUSE, PERMISSIONS.SESSION_RSVP_AULA)).toBe(false);
    expect(roleHasPermission(ROLES.DAYUSE, PERMISSIONS.SESSION_ATTENDEES_VIEW_AULA)).toBe(false);
  });

  it('shows the dayuse agenda to everyone', () => {
    for (const role of ROLE_VALUES) {
      expect(roleHasPermission(role, PERMISSIONS.SESSION_VIEW_DAYUSE)).toBe(true);
    }
  });

  it('lets alunos answer both agendas', () => {
    expect(roleHasPermission(ROLES.ALUNO, PERMISSIONS.SESSION_RSVP_AULA)).toBe(true);
    expect(roleHasPermission(ROLES.ALUNO, PERMISSIONS.SESSION_RSVP_DAYUSE)).toBe(true);
  });

  it('lets professors answer dayuse but not aula', () => {
    expect(roleHasPermission(ROLES.PROFESSOR, PERMISSIONS.SESSION_RSVP_DAYUSE)).toBe(true);
    expect(roleHasPermission(ROLES.PROFESSOR, PERMISSIONS.SESSION_RSVP_AULA)).toBe(false);
  });

  it('lets admins answer on behalf of anyone', () => {
    expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.SESSION_RSVP_ON_BEHALF)).toBe(true);
    expect(roleHasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.SESSION_RSVP_ON_BEHALF)).toBe(true);
    expect(roleHasPermission(ROLES.PROFESSOR, PERMISSIONS.SESSION_RSVP_ON_BEHALF)).toBe(false);
  });

  it('lets admins play as ordinary users too', () => {
    // An admin runs the arena and also plays in it: personal RSVP on both
    // agendas, on top of answering for other people.
    for (const role of [ROLES.ADMIN, ROLES.SUPER_ADMIN]) {
      expect(roleHasPermission(role, PERMISSIONS.SESSION_RSVP_AULA)).toBe(true);
      expect(roleHasPermission(role, PERMISSIONS.SESSION_RSVP_DAYUSE)).toBe(true);
      expect(roleHasPermission(role, PERMISSIONS.SESSION_RSVP_ON_BEHALF)).toBe(true);
    }
  });

  it('keeps personal RSVP separate from answering on behalf of others', () => {
    // A player can answer for themselves but never for anyone else.
    expect(roleHasPermission(ROLES.ALUNO, PERMISSIONS.SESSION_RSVP_AULA)).toBe(true);
    expect(roleHasPermission(ROLES.ALUNO, PERMISSIONS.SESSION_RSVP_ON_BEHALF)).toBe(false);
    expect(roleHasPermission(ROLES.DAYUSE, PERMISSIONS.SESSION_RSVP_ON_BEHALF)).toBe(false);
  });
});

describe('attendance and management boundaries', () => {
  it('limits professors to their own sessions, within the deadline', () => {
    expect(roleHasPermission(ROLES.PROFESSOR, PERMISSIONS.ATTENDANCE_MANAGE_OWN)).toBe(true);
    expect(roleHasPermission(ROLES.PROFESSOR, PERMISSIONS.ATTENDANCE_MANAGE_ANY)).toBe(false);
  });

  it('lets admins edit any checklist with no deadline', () => {
    expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.ATTENDANCE_MANAGE_ANY)).toBe(true);
    expect(roleHasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.ATTENDANCE_MANAGE_ANY)).toBe(true);
  });

  it('keeps sessions, schedule and settings out of reach of non-admins', () => {
    const adminOnly = [
      PERMISSIONS.SESSION_MANAGE,
      PERMISSIONS.SCHEDULE_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.USER_ROLE_ASSIGN_BASIC,
    ];

    for (const role of [ROLES.PROFESSOR, ROLES.ALUNO, ROLES.DAYUSE]) {
      expect(hasAnyPermission(permissionsForRole(role), adminOnly)).toBe(false);
    }
  });

  it('gives every role the ability to manage its own profile', () => {
    for (const role of ROLE_VALUES) {
      expect(roleHasPermission(role, PERMISSIONS.PROFILE_MANAGE_OWN)).toBe(true);
    }
  });
});

describe('permission helpers', () => {
  const alunoPermissions = permissionsForRole(ROLES.ALUNO);

  it('treats an undefined grant list as no permissions', () => {
    expect(hasAllPermissions(undefined, [PERMISSIONS.PROFILE_MANAGE_OWN])).toBe(false);
    expect(hasAnyPermission(undefined, [PERMISSIONS.PROFILE_MANAGE_OWN])).toBe(false);
  });

  it('requires all permissions for hasAllPermissions', () => {
    expect(
      hasAllPermissions(alunoPermissions, [
        PERMISSIONS.SESSION_RSVP_AULA,
        PERMISSIONS.SESSION_RSVP_DAYUSE,
      ]),
    ).toBe(true);

    expect(
      hasAllPermissions(alunoPermissions, [
        PERMISSIONS.SESSION_RSVP_AULA,
        PERMISSIONS.SESSION_MANAGE,
      ]),
    ).toBe(false);
  });

  it('requires only one permission for hasAnyPermission', () => {
    expect(
      hasAnyPermission(alunoPermissions, [
        PERMISSIONS.SESSION_MANAGE,
        PERMISSIONS.SESSION_RSVP_AULA,
      ]),
    ).toBe(true);
  });

  it('treats an empty requirement list as satisfied', () => {
    expect(hasAllPermissions(alunoPermissions, [])).toBe(true);
  });
});
