import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { PERMISSIONS, ROLES, type MeResponse, permissionsForRole } from '@futcheck/shared';

import { useAuthStore } from './auth';

function profileFor(role: Parameters<typeof permissionsForRole>[0]): MeResponse {
  return {
    id: 'user-1',
    name: 'Ana Souza',
    email: 'ana@example.com',
    phone: '11988887777',
    avatarUrl: null,
    avatarThumbnailUrl: null,
    birthDate: null,
    skillLevel: null,
    isActive: true,
    termsAcceptedAt: null,
    lastLoginAt: null,
    createdAt: '2026-09-21T12:00:00.000Z',
    permissions: [...permissionsForRole(role)],
  };
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts logged out with no permissions', () => {
    const auth = useAuthStore();

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.permissions).toEqual([]);
    expect(auth.can(PERMISSIONS.SESSION_VIEW_DAYUSE)).toBe(false);
  });

  it('keeps the access token in memory only', () => {
    const auth = useAuthStore();
    auth.setSession('token-123', profileFor(ROLES.ALUNO));

    expect(auth.accessToken).toBe('token-123');
    // Nothing is persisted where an XSS could read it.
    expect(window.localStorage.getItem('token-123')).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it('exposes the permissions the server sent', () => {
    const auth = useAuthStore();
    auth.setSession('token', profileFor(ROLES.ALUNO));

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.can(PERMISSIONS.SESSION_RSVP_AULA)).toBe(true);
    expect(auth.can(PERMISSIONS.SESSION_RSVP_DAYUSE)).toBe(true);
    expect(auth.can(PERMISSIONS.SESSION_MANAGE)).toBe(false);
  });

  it('hides the aula agenda from a dayuse user', () => {
    const auth = useAuthStore();
    auth.setSession('token', profileFor(ROLES.DAYUSE));

    expect(auth.can(PERMISSIONS.SESSION_VIEW_DAYUSE)).toBe(true);
    expect(auth.can(PERMISSIONS.SESSION_VIEW_AULA)).toBe(false);
  });

  it('answers canAll and canAny correctly', () => {
    const auth = useAuthStore();
    auth.setSession('token', profileFor(ROLES.PROFESSOR));

    expect(auth.canAll([PERMISSIONS.ATTENDANCE_MANAGE_OWN, PERMISSIONS.REPORT_VIEW_OWN])).toBe(
      true,
    );
    expect(
      auth.canAll([PERMISSIONS.ATTENDANCE_MANAGE_OWN, PERMISSIONS.ATTENDANCE_MANAGE_ANY]),
    ).toBe(false);
    expect(
      auth.canAny([PERMISSIONS.ATTENDANCE_MANAGE_ANY, PERMISSIONS.ATTENDANCE_MANAGE_OWN]),
    ).toBe(true);
  });

  it('does not expose a role label for a non-admin profile', () => {
    const auth = useAuthStore();
    auth.setSession('token', profileFor(ROLES.ALUNO));

    // `/me` only serialises `role` for users who can see role labels.
    expect(auth.user?.role).toBeUndefined();
    expect(auth.can(PERMISSIONS.USER_ROLE_LABEL_VIEW)).toBe(false);
  });

  it('clears everything on logout', () => {
    const auth = useAuthStore();
    auth.setSession('token', profileFor(ROLES.ADMIN));
    auth.clearSession();

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.accessToken).toBeNull();
    expect(auth.user).toBeNull();
    expect(auth.permissions).toEqual([]);
  });
});
