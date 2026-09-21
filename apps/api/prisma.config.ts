import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// The monorepo keeps a single .env at the repository root, so the Prisma CLI,
// Docker Compose and the API all read the same values.
const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Read directly rather than through Prisma's `env()` helper, which resolves
    // eagerly and makes `prisma generate` fail when no .env exists yet. Generating
    // the client must work on a fresh clone and in CI before secrets are injected;
    // the commands that actually need a connection fail on their own if it is missing.
    url: process.env['DATABASE_URL'],
  },
});
