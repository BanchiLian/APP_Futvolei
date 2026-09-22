import { Router } from 'express';

import { PERMISSIONS } from '@futcheck/shared';

import { authenticate } from '../../middlewares/authenticate.js';
import { requirePermission } from '../../middlewares/requirePermission.js';
import * as controller from './venues.controller.js';

export const venuesRoutes: Router = Router();

venuesRoutes.use(authenticate, requirePermission(PERMISSIONS.VENUE_VIEW));

venuesRoutes.get('/', controller.list);
venuesRoutes.get('/:id', controller.detail);
