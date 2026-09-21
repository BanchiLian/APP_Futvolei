import type { Request, Response } from 'express';

import { getBusinessTimezone, toIso } from '@futcheck/shared';

import { env } from '../../config/env.js';
import { pingDatabase } from '../../lib/prisma.js';

/**
 * Liveness: is the process up? Deliberately does not touch the database, so an
 * outage in Postgres does not make an orchestrator kill a healthy API.
 */
export function health(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    environment: env.NODE_ENV,
    timezone: getBusinessTimezone(),
    time: toIso(new Date()),
    uptime: Math.round(process.uptime()),
  });
}

/** Readiness: can the API actually serve traffic? Checks the database. */
export async function ready(_req: Request, res: Response): Promise<void> {
  const database = await pingDatabase();

  res.status(database ? 200 : 503).json({
    status: database ? 'ready' : 'degraded',
    checks: { database: database ? 'up' : 'down' },
    time: toIso(new Date()),
  });
}
