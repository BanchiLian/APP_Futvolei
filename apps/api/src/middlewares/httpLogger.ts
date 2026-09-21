import { randomUUID } from 'node:crypto';

import { pinoHttp } from 'pino-http';

import { logger } from '../lib/logger.js';

/**
 * Attaches a request id to every request and logs one structured line per
 * response (section 11). An inbound `x-request-id` is honoured so the id survives
 * a reverse proxy; the id is echoed back so a user can quote it in a bug report.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const inbound = req.headers['x-request-id'];
    const id = typeof inbound === 'string' && inbound.length > 0 ? inbound : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: {
    // Liveness probes would otherwise flood the logs.
    ignore: (req) => req.url === '/health',
  },
});
