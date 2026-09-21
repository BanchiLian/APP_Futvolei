import rateLimit, { type Options } from 'express-rate-limit';

import { ERROR_CODES, errorMessageFor } from '@futcheck/shared';

import { env, isTest } from '../config/env.js';
import { logger } from '../lib/logger.js';

const sharedOptions: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Rate limiting would make tests flaky and slow; the limiters are unit-tested
  // through their configuration instead.
  skip: () => isTest,
  handler: (req, res) => {
    logger.warn({ requestId: req.id, ip: req.ip, path: req.path }, 'rate limit exceeded');
    res.status(429).json({
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message: errorMessageFor(ERROR_CODES.RATE_LIMITED),
      },
    });
  },
};

/** Baseline protection for the whole API. */
export const globalRateLimit = rateLimit({
  ...sharedOptions,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
});

/**
 * Much stricter limit for login, sign-up and password recovery (section 11),
 * where the risk is credential stuffing rather than accidental hammering.
 */
export const authRateLimit = rateLimit({
  ...sharedOptions,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
});
