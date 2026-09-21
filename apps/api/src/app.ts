import cors, { type CorsOptions } from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { configureBusinessTimezone } from '@futcheck/shared';

import { env, isProduction } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { httpLogger } from './middlewares/httpLogger.js';
import { globalRateLimit } from './middlewares/rateLimit.js';
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

  app.use(globalRateLimit);

  app.use(healthRoutes);
  app.use('/api/v1', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
