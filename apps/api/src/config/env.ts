/**
 * Environment validation.
 *
 * Every variable the API needs is declared and validated here with Zod. A missing
 * or malformed value crashes the process at boot with a readable report, instead
 * of surfacing as a mystery at 2am. Nothing else in the codebase reads
 * `process.env` directly.
 */

import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * Load the single .env at the repository root.
 *
 * Doing it here, rather than through a `dotenv-cli` wrapper in every npm script,
 * means the API behaves the same however it is started — `tsx`, `node dist`, a
 * seed script or a test runner — and removes a process layer that broke
 * `tsx watch` when nested under `concurrently` on Windows.
 *
 * The path is resolved relative to this file. `src/config` and `dist/config` sit
 * at the same depth under `apps/api`, so one expression covers both. A missing
 * file is a no-op, which is exactly right in production, where the environment is
 * injected. dotenv never overrides an existing variable, so values set by CI or
 * by Vitest always win.
 */
loadDotenv({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)) });

/** `"true"`/`"1"` → true, `"false"`/`"0"` → false. Avoids `z.coerce.boolean()`, which treats `"false"` as true. */
const booleanFromString = (defaultValue: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true' || value === '1');

/** Comma-separated list → trimmed, non-empty entries. */
const csvList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

const port = z.coerce.number().int().min(1).max(65_535);

const envSchema = z
  .object({
    // --- runtime ---
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: port.default(3333),
    API_PUBLIC_URL: z.string().url().default('http://localhost:3333'),
    WEB_PUBLIC_URL: z.string().url().default('http://localhost:5173'),
    BUSINESS_TIMEZONE: z.string().min(1).default('America/Sao_Paulo'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // --- database ---
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),

    // --- auth ---
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must have at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must have at least 32 characters'),
    // A duration such as 15m, 900s, 2h or 1d. Rejected early so a typo cannot
    // silently produce a token that never expires.
    JWT_ACCESS_TTL: z
      .string()
      .regex(/^\d+[smhd]$/, 'JWT_ACCESS_TTL must look like 15m, 900s, 2h or 1d')
      .default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    REFRESH_TOKEN_COOKIE_NAME: z.string().min(1).default('futcheck_rt'),
    COOKIE_SECURE: booleanFromString(false),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_DOMAIN: z.string().optional(),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1_440).default(60),

    // --- http security ---
    CORS_ORIGINS: csvList,
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).default(900_000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
    // Login is limited twice: generously per address, because a whole arena
    // shares one Wi-Fi, and tightly per account, which is what actually stops
    // password guessing from a rotating set of addresses.
    LOGIN_RATE_LIMIT_MAX_PER_IP: z.coerce.number().int().min(1).default(30),
    LOGIN_RATE_LIMIT_MAX_PER_ACCOUNT: z.coerce.number().int().min(1).default(8),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

    // --- storage ---
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('storage/uploads'),
    STORAGE_PUBLIC_URL: z.string().url().default('http://localhost:3333/static'),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: booleanFromString(true),
  })
  .superRefine((value, ctx) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      });
    }

    if (value.STORAGE_DRIVER === 's3') {
      for (const key of [
        'S3_REGION',
        'S3_BUCKET',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          });
        }
      }
    }

    if (value.NODE_ENV === 'production') {
      if (value.CORS_ORIGINS.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGINS'],
          message: 'CORS_ORIGINS must list the allowed origins in production',
        });
      }

      if (!value.COOKIE_SECURE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['COOKIE_SECURE'],
          message: 'COOKIE_SECURE must be true in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Exported for tests; the app uses the `env` singleton below. */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const report = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${report}`);
  }

  return result.data;
}

export const env: Env = parseEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDevelopment = env.NODE_ENV === 'development';
