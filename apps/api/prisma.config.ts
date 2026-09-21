import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// The monorepo keeps a single .env at the repository root, so the Prisma CLI,
// Docker Compose and the API all read the same values.
const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'dotenv -e ../../.env -- tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
