import { describe, expect, it } from 'vitest';

import {
  formatDistance,
  formatRelativeDay,
  formatWeekRange,
  greetingFor,
  initialsOf,
  weekKeysContaining,
} from './format';

describe('format helpers', () => {
  it('formats distances the Brazilian way', () => {
    expect(formatDistance(1.234)).toBe('1,2 km');
    expect(formatDistance(0.853)).toBe('850 m');
    expect(formatDistance(12.6)).toBe('13 km');
  });

  it('builds initials from the first and last names', () => {
    expect(initialsOf('Ana Maria Souza')).toBe('AS');
    expect(initialsOf('  pelé ')).toBe('P');
    expect(initialsOf('')).toBe('?');
  });

  it('resolves today in São Paulo, not in UTC', () => {
    // Sunday 23:30 in São Paulo is already Monday in UTC.
    const sundayNight = new Date('2026-09-28T02:30:00.000Z');
    expect(formatRelativeDay(sundayNight, sundayNight)).toBe('Hoje');
    expect(weekKeysContaining(sundayNight)[0]).toBe('2026-09-21');
    expect(weekKeysContaining(sundayNight)[6]).toBe('2026-09-27');
  });

  it('labels a week that spans two months', () => {
    expect(formatWeekRange(weekKeysContaining(new Date('2026-09-30T15:00:00.000Z')))).toBe(
      '28 set – 4 out',
    );
  });

  it('greets by the arena clock', () => {
    expect(greetingFor(new Date('2026-09-22T11:00:00.000Z'))).toBe('Bom dia');
    expect(greetingFor(new Date('2026-09-22T23:00:00.000Z'))).toBe('Boa noite');
  });
});
