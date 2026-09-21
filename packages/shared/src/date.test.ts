import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUSINESS_TIMEZONE,
  addDays,
  businessDateKey,
  businessDateKeyRange,
  businessDateTime,
  businessWeekday,
  endOfBusinessDay,
  formatBrDate,
  formatBrDateTime,
  formatTime,
  getBusinessTimezone,
  isSameBusinessDay,
  isWithin,
  minutesBetween,
  nextBusinessDateKeyForWeekday,
  startOfBusinessDay,
  subtractMinutes,
} from './date.js';

/**
 * Reference instant: Sunday 2026-09-20 23:30 in São Paulo.
 * In UTC that is Monday 2026-09-21 02:30 — the canonical trap this util exists to
 * avoid. Brazil has had no DST since 2019, so the offset is a constant -03:00.
 */
const SUNDAY_LATE_NIGHT_SP = new Date('2026-09-21T02:30:00.000Z');

describe('business timezone', () => {
  it('defaults to America/Sao_Paulo', () => {
    expect(getBusinessTimezone()).toBe(DEFAULT_BUSINESS_TIMEZONE);
  });
});

describe('businessWeekday', () => {
  it('reports Sunday for 23:30 in São Paulo, even though it is Monday in UTC', () => {
    expect(SUNDAY_LATE_NIGHT_SP.getUTCDay()).toBe(1); // Monday in UTC
    expect(businessWeekday(SUNDAY_LATE_NIGHT_SP)).toBe(0); // Sunday for the arena
  });

  it('rolls over to Monday only after midnight in São Paulo', () => {
    const justBeforeMidnight = new Date('2026-09-21T02:59:59.000Z'); // 23:59:59 local
    const justAfterMidnight = new Date('2026-09-21T03:00:00.000Z'); // 00:00:00 local

    expect(businessWeekday(justBeforeMidnight)).toBe(0);
    expect(businessWeekday(justAfterMidnight)).toBe(1);
  });
});

describe('businessDateKey', () => {
  it('keeps a late Sunday night on the Sunday', () => {
    expect(businessDateKey(SUNDAY_LATE_NIGHT_SP)).toBe('2026-09-20');
  });

  it('treats two instants on the same local day as the same day', () => {
    const morning = new Date('2026-09-20T12:00:00.000Z'); // 09:00 local
    expect(isSameBusinessDay(morning, SUNDAY_LATE_NIGHT_SP)).toBe(true);
  });

  it('treats the following local day as a different day', () => {
    const nextMorning = new Date('2026-09-21T12:00:00.000Z'); // Monday 09:00 local
    expect(isSameBusinessDay(SUNDAY_LATE_NIGHT_SP, nextMorning)).toBe(false);
  });
});

describe('start/end of business day', () => {
  it('starts the day at 00:00 São Paulo (03:00 UTC)', () => {
    expect(startOfBusinessDay(SUNDAY_LATE_NIGHT_SP).toISOString()).toBe('2026-09-20T03:00:00.000Z');
  });

  it('ends the day at 23:59:59.999 São Paulo, which is already the next UTC day', () => {
    expect(endOfBusinessDay(SUNDAY_LATE_NIGHT_SP).toISOString()).toBe('2026-09-21T02:59:59.999Z');
  });

  it('gives the professor an edit deadline that covers the whole local day', () => {
    // Section 6: the professor edits the checklist until 23:59 of the session day.
    const deadline = endOfBusinessDay(SUNDAY_LATE_NIGHT_SP);
    expect(SUNDAY_LATE_NIGHT_SP.getTime()).toBeLessThan(deadline.getTime());
  });
});

describe('businessDateTime', () => {
  it('converts a local wall-clock time into the right UTC instant', () => {
    expect(businessDateTime('2026-09-20', '23:30').toISOString()).toBe('2026-09-21T02:30:00.000Z');
    expect(businessDateTime('2026-09-21', '19:00').toISOString()).toBe('2026-09-21T22:00:00.000Z');
  });

  it('accepts HH:mm:ss from Postgres time columns', () => {
    expect(businessDateTime('2026-09-21', '19:00:00').toISOString()).toBe(
      businessDateTime('2026-09-21', '19:00').toISOString(),
    );
  });

  it('rejects malformed times instead of guessing', () => {
    expect(() => businessDateTime('2026-09-21', '7:00')).toThrow(/expected HH:mm/);
    expect(() => businessDateTime('2026-09-21', 'noite')).toThrow(/expected HH:mm/);
  });

  it('round-trips through businessDateKey', () => {
    const instant = businessDateTime('2026-09-20', '23:30');
    expect(businessDateKey(instant)).toBe('2026-09-20');
    expect(businessWeekday(instant)).toBe(0);
  });
});

describe('nextBusinessDateKeyForWeekday', () => {
  const monday = new Date('2026-09-21T12:00:00.000Z'); // Monday 09:00 local

  it('returns the same day when it already matches', () => {
    expect(nextBusinessDateKeyForWeekday(1, monday)).toBe('2026-09-21');
  });

  it('walks forward to the next matching weekday', () => {
    expect(nextBusinessDateKeyForWeekday(4, monday)).toBe('2026-09-24'); // Thursday
    expect(nextBusinessDateKeyForWeekday(5, monday)).toBe('2026-09-25'); // Friday
  });

  it('wraps into the next week', () => {
    expect(nextBusinessDateKeyForWeekday(0, monday)).toBe('2026-09-27'); // Sunday
  });

  it('anchors on the local day, not the UTC day', () => {
    // 23:30 local Sunday: the next Sunday-template session is that very day.
    expect(nextBusinessDateKeyForWeekday(0, SUNDAY_LATE_NIGHT_SP)).toBe('2026-09-20');
  });
});

describe('businessDateKeyRange', () => {
  it('produces consecutive local day keys', () => {
    expect(businessDateKeyRange(new Date('2026-09-21T12:00:00.000Z'), 4)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
    ]);
  });

  it('covers four weeks of generation without gaps', () => {
    const range = businessDateKeyRange(new Date('2026-09-21T12:00:00.000Z'), 28);
    expect(range).toHaveLength(28);
    expect(new Set(range).size).toBe(28);
    expect(range.at(-1)).toBe('2026-10-18');
  });

  it('rejects a negative length', () => {
    expect(() => businessDateKeyRange(new Date(), -1)).toThrow();
  });
});

describe('instant arithmetic', () => {
  const start = businessDateTime('2026-09-21', '19:00');

  it('computes the RSVP change deadline (2h before)', () => {
    expect(subtractMinutes(start, 120).toISOString()).toBe('2026-09-21T20:00:00.000Z');
  });

  it('computes the check-in opening (30min before)', () => {
    expect(minutesBetween(subtractMinutes(start, 30), start)).toBe(30);
  });

  it('adds days across the local calendar', () => {
    expect(businessDateKey(addDays(start, 7))).toBe('2026-09-28');
  });

  it('bounds the self check-in window around the start', () => {
    const from = subtractMinutes(start, 30);
    const to = new Date(start.getTime() + 30 * 60_000);

    expect(isWithin(start, from, to)).toBe(true);
    expect(isWithin(subtractMinutes(start, 31), from, to)).toBe(false);
  });
});

describe('pt-BR formatting', () => {
  it('formats dates and times in the business timezone', () => {
    expect(formatBrDate(SUNDAY_LATE_NIGHT_SP)).toBe('20/09/2026');
    expect(formatTime(SUNDAY_LATE_NIGHT_SP)).toBe('23:30');
    expect(formatBrDateTime(SUNDAY_LATE_NIGHT_SP)).toBe('20/09/2026 23:30');
  });
});
