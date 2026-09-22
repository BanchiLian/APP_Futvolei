import { describe, expect, it } from 'vitest';

import { parseEnv } from './env.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
} satisfies NodeJS.ProcessEnv;

describe('parseEnv', () => {
  it('applies sensible defaults', () => {
    const env = parseEnv({ ...validEnv });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3333);
    expect(env.BUSINESS_TIMEZONE).toBe('America/Sao_Paulo');
    expect(env.JWT_ACCESS_TTL).toBe('15m');
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(env.STORAGE_DRIVER).toBe('local');
  });

  it('gives login a generous per-address budget and a tight per-account one', () => {
    // A whole arena shares one Wi-Fi address, so the per-IP allowance has to be
    // loose; the per-account one is what stops password guessing.
    const env = parseEnv({ ...validEnv });

    expect(env.LOGIN_RATE_LIMIT_MAX_PER_IP).toBe(30);
    expect(env.LOGIN_RATE_LIMIT_MAX_PER_ACCOUNT).toBe(8);
    expect(env.LOGIN_RATE_LIMIT_MAX_PER_IP).toBeGreaterThan(env.LOGIN_RATE_LIMIT_MAX_PER_ACCOUNT);
  });

  it('coerces numeric variables from strings', () => {
    const env = parseEnv({ ...validEnv, PORT: '8080', RATE_LIMIT_MAX: '50' });

    expect(env.PORT).toBe(8080);
    expect(env.RATE_LIMIT_MAX).toBe(50);
  });

  it('parses "false" as false, not as a truthy string', () => {
    expect(parseEnv({ ...validEnv, COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(false);
    expect(parseEnv({ ...validEnv, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
  });

  it('splits CORS_ORIGINS into a trimmed list', () => {
    const env = parseEnv({
      ...validEnv,
      CORS_ORIGINS: 'http://localhost:5173, https://app.futcheck.com.br , ',
    });

    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://app.futcheck.com.br']);
  });

  it('fails when a required variable is missing', () => {
    expect(() => parseEnv({ JWT_ACCESS_SECRET: 'a'.repeat(32) })).toThrow(/DATABASE_URL/);
  });

  it('rejects short JWT secrets', () => {
    expect(() => parseEnv({ ...validEnv, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('rejects reusing the same secret for access and refresh tokens', () => {
    const secret = 'c'.repeat(32);

    expect(() =>
      parseEnv({ ...validEnv, JWT_ACCESS_SECRET: secret, JWT_REFRESH_SECRET: secret }),
    ).toThrow(/must differ/);
  });

  it('rejects an invalid port', () => {
    expect(() => parseEnv({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
  });

  it('requires the S3 settings only when the S3 driver is selected', () => {
    expect(() => parseEnv({ ...validEnv, STORAGE_DRIVER: 's3' })).toThrow(/S3_BUCKET/);

    const env = parseEnv({
      ...validEnv,
      STORAGE_DRIVER: 's3',
      S3_REGION: 'auto',
      S3_BUCKET: 'futcheck',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
    });

    expect(env.STORAGE_DRIVER).toBe('s3');
  });

  it('demands a CORS allowlist and secure cookies in production', () => {
    expect(() => parseEnv({ ...validEnv, NODE_ENV: 'production', COOKIE_SECURE: 'true' })).toThrow(
      /CORS_ORIGINS/,
    );

    expect(() =>
      parseEnv({
        ...validEnv,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.futcheck.com.br',
        COOKIE_SECURE: 'false',
      }),
    ).toThrow(/COOKIE_SECURE/);
  });

  it('accepts a complete production configuration', () => {
    const env = parseEnv({
      ...validEnv,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://app.futcheck.com.br',
      COOKIE_SECURE: 'true',
    });

    expect(env.NODE_ENV).toBe('production');
  });

  it('reports every problem at once instead of one at a time', () => {
    try {
      parseEnv({ DATABASE_URL: 'not-a-url' });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('JWT_ACCESS_SECRET');
      expect(message).toContain('JWT_REFRESH_SECRET');
    }
  });
});
