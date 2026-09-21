/**
 * System settings (section 6).
 *
 * Each entry is one row in the `settings` table (`key`, `value` jsonb). The schema
 * below is the contract: the API validates writes against it and falls back to
 * `DEFAULT_SETTINGS` for any key that was never written.
 */

import { z } from 'zod';

export const settingsSchema = z.object({
  /** How many days before a session the RSVP window opens. */
  'rsvp.windowOpensDaysBefore': z.number().int().min(0).max(365),

  /**
   * Minutes before the start after which a user can no longer change
   * "Vou" → "Não vou". Past this point only an admin can.
   */
  'rsvp.changeDeadlineMinutesBefore': z.number().int().min(0).max(10_080),

  /** Minutes before the start at which the professor's checklist unlocks. */
  'attendance.checkInOpensMinutesBefore': z.number().int().min(0).max(1_440),

  /**
   * When true, a professor may edit the checklist until 23:59 of the session day
   * (business timezone). Afterwards only ADMIN and SUPER_ADMIN can.
   */
  'attendance.professorEditsUntilEndOfDay': z.boolean(),

  /** Feature flag: lets users check themselves in. Off by default. */
  'attendance.selfCheckInEnabled': z.boolean(),

  /** Half-width of the self check-in window, in minutes around the start time. */
  'attendance.selfCheckInWindowMinutes': z.number().int().min(0).max(240),

  /** How far ahead the generation job materialises sessions from the templates. */
  'sessions.generationWeeksAhead': z.number().int().min(1).max(52),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  'rsvp.windowOpensDaysBefore': 7,
  'rsvp.changeDeadlineMinutesBefore': 120,
  'attendance.checkInOpensMinutesBefore': 30,
  'attendance.professorEditsUntilEndOfDay': true,
  'attendance.selfCheckInEnabled': false,
  'attendance.selfCheckInWindowMinutes': 30,
  'sessions.generationWeeksAhead': 4,
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

/** Per-key schema, for validating a single `PUT /settings` entry. */
export function schemaForSettingKey<K extends SettingKey>(
  key: K,
): (typeof settingsSchema.shape)[K] {
  return settingsSchema.shape[key];
}

/** Fills any missing key with its default, so callers always get a complete object. */
export function withSettingDefaults(stored: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...stored };
}

/** pt-BR labels for the admin settings screen. */
export const SETTING_LABELS_PT: Record<SettingKey, string> = {
  'rsvp.windowOpensDaysBefore': 'Antecedência para abrir as respostas (dias)',
  'rsvp.changeDeadlineMinutesBefore': 'Prazo para alterar a resposta (minutos antes)',
  'attendance.checkInOpensMinutesBefore': 'Liberar lista de presença (minutos antes)',
  'attendance.professorEditsUntilEndOfDay': 'Professor edita a lista até o fim do dia',
  'attendance.selfCheckInEnabled': 'Permitir check-in pelo próprio usuário',
  'attendance.selfCheckInWindowMinutes': 'Janela do check-in do usuário (minutos)',
  'sessions.generationWeeksAhead': 'Semanas de sessões geradas com antecedência',
};
