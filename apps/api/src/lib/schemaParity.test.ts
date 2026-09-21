import { describe, expect, it } from 'vitest';

import {
  BOOKING_STATUS_VALUES,
  ROLE_VALUES,
  SESSION_STATUS_VALUES,
  SESSION_TYPE_VALUES,
  SKILL_LEVEL_VALUES,
} from '@futcheck/shared';

import {
  BookingStatus,
  Role,
  SessionStatus,
  SessionType,
  SkillLevel,
} from '../generated/prisma/enums.js';

/**
 * `packages/shared` is the source of truth for domain enums and `schema.prisma`
 * mirrors it. Nothing in Prisma enforces that, so this test is the guard: adding a
 * value on one side without the other fails the build.
 */
describe('Prisma schema matches the shared enums', () => {
  const cases: Array<[string, readonly string[], Record<string, string>]> = [
    ['Role', ROLE_VALUES, Role],
    ['SessionType', SESSION_TYPE_VALUES, SessionType],
    ['SessionStatus', SESSION_STATUS_VALUES, SessionStatus],
    ['BookingStatus', BOOKING_STATUS_VALUES, BookingStatus],
    ['SkillLevel', SKILL_LEVEL_VALUES, SkillLevel],
  ];

  it.each(cases)('%s has the same values on both sides', (_name, sharedValues, prismaEnum) => {
    expect(Object.values(prismaEnum).sort()).toEqual([...sharedValues].sort());
  });
});
