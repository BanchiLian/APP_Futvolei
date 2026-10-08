import { Router } from 'express';

import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { communityRoutes } from './modules/community/community.routes.js';
import { feedRoutes } from './modules/feed/feed.routes.js';
import { meRoutes } from './modules/me/me.routes.js';
import { staffRoutes } from './modules/staff/staff.routes.js';
import { sessionsRoutes } from './modules/sessions/sessions.routes.js';
import { venuesRoutes } from './modules/venues/venues.routes.js';

/**
 * The versioned API surface (`/api/v1`).
 *
 * Modules are mounted here as each phase lands: auth, users, schedules, sessions,
 * bookings, attendance, settings, reports and audit.
 */
export const apiRoutes: Router = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/me', meRoutes);
apiRoutes.use('/sessions', sessionsRoutes);
apiRoutes.use('/attendance', attendanceRoutes);
apiRoutes.use('/staff', staffRoutes);
apiRoutes.use('/venues', venuesRoutes);
apiRoutes.use('/community', communityRoutes);
apiRoutes.use('/feed', feedRoutes);

apiRoutes.get('/', (_req, res) => {
  res.json({
    name: 'FutCheck API',
    version: 'v1',
    docs: '/api/docs',
  });
});
