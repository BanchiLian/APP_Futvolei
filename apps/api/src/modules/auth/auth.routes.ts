import { Router } from 'express';

import {
  authRateLimit,
  loginAccountRateLimit,
  loginIpRateLimit,
} from '../../middlewares/rateLimit.js';
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
 * Every route here is unauthenticated, so each one carries the rate limit that
 * fits it (section 11) rather than a single budget for the whole router.
 *
 * Refresh and logout are left to the global limiter on purpose: the app refreshes
 * on every page load, and a shared arena Wi-Fi would blow through a strict
 * per-address budget in minutes, locking real users out of their own sessions.
 */

authRoutes.post('/register', authRateLimit, validateBody(registerSchema), controller.register);

// Body first, so the per-account limiter keys off the normalised e-mail.
authRoutes.post(
  '/login',
  loginIpRateLimit,
  validateBody(loginSchema),
  loginAccountRateLimit,
  controller.login,
);

// The refresh cookie is the only credential; there is no body to validate.
authRoutes.post('/refresh', controller.refresh);
authRoutes.post('/logout', controller.logout);

authRoutes.post(
  '/forgot-password',
  authRateLimit,
  validateBody(forgotPasswordSchema),
  controller.forgotPassword,
);
authRoutes.post(
  '/reset-password',
  authRateLimit,
  validateBody(resetPasswordSchema),
  controller.resetPassword,
);
