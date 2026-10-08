import { describe, expect, it } from 'vitest';

import {
  ERROR_CODES,
  PERMISSIONS,
  ROLES,
  SESSION_STATUSES,
  VENUE_ROLES,
  permissionsForRole,
  permissionsInVenue,
  type Permission,
} from '@futcheck/shared';

import {
  attendanceBlockReason,
  attendanceEditDeadline,
  attendanceOpensAt,
} from './attendanceRules.js';

const SETTINGS = {
  'attendance.checkInOpensMinutesBefore': 30,
  'attendance.professorEditsUntilEndOfDay': true,
} as const;

/** 2026-10-07 19:00 in São Paulo (UTC−3) is 22:00 UTC. */
const STARTS_AT = new Date('2026-10-07T22:00:00.000Z');

function input(overrides: {
  now: Date;
  permissions: readonly Permission[];
  isResponsible?: boolean;
  status?: (typeof SESSION_STATUSES)[keyof typeof SESSION_STATUSES];
}) {
  return {
    session: { status: overrides.status ?? SESSION_STATUSES.ABERTA, startsAt: STARTS_AT },
    now: overrides.now,
    settings: SETTINGS,
    permissions: overrides.permissions,
    isResponsible: overrides.isResponsible ?? true,
  };
}

/** A plain student who happens to teach at a CT: authority comes from the CT. */
const professorAtVenue = permissionsInVenue(ROLES.ALUNO, VENUE_ROLES.PROFESSOR);
const ownerAtVenue = permissionsInVenue(ROLES.ALUNO, VENUE_ROLES.OWNER);
const player = permissionsForRole(ROLES.ALUNO);

describe('when the checklist opens', () => {
  it('unlocks the configured number of minutes before the start', () => {
    expect(attendanceOpensAt(STARTS_AT, SETTINGS).toISOString()).toBe('2026-10-07T21:30:00.000Z');
  });

  it('is closed before that', () => {
    const tooEarly = new Date('2026-10-07T21:00:00.000Z');

    expect(attendanceBlockReason(input({ now: tooEarly, permissions: professorAtVenue }))).toBe(
      ERROR_CODES.ATTENDANCE_WINDOW_NOT_OPEN,
    );
  });

  it('is open once the window starts', () => {
    const inWindow = new Date('2026-10-07T21:45:00.000Z');

    expect(
      attendanceBlockReason(input({ now: inWindow, permissions: professorAtVenue })),
    ).toBeNull();
  });
});

describe('who may edit', () => {
  const duringSession = new Date('2026-10-07T22:15:00.000Z');

  it('refuses someone with no attendance permission at all', () => {
    expect(attendanceBlockReason(input({ now: duringSession, permissions: player }))).toBe(
      ERROR_CODES.FORBIDDEN,
    );
  });

  it('refuses a professor on a session they do not run', () => {
    expect(
      attendanceBlockReason(
        input({ now: duringSession, permissions: professorAtVenue, isResponsible: false }),
      ),
    ).toBe(ERROR_CODES.ATTENDANCE_NOT_RESPONSIBLE);
  });

  it('lets whoever runs the CT edit a session they are not responsible for', () => {
    expect(
      attendanceBlockReason(
        input({ now: duringSession, permissions: ownerAtVenue, isResponsible: false }),
      ),
    ).toBeNull();
  });

  it('refuses a cancelled session', () => {
    expect(
      attendanceBlockReason(
        input({
          now: duringSession,
          permissions: ownerAtVenue,
          status: SESSION_STATUSES.CANCELADA,
        }),
      ),
    ).toBe(ERROR_CODES.RSVP_SESSION_CANCELLED);
  });
});

describe('the professor deadline', () => {
  it('ends at the close of the session day', () => {
    const deadline = attendanceEditDeadline(STARTS_AT, {
      settings: SETTINGS,
      permissions: professorAtVenue,
    });

    // 23:59:59.999 of 7 October in São Paulo is 02:59 UTC on the 8th.
    expect(deadline?.toISOString()).toBe('2026-10-08T02:59:59.999Z');
  });

  it('does not apply to whoever runs the CT', () => {
    expect(
      attendanceEditDeadline(STARTS_AT, { settings: SETTINGS, permissions: ownerAtVenue }),
    ).toBeNull();
  });

  it('closes the professor out the next day', () => {
    const nextDay = new Date('2026-10-08T14:00:00.000Z');

    expect(attendanceBlockReason(input({ now: nextDay, permissions: professorAtVenue }))).toBe(
      ERROR_CODES.ATTENDANCE_EDIT_DEADLINE_PASSED,
    );
  });

  it('still lets the CT owner correct it the next day', () => {
    const nextDay = new Date('2026-10-08T14:00:00.000Z');

    expect(attendanceBlockReason(input({ now: nextDay, permissions: ownerAtVenue }))).toBeNull();
  });
});

describe('venue scoping', () => {
  it('grants nothing extra without a membership', () => {
    expect(permissionsInVenue(ROLES.ALUNO, null)).toEqual(permissionsForRole(ROLES.ALUNO));
  });

  it('does not let a CT owner manage accounts or settings', () => {
    expect(ownerAtVenue).not.toContain(PERMISSIONS.USER_MANAGE);
    expect(ownerAtVenue).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(ownerAtVenue).not.toContain(PERMISSIONS.ADMIN_MANAGE);
    expect(ownerAtVenue).not.toContain(PERMISSIONS.AUDIT_VIEW);
  });

  it('gives the CT owner the grid and the sessions of their CT', () => {
    expect(ownerAtVenue).toContain(PERMISSIONS.SCHEDULE_MANAGE);
    expect(ownerAtVenue).toContain(PERMISSIONS.SESSION_MANAGE);
    expect(ownerAtVenue).toContain(PERMISSIONS.VENUE_STAFF_MANAGE);
  });

  it('keeps a professor away from the grid and the staff', () => {
    expect(professorAtVenue).not.toContain(PERMISSIONS.SCHEDULE_MANAGE);
    expect(professorAtVenue).not.toContain(PERMISSIONS.VENUE_STAFF_MANAGE);
    expect(professorAtVenue).not.toContain(PERMISSIONS.ATTENDANCE_MANAGE_ANY);
  });

  it('leaves the super admin able to act anywhere with no membership', () => {
    const superAdmin = permissionsInVenue(ROLES.SUPER_ADMIN, null);

    expect(superAdmin).toContain(PERMISSIONS.ATTENDANCE_MANAGE_ANY);
    expect(superAdmin).toContain(PERMISSIONS.VENUE_STAFF_MANAGE);
    expect(superAdmin).toContain(PERMISSIONS.AUDIT_VIEW);
  });
});
