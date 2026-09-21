/**
 * The one and only date utility.
 *
 * Rules of the road:
 * - Instants are stored as UTC (`timestamptz`) and travel as `Date`/ISO strings.
 * - "Today", "weekday", "end of day" and every deadline are resolved in the
 *   business timezone (America/São Paulo by default), never in the server's
 *   local timezone and never in UTC.
 * - No other module may call dayjs' timezone helpers directly.
 */

import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';

import { type Weekday, isWeekday } from './enums.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export const DEFAULT_BUSINESS_TIMEZONE = 'America/Sao_Paulo';

let businessTimezone: string = DEFAULT_BUSINESS_TIMEZONE;

/** Set once at boot from `BUSINESS_TIMEZONE`. */
export function configureBusinessTimezone(timezoneName: string): void {
  if (!timezoneName.trim()) {
    throw new Error('Business timezone cannot be empty');
  }
  // Fails fast on a typo instead of silently falling back to UTC.
  dayjs().tz(timezoneName);
  businessTimezone = timezoneName;
}

export function getBusinessTimezone(): string {
  return businessTimezone;
}

/** Any value we accept as an instant. */
export type DateInput = Date | string | number | Dayjs;

/** The given instant, viewed through the business timezone. */
export function inBusinessTime(value: DateInput = new Date()): Dayjs {
  return dayjs(value).tz(businessTimezone);
}

export function now(): Date {
  return new Date();
}

// -----------------------------------------------------------------------------
// Calendar questions — always answered in business time
// -----------------------------------------------------------------------------

/** 0 = Sunday … 6 = Saturday, as seen from the arena. */
export function businessWeekday(value: DateInput = new Date()): Weekday {
  const day = inBusinessTime(value).day();
  if (!isWeekday(day)) {
    throw new Error(`Unexpected weekday: ${String(day)}`);
  }
  return day;
}

/** `YYYY-MM-DD` of the business day an instant belongs to. */
export function businessDateKey(value: DateInput = new Date()): string {
  return inBusinessTime(value).format('YYYY-MM-DD');
}

/** The instant at which the business day starts (00:00 local), as UTC. */
export function startOfBusinessDay(value: DateInput = new Date()): Date {
  return inBusinessTime(value).startOf('day').toDate();
}

/** The last instant of the business day (23:59:59.999 local), as UTC. */
export function endOfBusinessDay(value: DateInput = new Date()): Date {
  return inBusinessTime(value).endOf('day').toDate();
}

export function isSameBusinessDay(a: DateInput, b: DateInput): boolean {
  return businessDateKey(a) === businessDateKey(b);
}

/**
 * Turns a business-local date and wall-clock time into a UTC instant.
 * This is how `schedule_templates` (weekday + HH:mm) become concrete sessions.
 */
export function businessDateTime(dateKey: string, time: string): Date {
  const parsed = dayjs.tz(
    `${dateKey} ${normalizeTime(time)}`,
    'YYYY-MM-DD HH:mm',
    businessTimezone,
  );
  if (!parsed.isValid()) {
    throw new Error(`Invalid business date/time: ${dateKey} ${time}`);
  }
  return parsed.toDate();
}

/** Accepts `HH:mm` and `HH:mm:ss`, normalising to `HH:mm`. */
function normalizeTime(time: string): string {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!match) {
    throw new Error(`Invalid time, expected HH:mm: ${time}`);
  }
  return `${match[1]}:${match[2]}`;
}

/**
 * The first business day on/after `from` that falls on `weekday`.
 * Returns the `YYYY-MM-DD` key, which callers pair with a template's start time.
 */
export function nextBusinessDateKeyForWeekday(
  weekday: Weekday,
  from: DateInput = new Date(),
): string {
  const start = inBusinessTime(from).startOf('day');
  const offset = (weekday - start.day() + 7) % 7;
  return start.add(offset, 'day').format('YYYY-MM-DD');
}

/** Consecutive business-day keys, starting at `from`. Used by session generation. */
export function businessDateKeyRange(from: DateInput, days: number): string[] {
  if (days < 0) {
    throw new Error(`Range length cannot be negative: ${days}`);
  }
  const start = inBusinessTime(from).startOf('day');
  return Array.from({ length: days }, (_, index) => start.add(index, 'day').format('YYYY-MM-DD'));
}

// -----------------------------------------------------------------------------
// Arithmetic on instants
// -----------------------------------------------------------------------------

export function addMinutes(value: DateInput, minutes: number): Date {
  return dayjs(value).add(minutes, 'minute').toDate();
}

export function addHours(value: DateInput, hours: number): Date {
  return dayjs(value).add(hours, 'hour').toDate();
}

export function addDays(value: DateInput, days: number): Date {
  return dayjs(value).add(days, 'day').toDate();
}

export function subtractMinutes(value: DateInput, minutes: number): Date {
  return dayjs(value).subtract(minutes, 'minute').toDate();
}

export function subtractDays(value: DateInput, days: number): Date {
  return dayjs(value).subtract(days, 'day').toDate();
}

export function minutesBetween(from: DateInput, to: DateInput): number {
  return dayjs(to).diff(dayjs(from), 'minute');
}

export function isBefore(a: DateInput, b: DateInput): boolean {
  return dayjs(a).isBefore(dayjs(b));
}

export function isAfter(a: DateInput, b: DateInput): boolean {
  return dayjs(a).isAfter(dayjs(b));
}

export function isWithin(value: DateInput, start: DateInput, end: DateInput): boolean {
  const target = dayjs(value);
  return target.isSameOrAfter(dayjs(start)) && target.isSameOrBefore(dayjs(end));
}

// -----------------------------------------------------------------------------
// Presentation — pt-BR, business timezone
// -----------------------------------------------------------------------------

/** `21/09/2026` */
export function formatBrDate(value: DateInput): string {
  return inBusinessTime(value).format('DD/MM/YYYY');
}

/** `21/09/2026 19:30` */
export function formatBrDateTime(value: DateInput): string {
  return inBusinessTime(value).format('DD/MM/YYYY HH:mm');
}

/** `19:30` */
export function formatTime(value: DateInput): string {
  return inBusinessTime(value).format('HH:mm');
}

/** ISO 8601 with offset, for API payloads. */
export function toIso(value: DateInput): string {
  return dayjs(value).toISOString();
}
