import { createApp } from './app.js';
import { env, isProduction } from './config/env.js';
import { logger } from './lib/logger.js';
import { disconnectPrisma } from './lib/prisma.js';
import { assertSuperAdminPasswordIsNotWeak } from './lib/startupChecks.js';
import { startSessionGenerationJob } from './jobs/generateSessions.job.js';

if (isProduction) {
  try {
    await assertSuperAdminPasswordIsNotWeak();
  } catch (error) {
    logger.fatal({ err: error }, 'startup check failed');
    process.exit(1);
  }
}

const app = createApp();

/**
 * Bind on IPv4 explicitly.
 *
 * Left to itself, Node listens on `::` only, and on Windows that leaves
 * `127.0.0.1:3333` refusing connections — which broke the dev proxy and would
 * break any IPv4 client on the local network, such as a phone on the same Wi-Fi.
 */
const server = app.listen(env.PORT, '0.0.0.0', () => {
  startSessionGenerationJob();
  logger.info(
    { port: env.PORT, environment: env.NODE_ENV, timezone: env.BUSINESS_TIMEZONE },
    `FutCheck API listening on ${env.API_PUBLIC_URL}`,
  );
});

/** Finish in-flight requests, then release the database pool. */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');

  const timeout = setTimeout(() => {
    logger.error('graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);
  timeout.unref();

  server.close(async (error) => {
    if (error) {
      logger.error({ err: error }, 'error while closing the http server');
    }

    await disconnectPrisma();
    clearTimeout(timeout);
    process.exit(error ? 1 : 0);
  });
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  process.exit(1);
});
