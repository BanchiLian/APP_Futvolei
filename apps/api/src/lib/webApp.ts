import { existsSync } from 'node:fs';
import path from 'node:path';

import express, { type Express, type RequestHandler } from 'express';

import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Serves the built Vue app from the API process.
 *
 * App and API then share one origin, which is what keeps the httpOnly refresh
 * cookie same-site in production. Split across two hosts the cookie becomes a
 * third-party cookie: Safari blocks those outright, so the session would die on
 * every iPhone — and the phone is where this product is actually used.
 *
 * Inactive unless WEB_DIST_DIR is set, so development and the tests are
 * untouched: there the Vite dev server owns the app and proxies the API.
 */

/** Paths owned by the API, which must never fall through to the app shell. */
function isApiPath(pathname: string): boolean {
  return pathname === '/health' || pathname.startsWith('/api/') || pathname.startsWith('/static/');
}

export function mountWebApp(app: Express): void {
  if (!env.WEB_DIST_DIR) return;

  const root = path.resolve(env.WEB_DIST_DIR);
  const shell = path.join(root, 'index.html');

  if (!existsSync(shell)) {
    logger.error({ root }, 'WEB_DIST_DIR is set but has no index.html; not serving the web app');
    return;
  }

  app.use(
    express.static(root, {
      index: false,
      dotfiles: 'deny',
      setHeaders(res, filePath) {
        const name = path.basename(filePath);

        // Vite puts a content hash in every asset name, so an asset can be kept
        // forever. The shell and the service worker are what decide when a new
        // version is picked up, so they must never be cached.
        const decidesTheVersion =
          name === 'index.html' || name === 'sw.js' || name === 'registerSW.js';

        res.setHeader(
          'Cache-Control',
          decidesTheVersion ? 'no-cache' : 'public, max-age=31536000, immutable',
        );
      },
    }),
  );

  /**
   * Vue Router owns the URL, so an address the user typed, bookmarked or opened
   * from the installed PWA has to return the shell for the router to resolve on
   * the client. Express 5 dropped the `'*'` route, and middleware is the right
   * shape anyway: it keeps API 404s as JSON instead of answering them with HTML.
   */
  const appShell: RequestHandler = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    if (isApiPath(req.path)) {
      next();
      return;
    }

    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(shell, (error) => {
      if (error) next(error);
    });
  };

  app.use(appShell);

  logger.info({ root }, 'serving the web app from the API');
}
