import { PrismaPg } from '@prisma/adapter-pg';

import { env, isDevelopment, isProduction } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { logger } from './logger.js';

/**
 * Prisma 7 runs on a driver adapter — the query compiler talks to `pg` directly.
 *
 * `tsx watch` reloads this module on every change, so the client is cached on
 * `globalThis` in development to avoid piling up connection pools.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  const client = new PrismaClient({
    adapter,
    log: isProduction
      ? [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
  });

  client.$on('error', (event) => logger.error({ prisma: event }, 'prisma error'));
  client.$on('warn', (event) => logger.warn({ prisma: event }, 'prisma warning'));

  if (isDevelopment) {
    client.$on('query', (event) => {
      logger.debug(
        { query: event.query, params: event.params, duration: event.duration },
        'prisma query',
      );
    });
  }

  return client;
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

/** Readiness probe: confirms the database answers. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ err: error }, 'database ping failed');
    return false;
  }
}
