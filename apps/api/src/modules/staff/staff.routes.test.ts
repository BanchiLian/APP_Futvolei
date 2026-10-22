import type { Request, Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import {
  ERROR_CODES,
  PERMISSIONS,
  ROLES,
  VENUE_ROLES,
  reachablePermissions,
  type Role,
} from '@futcheck/shared';

import { createApp } from '../../app.js';
import type { AppError } from '../../lib/errors.js';
import { requirePermission } from '../../middlewares/requirePermission.js';

const app = createApp();
const SOMEONE = '01990000-0000-7000-8000-0000000000aa';

describe('PATCH /staff/users/:userId/role — access', () => {
  it('refuses an anonymous caller', async () => {
    const response = await request(app)
      .patch(`/api/v1/staff/users/${SOMEONE}/role`)
      .send({ role: 'PROFESSOR' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  /**
   * The gate the route uses, run against every kind of account that is not the
   * super admin — including an ADMIN and the owner of a CT, the two most likely
   * to be tempted to promote someone.
   */
  const gate = requirePermission(PERMISSIONS.USER_ROLE_ASSIGN_BASIC);

  function callerIs(role: Role, venueRole?: keyof typeof VENUE_ROLES) {
    const memberships = venueRole ? [{ venueId: SOMEONE, role: VENUE_ROLES[venueRole] }] : [];
    const req = {
      auth: {
        userId: 'caller',
        role,
        permissions: reachablePermissions(role, memberships),
        memberships,
      },
      method: 'PATCH',
      path: `/staff/users/${SOMEONE}/role`,
      ip: '203.0.113.10',
      get: () => undefined,
    } as unknown as Request;

    const next = vi.fn();
    gate(req, {} as Response, next);
    return next.mock.calls[0]?.[0] as AppError | undefined;
  }

  it.each([
    ['ADMIN', ROLES.ADMIN, undefined],
    ['CT owner', ROLES.ALUNO, 'OWNER' as const],
    ['CT professor', ROLES.PROFESSOR, 'PROFESSOR' as const],
    ['ALUNO', ROLES.ALUNO, undefined],
    ['DAYUSE', ROLES.DAYUSE, undefined],
  ])('refuses %s', (_label, role, venueRole) => {
    expect(callerIs(role, venueRole)).toMatchObject({ status: 403 });
  });

  it('lets the super admin through', () => {
    expect(callerIs(ROLES.SUPER_ADMIN)).toBeUndefined();
  });
});
