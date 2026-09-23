import { Router } from 'express';

import { PERMISSIONS, changePasswordSchema, updateProfileSchema } from '@futcheck/shared';

import { authenticate } from '../../middlewares/authenticate.js';
import { requirePermission } from '../../middlewares/requirePermission.js';
import { uploadRateLimit } from '../../middlewares/rateLimit.js';
import { uploadImage } from '../../middlewares/upload.js';
import { validateBody } from '../../middlewares/validate.js';
import * as controller from './me.controller.js';

export const meRoutes: Router = Router();

meRoutes.use(authenticate, requirePermission(PERMISSIONS.PROFILE_MANAGE_OWN));

meRoutes.get('/', controller.getMe);
meRoutes.patch('/', validateBody(updateProfileSchema), controller.updateMe);
meRoutes.patch('/password', validateBody(changePasswordSchema), controller.changePassword);
meRoutes.get('/bookings', controller.myBookings);

meRoutes.put('/avatar', uploadRateLimit, uploadImage, controller.updateAvatar);
meRoutes.delete('/avatar', controller.removeAvatar);
