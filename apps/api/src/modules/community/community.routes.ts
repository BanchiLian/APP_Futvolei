import { Router } from 'express';

import { PERMISSIONS } from '@futcheck/shared';

import { authenticate } from '../../middlewares/authenticate.js';
import { requirePermission } from '../../middlewares/requirePermission.js';
import * as controller from './community.controller.js';

export const communityRoutes: Router = Router();

communityRoutes.use(authenticate, requirePermission(PERMISSIONS.COMMUNITY_VIEW));

communityRoutes.get('/', controller.list);
