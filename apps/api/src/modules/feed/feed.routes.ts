import { Router } from 'express';

import { PERMISSIONS } from '@futcheck/shared';

import { authenticate } from '../../middlewares/authenticate.js';
import { requirePermission } from '../../middlewares/requirePermission.js';
import { uploadRateLimit } from '../../middlewares/rateLimit.js';
import { uploadImage } from '../../middlewares/upload.js';
import * as controller from './feed.controller.js';

export const feedRoutes: Router = Router();

feedRoutes.use(authenticate, requirePermission(PERMISSIONS.FEED_VIEW));

feedRoutes.get('/', controller.list);

// Uploads are the most expensive thing an authenticated user can ask for — each
// one decodes and re-encodes two images — so they get their own, tighter limit.
feedRoutes.post(
  '/',
  requirePermission(PERMISSIONS.FEED_POST),
  uploadRateLimit,
  uploadImage,
  controller.create,
);

// Deleting is authorised in the service, which knows who wrote the post.
feedRoutes.delete('/:id', controller.remove);

feedRoutes.put('/:id/like', controller.like);
feedRoutes.delete('/:id/like', controller.unlike);
