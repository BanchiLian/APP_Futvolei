import { Router } from 'express';

import { authRateLimit } from '../../middlewares/rateLimit.js';
import { validateBody } from '../../middlewares/validate.js';
import * as controller from './auth.controller.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schemas.js';

export const authRoutes: Router = Router();

/**
 * Every route here is unauthenticated and therefore reachable by anyone, so all
 * of them sit behind the strict rate limit (section 11). These are the endpoints
 * credential stuffing and account enumeration go after.
 */
authRoutes.use(authRateLimit);

authRoutes.post('/register', validateBody(registerSchema), controller.register);
authRoutes.post('/login', validateBody(loginSchema), controller.login);

// The refresh cookie is the only credential; there is no body to validate.
authRoutes.post('/refresh', controller.refresh);
authRoutes.post('/logout', controller.logout);

authRoutes.post('/forgot-password', validateBody(forgotPasswordSchema), controller.forgotPassword);
authRoutes.post('/reset-password', validateBody(resetPasswordSchema), controller.resetPassword);
