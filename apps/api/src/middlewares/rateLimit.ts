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
 * Strict limit for sign-up and password recovery (section 11) — rare actions
 * where a burst from one address means abuse, not normal use.
 *
 * Deliberately *not* applied to `/auth/refresh` or `/auth/logout`: the app
 * refreshes on every page load, and a whole arena shares one public Wi-Fi
 * address, so a per-IP budget this small would lock legitimate users out of
 * their own sessions. Those two routes rely on the global limiter instead, and
 * refresh is already protected by rotation with replay detection.
 */
export const authRateLimit = rateLimit({
  ...sharedOptions,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
});

/**
 * Login gets two limiters, because one budget cannot serve both purposes.
 *
 * Per IP, the allowance is generous: everyone at the arena shares a single
 * address, and a handful of people logging in must not exhaust it.
 */
export const loginIpRateLimit = rateLimit({
  ...sharedOptions,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.LOGIN_RATE_LIMIT_MAX_PER_IP,
});

/**
 * Per account, the allowance is tight. This is the one that actually stops
 * password guessing: an attacker rotating through IP addresses still gets only a
 * few attempts against any single account.
 *
 * Runs after `validateBody`, so the e-mail is already normalised to lowercase and
 * two spellings cannot be used as two separate budgets.
 */
export const loginAccountRateLimit = rateLimit({
  ...sharedOptions,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.LOGIN_RATE_LIMIT_MAX_PER_ACCOUNT,
  keyGenerator: (req) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === 'string' && email.length > 0 ? `account:${email}` : `ip:${req.ip}`;
  },
  // The key is an account, not an address, so the library's IP-shape checks do
  // not apply here.
  validate: false,
});

/**
 * Image uploads: the most expensive thing an authenticated user can ask for,
 * since each one decodes and re-encodes a photo. Keyed by account rather than by
 * address, so one person cannot exhaust the budget of everyone on the arena Wi-Fi.
 */
export const uploadRateLimit = rateLimit({
  ...sharedOptions,
  windowMs: 60_000,
  limit: 12,
  keyGenerator: (req) => `user:${req.auth?.userId ?? req.ip}`,
  validate: false,
});
