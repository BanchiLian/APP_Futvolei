import { Router } from 'express';

import { rsvpSchema } from '@futcheck/shared';

import { authenticate } from '../../middlewares/authenticate.js';
import { validateBody } from '../../middlewares/validate.js';
import * as controller from './sessions.controller.js';

export const sessionsRoutes: Router = Router();

// No route-level permission on purpose: which sessions a caller may see or answer
// depends on each session's type (aula vs dayuse), which only the service knows.
// It filters by `session:view:<type>` and refuses by `session:rsvp:<type>`.
sessionsRoutes.use(authenticate);

sessionsRoutes.get('/', controller.list);
sessionsRoutes.get('/:id', controller.detail);
sessionsRoutes.put('/:id/rsvp', validateBody(rsvpSchema), controller.rsvp);
