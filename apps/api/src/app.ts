import cookieParser from 'cookie-parser';
import cors, { type CorsOptionsDelegate } from 'cors';
import express, { type Express, type Request } from 'express';
import helmet from 'helmet';

import { configureBusinessTimezone } from '@futcheck/shared';

import { env, isProduction } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { httpLogger } from './middlewares/httpLogger.js';
import { globalRateLimit } from './middlewares/rateLimit.js';
import { storageRoot } from './lib/storage.js';
import { mountWebApp } from './lib/webApp.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { apiRoutes } from './routes.js';

// Every "today", weekday and deadline in the app resolves against this. Set once,
// before any request can be served.
configureBusinessTimezone(env.BUSINESS_TIMEZONE);

/**
 * Same origin means the browser is asking the very server that served the page.
 *
 * This has to be allowed unconditionally. Vite marks its module scripts
 * `crossorigin`, so the browser sends an Origin header even for the app's own
 * JavaScript: without this the API rejects it and the page never boots. Behind a
 * proxy `req.protocol` follows X-Forwarded-Proto, which is why TRUST_PROXY_HOPS
 * has to be right in production.
 */
function isSameOrigin(req: Request, origin: string): boolean {
  const host = req.headers.host;
  return host ? origin === `${req.protocol}://${host}` : false;
}

/**
 * A rejected origin answers without the CORS headers rather than throwing: the
 * browser is what must refuse the response, and an exception here would turn a
 * cross-origin probe into a 500.
 */
const corsDelegate: CorsOptionsDelegate<Request> = (req, callback) => {
  const origin = req.headers.origin;
  const allowlist = env.CORS_ORIGINS;

  const allowed =
    // Server-to-server calls and same-origin navigations send no Origin at all.
    !origin ||
    isSameOrigin(req, origin) ||
    allowlist.includes(origin) ||
    // Outside production an empty allowlist means "developer machine, be permissive".
    (!isProduction && allowlist.length === 0);

  // Cookies carry the refresh token, so the browser needs credentials allowed.
  callback(null, { credentials: true, origin: allowed });
};

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
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // Upload previews are object URLs: the app shows the photo before the
          // file has ever reached the server.
          'img-src': ["'self'", 'data:', 'blob:'],
          // Vue writes inline style attributes for its :style bindings. Nothing
          // loads a stylesheet or a font from another host, so both drop the
          // blanket https: that helmet allows by default.
          'style-src': ["'self'", "'unsafe-inline'"],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          // Only meaningful behind HTTPS, and it would break a plain-http smoke
          // test of the production build on a developer machine.
          ...(env.COOKIE_SECURE ? {} : { 'upgrade-insecure-requests': null }),
        },
      },
    }),
  );
  app.use(cors(corsDelegate));
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

  // After the API routes, so an unknown /api path still answers with a JSON
  // error instead of the app shell.
  mountWebApp(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
