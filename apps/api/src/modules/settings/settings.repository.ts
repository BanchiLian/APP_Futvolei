import {
  SETTING_KEYS,
  schemaForSettingKey,
  withSettingDefaults,
  type SettingKey,
  type Settings,
} from '@futcheck/shared';

import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

/**
 * Reads every setting, falling back to the default for any key never written.
 *
 * A stored value that no longer matches its schema (a hand-edited row, say) is
 * ignored in favour of the default rather than trusted: a malformed deadline must
 * not silently disable the RSVP rules.
 */
export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: SETTING_KEYS } },
    select: { key: true, value: true },
  });

  const stored: Partial<Record<SettingKey, unknown>> = {};

  for (const row of rows) {
    const key = row.key as SettingKey;
    const parsed = schemaForSettingKey(key).safeParse(row.value);

    if (parsed.success) {
      stored[key] = parsed.data;
    } else {
      logger.warn({ key }, 'ignoring malformed setting, using the default');
    }
  }

  return withSettingDefaults(stored as Partial<Settings>);
}
