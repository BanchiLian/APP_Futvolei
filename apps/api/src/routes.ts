import { Router } from 'express';

/**
 * The versioned API surface (`/api/v1`).
 *
 * Modules are mounted here as each phase lands: auth, users, schedules, sessions,
 * bookings, attendance, settings, reports and audit.
 */
export const apiRoutes: Router = Router();

apiRoutes.get('/', (_req, res) => {
  res.json({
    name: 'FutCheck API',
    version: 'v1',
    docs: '/api/docs',
  });
});
