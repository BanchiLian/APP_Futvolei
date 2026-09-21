import pino from 'pino';

import { env, isProduction, isTest } from '../config/env.js';

/**
 * Structured logging (section 11). JSON in production so log shippers can parse
 * it; human-readable in development.
 *
 * `redact` is the last line of defence against leaking credentials into logs —
 * password hashes and tokens must never reach a log aggregator.
 */
export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'futcheck-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.newPassword',
      '*.currentPassword',
      '*.passwordHash',
      '*.token',
      '*.tokenHash',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[redacted]',
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname,service',
          },
        },
      }),
});

export type Logger = typeof logger;
