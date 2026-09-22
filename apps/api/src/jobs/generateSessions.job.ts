import cron from 'node-cron';

import { getBusinessTimezone } from '@futcheck/shared';

import { logger } from '../lib/logger.js';
import { generateSessions } from '../modules/sessions/sessions.service.js';

/**
 * Daily materialisation of the next weeks of sessions (section 5).
 *
 * Scheduled in the business timezone, not the server's, so "03:00" means 03:00 in
 * São Paulo on any host. Also runs once at boot, so a fresh deployment has an
 * agenda without waiting for the night. Generation is idempotent, so the overlap
 * between the boot run and the schedule is harmless.
 */
export function startSessionGenerationJob(): void {
  const run = async (reason: string) => {
    try {
      await generateSessions();
    } catch (error) {
      logger.error({ err: error, reason }, 'session generation failed');
    }
  };

  void run('boot');

  cron.schedule('0 3 * * *', () => void run('schedule'), {
    timezone: getBusinessTimezone(),
    name: 'generate-sessions',
  });
}
