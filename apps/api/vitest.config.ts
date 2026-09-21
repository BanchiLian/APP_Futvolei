import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /**
     * Tests get their own environment instead of reading the developer's `.env`,
     * so a run is reproducible on any machine and in CI.
     */
    env: {
      NODE_ENV: 'test',
      PORT: '3333',
      BUSINESS_TIMEZONE: 'America/Sao_Paulo',
      // The logger silences itself when NODE_ENV=test; this only has to be a
      // value the env schema accepts.
      LOG_LEVEL: 'error',
      DATABASE_URL: 'postgresql://futcheck:futcheck@localhost:5432/futcheck_test?schema=public',
      JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters',
      JWT_REFRESH_SECRET: 'test-refresh-secret-with-at-least-32-characters',
      CORS_ORIGINS: 'http://localhost:5173',
    },
  },
});
