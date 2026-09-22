import {
  SKILL_LEVELS,
  WEEKDAY_SHORT_LABELS_PT,
  type DateInput,
  type SkillLevel,
  addDays,
  businessDateKey,
  businessDateTime,
  businessWeekday,
  formatBrDate,
  formatTime,
} from '@futcheck/shared';

/**
 * pt-BR presentation helpers. Every calendar question is delegated to the shared
 * date util so "today" is always the arena's today, not the phone's.
 */

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  [SKILL_LEVELS.INICIANTE]: 'Iniciante',
  [SKILL_LEVELS.INTERMEDIARIO]: 'Intermediário',
  [SKILL_LEVELS.AVANCADO]: 'Avançado',
};

const MONTH_SHORT_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

/** `21/09` */
export function formatDayMonth(value: DateInput): string {
  return formatBrDate(value).slice(0, 5);
}

/** `Sáb, 27/09` */
export function formatWeekdayDate(value: DateInput): string {
  return `${WEEKDAY_SHORT_LABELS_PT[businessWeekday(value)]}, ${formatDayMonth(value)}`;
}

/** `Hoje`, `Amanhã` or `Sáb, 27/09`, relative to the arena's calendar. */
export function formatRelativeDay(value: DateInput, now: DateInput = new Date()): string {
  const key = businessDateKey(value);
  if (key === businessDateKey(now)) return 'Hoje';
  if (key === businessDateKey(addDays(now, 1))) return 'Amanhã';
  return formatWeekdayDate(value);
}

/** `hoje às 19:30`, `amanhã às 08:00`, `sáb, 27/09 às 09:00` */
export function formatRelativeMoment(value: DateInput, now: DateInput = new Date()): string {
  return `${formatRelativeDay(value, now).toLowerCase()} às ${formatTime(value)}`;
}

/** `19:00 – 20:30` */
export function formatTimeRange(startsAt: DateInput, endsAt: DateInput): string {
  return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}

/** `850 m` below one kilometre, `1,2 km` above. */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  }
  const digits = km < 10 ? 1 : 0;
  return `${km.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} km`;
}

/** Up to two initials, for avatars without a photo. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** Monday-first week containing `value`, as seven `YYYY-MM-DD` keys. */
export function weekKeysContaining(value: DateInput): string[] {
  const weekday = businessWeekday(value);
  const daysSinceMonday = (weekday + 6) % 7;
  const mondayKey = businessDateKey(addDays(value, -daysSinceMonday));
  // Anchoring on noon keeps the arithmetic clear of any midnight edge.
  const monday = businessDateTime(mondayKey, '12:00');
  return Array.from({ length: 7 }, (_, index) => businessDateKey(addDays(monday, index)));
}

/** The instant at noon of a business day key — a safe anchor for weekday/label lookups. */
export function noonOf(dateKey: string): Date {
  return businessDateTime(dateKey, '12:00');
}

/** `22 – 28 set` or `29 set – 5 out` */
export function formatWeekRange(keys: readonly string[]): string {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return '';
  const [, firstMonth, firstDay] = first.split('-').map(Number);
  const [, lastMonth, lastDay] = last.split('-').map(Number);
  const monthLabel = (month: number | undefined) => MONTH_SHORT_PT[(month ?? 1) - 1] ?? '';
  if (firstMonth === lastMonth) {
    return `${firstDay} – ${lastDay} ${monthLabel(lastMonth)}`;
  }
  return `${firstDay} ${monthLabel(firstMonth)} – ${lastDay} ${monthLabel(lastMonth)}`;
}

/** Greeting that matches the arena's clock. */
export function greetingFor(now: DateInput = new Date()): string {
  const hour = Number(formatTime(now).slice(0, 2));
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}
