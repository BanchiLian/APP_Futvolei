import type { Request } from 'express';

import { unauthorized } from '../../lib/errors.js';
import type { AuthContext } from '../../types/express.js';

/**
 * The auth context set by `authenticate`. Throws instead of returning undefined so
 * a route mounted without the middleware fails loudly rather than acting as nobody.
 */
export function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
