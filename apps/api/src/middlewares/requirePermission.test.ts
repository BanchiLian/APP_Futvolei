import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { ERROR_CODES, PERMISSIONS, ROLES, permissionsForRole } from '@futcheck/shared';

import { AppError } from '../lib/errors.js';
import type { AuthContext } from '../types/express.js';
import { requirePermission } from './requirePermission.js';

function requestFor(auth: AuthContext | undefined): Request {
  return {
    auth,
    method: 'POST',
    path: '/api/v1/sessions',
    ip: '203.0.113.10',
    get: () => undefined,
  } as unknown as Request;
}

function authFor(role: keyof typeof ROLES): AuthContext {
  return {
    userId: `${role.toLowerCase()}-id`,
    role: ROLES[role],
    permissions: permissionsForRole(ROLES[role]),
  };
}

function run(auth: AuthContext | undefined, ...required: Parameters<typeof requirePermission>) {
  const next = vi.fn();
  requirePermission(...required)(requestFor(auth), {} as Response, next);

  return next;
}

describe('requirePermission', () => {
  it('lets a caller through when every permission is held', () => {
    const next = run(authFor('ADMIN'), PERMISSIONS.SESSION_MANAGE);

    expect(next).toHaveBeenCalledWith();
  });

  it('requires all of them, not just one', () => {
    const next = run(
      authFor('PROFESSOR'),
      PERMISSIONS.ATTENDANCE_MANAGE_OWN,
      PERMISSIONS.SESSION_MANAGE,
    );

    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(403);
  });

  it('answers 401 when nobody is authenticated', () => {
    // Distinct from 403 on purpose: the client should try logging in, not give up.
    const error = run(undefined, PERMISSIONS.SESSION_MANAGE).mock.calls[0]?.[0] as AppError;

    expect(error.status).toBe(401);
    expect(error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('answers 403 for an authenticated caller who lacks the permission', () => {
    const error = run(authFor('ALUNO'), PERMISSIONS.SESSION_MANAGE).mock.calls[0]?.[0] as AppError;

    expect(error.status).toBe(403);
    expect(error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('does not say which permission was missing', () => {
    // Telling a caller exactly which permission to look for maps the attack
    // surface for them.
    const error = run(authFor('DAYUSE'), PERMISSIONS.AUDIT_VIEW).mock.calls[0]?.[0] as AppError;

    expect(error.message).not.toContain('audit');
    expect(JSON.stringify(error.details ?? null)).not.toContain('audit');
  });

  it('denies the audit log to every role but the super admin', () => {
    for (const role of ['ADMIN', 'PROFESSOR', 'ALUNO', 'DAYUSE'] as const) {
      const error = run(authFor(role), PERMISSIONS.AUDIT_VIEW).mock.calls[0]?.[0] as AppError;
      expect(error.status).toBe(403);
    }

    expect(run(authFor('SUPER_ADMIN'), PERMISSIONS.AUDIT_VIEW)).toHaveBeenCalledWith();
  });

  it('denies admin management to everyone but the super admin', () => {
    const error = run(authFor('ADMIN'), PERMISSIONS.ADMIN_MANAGE).mock.calls[0]?.[0] as AppError;

    expect(error.status).toBe(403);
    expect(run(authFor('SUPER_ADMIN'), PERMISSIONS.ADMIN_MANAGE)).toHaveBeenCalledWith();
  });

  it('treats an empty requirement list as satisfied', () => {
    expect(run(authFor('DAYUSE'))).toHaveBeenCalledWith();
  });
});
