import { describe, expect, it } from 'vitest';

import { PERMISSIONS, ROLES, VENUE_ROLES, permissionsForRole } from '@futcheck/shared';

import { ownedVenueIds, requireVenuePermission, venueAuthFor, venueRoleAt } from './venueAccess.js';
import { isAppError } from './errors.js';
import type { AuthContext } from '../types/express.js';

const MINE = '0199aaaa-0000-7000-8000-000000000001';
const THEIRS = '0199bbbb-0000-7000-8000-000000000002';

function auth(
  role: (typeof ROLES)[keyof typeof ROLES],
  memberships: AuthContext['memberships'] = [],
): AuthContext {
  return {
    userId: 'user-1',
    role,
    permissions: permissionsForRole(role),
    memberships,
  };
}

const owner = auth(ROLES.ALUNO, [{ venueId: MINE, role: VENUE_ROLES.OWNER }]);
const professor = auth(ROLES.ALUNO, [{ venueId: MINE, role: VENUE_ROLES.PROFESSOR }]);
const player = auth(ROLES.ALUNO);
const superAdmin = auth(ROLES.SUPER_ADMIN);

function refuses(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch (error) {
    return isAppError(error) && error.status === 403;
  }
}

describe('authority is held per CT', () => {
  it('reports the role only at the CT it was granted for', () => {
    expect(venueRoleAt(owner, MINE)).toBe(VENUE_ROLES.OWNER);
    expect(venueRoleAt(owner, THEIRS)).toBeNull();
  });

  it('grants the owner their CT', () => {
    expect(() => requireVenuePermission(owner, MINE, PERMISSIONS.VENUE_MANAGE)).not.toThrow();
    expect(() => requireVenuePermission(owner, MINE, PERMISSIONS.SCHEDULE_MANAGE)).not.toThrow();
  });

  it('refuses the owner at any other CT', () => {
    // The heart of the whole model: one owner must never reach another's arena.
    expect(refuses(() => requireVenuePermission(owner, THEIRS, PERMISSIONS.VENUE_MANAGE))).toBe(
      true,
    );
    expect(refuses(() => requireVenuePermission(owner, THEIRS, PERMISSIONS.SCHEDULE_MANAGE))).toBe(
      true,
    );
    expect(
      refuses(() => requireVenuePermission(owner, THEIRS, PERMISSIONS.ATTENDANCE_MANAGE_ANY)),
    ).toBe(true);
  });

  it('keeps a professor out of the grid and the staff, even at their own CT', () => {
    expect(
      refuses(() => requireVenuePermission(professor, MINE, PERMISSIONS.SCHEDULE_MANAGE)),
    ).toBe(true);
    expect(
      refuses(() => requireVenuePermission(professor, MINE, PERMISSIONS.VENUE_STAFF_MANAGE)),
    ).toBe(true);
    expect(
      refuses(() => requireVenuePermission(professor, MINE, PERMISSIONS.ATTENDANCE_MANAGE_ANY)),
    ).toBe(true);
  });

  it('lets a professor mark attendance at their own CT', () => {
    expect(() =>
      requireVenuePermission(professor, MINE, PERMISSIONS.ATTENDANCE_MANAGE_OWN),
    ).not.toThrow();
  });

  it('refuses a plain player everywhere', () => {
    expect(
      refuses(() => requireVenuePermission(player, MINE, PERMISSIONS.ATTENDANCE_MANAGE_OWN)),
    ).toBe(true);
  });

  it('lets the super admin act at a CT they have no membership of', () => {
    expect(venueRoleAt(superAdmin, THEIRS)).toBeNull();
    expect(() =>
      requireVenuePermission(superAdmin, THEIRS, PERMISSIONS.VENUE_MANAGE),
    ).not.toThrow();
    expect(() => requireVenuePermission(superAdmin, THEIRS, PERMISSIONS.AUDIT_VIEW)).not.toThrow();
  });

  it('never gives a CT owner the network-wide powers', () => {
    const scoped = venueAuthFor(owner, MINE);

    expect(scoped.permissions).not.toContain(PERMISSIONS.ADMIN_MANAGE);
    expect(scoped.permissions).not.toContain(PERMISSIONS.AUDIT_VIEW);
    expect(scoped.permissions).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(scoped.permissions).not.toContain(PERMISSIONS.USER_MANAGE);
  });

  it('lists only the CTs actually owned', () => {
    const both = auth(ROLES.ALUNO, [
      { venueId: MINE, role: VENUE_ROLES.OWNER },
      { venueId: THEIRS, role: VENUE_ROLES.PROFESSOR },
    ]);

    expect(ownedVenueIds(both)).toEqual([MINE]);
  });
});

describe('seeing the people of a CT', () => {
  it('lets both the owner and the professor see their CT people', () => {
    expect(() => requireVenuePermission(owner, MINE, PERMISSIONS.VENUE_PEOPLE_VIEW)).not.toThrow();
    expect(() =>
      requireVenuePermission(professor, MINE, PERMISSIONS.VENUE_PEOPLE_VIEW),
    ).not.toThrow();
  });

  it('refuses both of them at any other CT', () => {
    expect(
      refuses(() => requireVenuePermission(owner, THEIRS, PERMISSIONS.VENUE_PEOPLE_VIEW)),
    ).toBe(true);
    expect(
      refuses(() => requireVenuePermission(professor, THEIRS, PERMISSIONS.VENUE_PEOPLE_VIEW)),
    ).toBe(true);
  });

  it('refuses someone who only plays there', () => {
    expect(refuses(() => requireVenuePermission(player, MINE, PERMISSIONS.VENUE_PEOPLE_VIEW))).toBe(
      true,
    );
  });

  it('withholds account labels from a professor, which is what hides them in the list', () => {
    // The service shows the "Aluno"/"Dayuse" badge only to callers holding this,
    // so the professor seeing their students never learns anyone's plan.
    const asProfessor = venueAuthFor(professor, MINE);
    const asOwner = venueAuthFor(owner, MINE);

    expect(asProfessor.permissions).not.toContain(PERMISSIONS.USER_ROLE_LABEL_VIEW);
    expect(asOwner.permissions).toContain(PERMISSIONS.USER_ROLE_LABEL_VIEW);
  });

  it('withholds the staff list from a professor', () => {
    // Same mechanism: the service only includes `staff` for callers who may
    // manage it, so a professor receives an empty list rather than a filtered one.
    const asProfessor = venueAuthFor(professor, MINE);

    expect(asProfessor.permissions).not.toContain(PERMISSIONS.VENUE_STAFF_MANAGE);
  });
});
