import { describe, expect, it } from 'vitest';

import {
  BOOKING_STATUSES,
  DEFAULT_SETTINGS,
  ERROR_CODES,
  ROLES,
  SESSION_STATUSES,
  SESSION_TYPES,
  businessDateTime,
  permissionsForRole,
  type BookingStatus,
  type Role,
  type SessionType,
} from '@futcheck/shared';

import { rsvpAvailability, rsvpBlockReason, type RsvpRuleInput } from './rsvpRules.js';

// A Monday 19:00 aula in São Paulo: 2026-09-28 22:00 UTC.
const STARTS_AT = businessDateTime('2026-09-28', '19:00');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function input(overrides: {
  role?: Role;
  type?: SessionType;
  status?: RsvpRuleInput['session']['status'];
  now?: Date;
  currentStatus?: BookingStatus | null;
}): RsvpRuleInput {
  return {
    session: {
      type: overrides.type ?? SESSION_TYPES.AULA,
      status: overrides.status ?? SESSION_STATUSES.ABERTA,
      startsAt: STARTS_AT,
    },
    // Default: one day before — window open, deadline not reached.
    now: overrides.now ?? new Date(STARTS_AT.getTime() - DAY),
    settings: DEFAULT_SETTINGS,
    permissions: permissionsForRole(overrides.role ?? ROLES.ALUNO),
    currentStatus: overrides.currentStatus ?? null,
  };
}

describe('who may answer (section 4.3)', () => {
  it('lets a student answer an aula', () => {
    expect(rsvpBlockReason(input({}), 'VOU')).toBeNull();
  });

  it('refuses a dayuse player on an aula', () => {
    expect(rsvpBlockReason(input({ role: ROLES.DAYUSE }), 'VOU')).toBe(
      ERROR_CODES.RSVP_SESSION_TYPE_NOT_ALLOWED,
    );
  });

  it('lets a dayuse player answer a dayuse', () => {
    expect(
      rsvpBlockReason(input({ role: ROLES.DAYUSE, type: SESSION_TYPES.DAYUSE }), 'VOU'),
    ).toBeNull();
  });

  it('refuses a professor on an aula but not on a dayuse', () => {
    expect(rsvpBlockReason(input({ role: ROLES.PROFESSOR }), 'VOU')).toBe(
      ERROR_CODES.RSVP_SESSION_TYPE_NOT_ALLOWED,
    );
    expect(
      rsvpBlockReason(input({ role: ROLES.PROFESSOR, type: SESSION_TYPES.DAYUSE }), 'VOU'),
    ).toBeNull();
  });

  it('lets admins play both agendas (ADR-18)', () => {
    for (const role of [ROLES.ADMIN, ROLES.SUPER_ADMIN]) {
      expect(rsvpBlockReason(input({ role }), 'VOU')).toBeNull();
      expect(rsvpBlockReason(input({ role, type: SESSION_TYPES.DAYUSE }), 'VOU')).toBeNull();
    }
  });

  it('names the type problem before any timing problem', () => {
    // The user should hear the reason that actually matters.
    const tooLate = new Date(STARTS_AT.getTime() + HOUR);
    expect(rsvpBlockReason(input({ role: ROLES.DAYUSE, now: tooLate }), 'VOU')).toBe(
      ERROR_CODES.RSVP_SESSION_TYPE_NOT_ALLOWED,
    );
  });
});

describe('session state', () => {
  it('refuses a cancelled session', () => {
    expect(rsvpBlockReason(input({ status: SESSION_STATUSES.CANCELADA }), 'VOU')).toBe(
      ERROR_CODES.RSVP_SESSION_CANCELLED,
    );
  });

  it('refuses a session that has already started', () => {
    expect(rsvpBlockReason(input({ now: STARTS_AT }), 'VOU')).toBe(
      ERROR_CODES.RSVP_SESSION_IN_PAST,
    );
  });

  it('refuses a closed session', () => {
    expect(rsvpBlockReason(input({ status: SESSION_STATUSES.ENCERRADA }), 'VOU')).toBe(
      ERROR_CODES.RSVP_SESSION_IN_PAST,
    );
  });

  it('refuses to rewrite an answer once attendance is recorded', () => {
    for (const currentStatus of [BOOKING_STATUSES.PRESENTE, BOOKING_STATUSES.FALTOU]) {
      expect(rsvpBlockReason(input({ currentStatus }), 'NAO_VOU')).toBe(
        ERROR_CODES.RSVP_DEADLINE_PASSED,
      );
    }
  });
});

describe('answer window (7 days by default)', () => {
  it('is closed eight days before', () => {
    expect(rsvpBlockReason(input({ now: new Date(STARTS_AT.getTime() - 8 * DAY) }), 'VOU')).toBe(
      ERROR_CODES.RSVP_WINDOW_NOT_OPEN,
    );
  });

  it('opens exactly seven days before', () => {
    expect(
      rsvpBlockReason(input({ now: new Date(STARTS_AT.getTime() - 7 * DAY) }), 'VOU'),
    ).toBeNull();
  });
});

describe('change deadline (2 hours before by default)', () => {
  const afterDeadline = new Date(STARTS_AT.getTime() - HOUR);
  const beforeDeadline = new Date(STARTS_AT.getTime() - 3 * HOUR);

  it('lets a confirmed player drop out before the deadline', () => {
    expect(
      rsvpBlockReason(
        input({ now: beforeDeadline, currentStatus: BOOKING_STATUSES.CONFIRMADA }),
        'NAO_VOU',
      ),
    ).toBeNull();
  });

  it('stops a confirmed player dropping out after the deadline', () => {
    expect(
      rsvpBlockReason(
        input({ now: afterDeadline, currentStatus: BOOKING_STATUSES.CONFIRMADA }),
        'NAO_VOU',
      ),
    ).toBe(ERROR_CODES.RSVP_DEADLINE_PASSED);
  });

  it('still takes a late "Vou" — a late yes harms nobody', () => {
    expect(rsvpBlockReason(input({ now: afterDeadline }), 'VOU')).toBeNull();
  });

  it('still lets someone leave the waitlist late — they hold no seat', () => {
    expect(
      rsvpBlockReason(
        input({ now: afterDeadline, currentStatus: BOOKING_STATUSES.LISTA_ESPERA }),
        'NAO_VOU',
      ),
    ).toBeNull();
  });
});

describe('rsvpAvailability', () => {
  it('reports the window instants the UI shows', () => {
    const { window } = rsvpAvailability(input({}));

    expect(window.opensAt.toISOString()).toBe(
      new Date(STARTS_AT.getTime() - 7 * DAY).toISOString(),
    );
    expect(window.changeDeadline.toISOString()).toBe(
      new Date(STARTS_AT.getTime() - 2 * HOUR).toISOString(),
    );
  });

  it('locks the button for a confirmed player past the deadline', () => {
    const result = rsvpAvailability(
      input({
        now: new Date(STARTS_AT.getTime() - HOUR),
        currentStatus: BOOKING_STATUSES.CONFIRMADA,
      }),
    );

    expect(result).toMatchObject({
      canAnswer: false,
      blockedReason: ERROR_CODES.RSVP_DEADLINE_PASSED,
    });
  });

  it('agrees with rsvpBlockReason for a normal open session', () => {
    const result = rsvpAvailability(input({}));

    expect(result.canAnswer).toBe(true);
    expect(result.blockedReason).toBeNull();
  });
});
