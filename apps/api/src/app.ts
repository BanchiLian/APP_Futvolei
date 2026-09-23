import cookieParser from 'cookie-parser';
import cors, { type CorsOptions } from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { configureBusinessTimezone } from '@futcheck/shared';

import { env, isProduction } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { httpLogger } from './middlewares/httpLogger.js';
import { globalRateLimit } from './middlewares/rateLimit.js';
import { storageRoot } from './lib/storage.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { apiRoutes } from './routes.js';

// Every "today", weekday and deadline in the app resolves against this. Set once,
// before any request can be served.
configureBusinessTimezone(env.BUSINESS_TIMEZONE);

function buildCorsOptions(): CorsOptions {
  const allowlist = env.CORS_ORIGINS;

  return {
    // Cookies carry the refresh token, so the browser needs credentials allowed.
    credentials: true,
    origin(origin, callback) {
      // Same-origin requests and server-to-server calls send no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowlist.includes(origin)) {
        callback(null, true);
        return;
      }

      // Outside production an empty allowlist means "developer machine, be permissive".
      if (!isProduction && allowlist.length === 0) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  };
}

/**
 * Builds the Express app without binding a port, so Supertest can drive it
 * directly in tests.
 */
export function createApp(): Express {
  const app = express();

  // Needed for correct client IPs (rate limiting, audit log) behind a proxy.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');

  app.use(httpLogger);
  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Reads the httpOnly refresh cookie. Unsigned on purpose: the cookie carries an
  // opaque 256-bit token that is verified against its stored hash, so a cookie
  // signature would add a second secret without adding a guarantee.
  app.use(cookieParser());

  app.use(globalRateLimit);

  /**
   * Uploaded images, served from the same origin as the app.
   *
   * Everything here was re-encoded by us, so the extension and the bytes always
   * agree. `nosniff` (from helmet) plus an explicit type means a browser will
   * never be talked into executing one of these files, and the long cache is
   * safe because the names are random and a replaced image gets a new one.
   */
  app.use(
    '/static',
    express.static(storageRoot(), {
      maxAge: '365d',
      immutable: true,
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'same-origin'),
    }),
  );

  app.use(healthRoutes);
  app.use('/api/v1', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
