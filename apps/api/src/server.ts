import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { disconnectPrisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
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
