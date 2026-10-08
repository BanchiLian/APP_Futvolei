import { Router } from 'express';

import { PERMISSIONS, attendanceMarkSchema, walkInSchema } from '@futcheck/shared';

import { authenticate } from '../../middlewares/authenticate.js';
import { requireAnyPermission } from '../../middlewares/requirePermission.js';
import { validateBody } from '../../middlewares/validate.js';
import * as controller from './attendance.controller.js';

/**
 * The checklist.
 *
 * The gate here is coarse on purpose: it only asks "could this account ever mark
 * attendance anywhere?". Whether they may mark *this* session, at *that* CT, is
 * decided in the service, which is the only layer that knows which CT the session
 * belongs to. A professor at one CT reaching a sheet at another is exactly the
 * IDOR this split prevents.
 */
export const attendanceRoutes: Router = Router();

attendanceRoutes.use(
  authenticate,
  requireAnyPermission(PERMISSIONS.ATTENDANCE_MANAGE_OWN, PERMISSIONS.ATTENDANCE_MANAGE_ANY),
);

attendanceRoutes.get('/mine', controller.mySessions);
attendanceRoutes.get('/:id', controller.sheet);
attendanceRoutes.patch('/:id', validateBody(attendanceMarkSchema), controller.mark);
attendanceRoutes.post('/:id/walk-in', validateBody(walkInSchema), controller.walkIn);
