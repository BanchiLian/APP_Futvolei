import { describe, expect, it } from 'vitest';

import { PERMISSIONS, ROLES, permissionsForRole, type Role } from '@futcheck/shared';

import { USER_SAFE_SELECT, toMeResponse, toPublicUserSummary } from './user.serializer.js';

function userWith(role: Role) {
  return {
    id: 'user-1',
    name: 'Ana Souza',
    email: 'ana@example.com',
    phone: '11988887777',
    role,
    avatarUrl: 'https://cdn.example.com/a.webp',
    avatarThumbnailUrl: 'https://cdn.example.com/a-thumb.webp',
    birthDate: new Date('1995-03-14T00:00:00.000Z'),
    skillLevel: null,
    isActive: true,
    termsAcceptedAt: new Date('2026-09-01T12:00:00.000Z'),
    lastLoginAt: null,
    createdAt: new Date('2026-09-01T12:00:00.000Z'),
  };
}

describe('USER_SAFE_SELECT', () => {
  it('cannot select the password hash', () => {
    // The guarantee is structural: a field that is never selected cannot leak
    // through a spread or a forgotten omission.
    expect(USER_SAFE_SELECT).not.toHaveProperty('passwordHash');
    expect(USER_SAFE_SELECT).not.toHaveProperty('deletedAt');
  });
});

describe('toMeResponse — role label visibility (section 4.2)', () => {
  it('hides the role from a dayuse user', () => {
    const response = toMeResponse(userWith(ROLES.DAYUSE));

    expect(response).not.toHaveProperty('role');
    expect(response.permissions).toEqual([...permissionsForRole(ROLES.DAYUSE)]);
  });

  it('hides the role from a student', () => {
    expect(toMeResponse(userWith(ROLES.ALUNO))).not.toHaveProperty('role');
  });

  it('hides the role from a professor', () => {
    expect(toMeResponse(userWith(ROLES.PROFESSOR))).not.toHaveProperty('role');
  });

  it('shows the role to an admin', () => {
    expect(toMeResponse(userWith(ROLES.ADMIN)).role).toBe(ROLES.ADMIN);
  });

  it('shows the role to the super admin', () => {
    expect(toMeResponse(userWith(ROLES.SUPER_ADMIN)).role).toBe(ROLES.SUPER_ADMIN);
  });

  it('ties visibility to the permission, not to a hardcoded role list', () => {
    for (const role of [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN,
      ROLES.PROFESSOR,
      ROLES.ALUNO,
      ROLES.DAYUSE,
    ]) {
      const response = toMeResponse(userWith(role));
      const canSeeLabel = permissionsForRole(role).includes(PERMISSIONS.USER_ROLE_LABEL_VIEW);

      expect(Object.hasOwn(response, 'role')).toBe(canSeeLabel);
    }
  });
});

describe('toMeResponse — payload', () => {
  const response = toMeResponse(userWith(ROLES.ALUNO));

  it('never carries a password field of any kind', () => {
    const serialised = JSON.stringify(response).toLowerCase();

    expect(serialised).not.toContain('password');
    expect(serialised).not.toContain('hash');
  });

  it('sends dates as ISO strings and the birth date as a plain day', () => {
    expect(response.birthDate).toBe('1995-03-14');
    expect(response.createdAt).toBe('2026-09-01T12:00:00.000Z');
    expect(response.termsAcceptedAt).toBe('2026-09-01T12:00:00.000Z');
  });

  it('keeps nulls as null instead of inventing values', () => {
    expect(response.lastLoginAt).toBeNull();
    expect(response.skillLevel).toBeNull();
  });

  it('always includes the effective permissions', () => {
    expect(response.permissions.length).toBeGreaterThan(0);
  });
});

describe('toPublicUserSummary', () => {
  it('exposes only the id, name and photo (LGPD, section 11)', () => {
    const summary = toPublicUserSummary({
      id: 'user-1',
      name: 'Ana Souza',
      avatarUrl: 'https://cdn.example.com/a.webp',
      avatarThumbnailUrl: 'https://cdn.example.com/a-thumb.webp',
    });

    expect(Object.keys(summary).sort()).toEqual(['avatarUrl', 'id', 'name']);
  });

  it('prefers the thumbnail, which is what lists render', () => {
    const summary = toPublicUserSummary({
      id: 'user-1',
      name: 'Ana',
      avatarUrl: 'full.webp',
      avatarThumbnailUrl: 'thumb.webp',
    });

    expect(summary.avatarUrl).toBe('thumb.webp');
  });

  it('falls back to the full image when there is no thumbnail', () => {
    const summary = toPublicUserSummary({
      id: 'user-1',
      name: 'Ana',
      avatarUrl: 'full.webp',
      avatarThumbnailUrl: null,
    });

    expect(summary.avatarUrl).toBe('full.webp');
  });
});
