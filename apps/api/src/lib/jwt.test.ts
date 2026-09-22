import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from '@futcheck/shared';

import { env } from '../config/env.js';
import { AppError } from './errors.js';
import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken, verifyAccessToken } from './jwt.js';

const USER_ID = '01931f3a-0000-7000-8000-000000000001';

async function expectRejection(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ code, status: 401 });
}

describe('signAccessToken', () => {
  it('round-trips the user id', async () => {
    const { token } = await signAccessToken(USER_ID);
    expect(await verifyAccessToken(token)).toBe(USER_ID);
  });

  it('reports the configured lifetime', async () => {
    const { expiresIn } = await signAccessToken(USER_ID);

    expect(expiresIn).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect(expiresIn).toBe(900); // 15m default
  });

  it('carries no role or permission claims', async () => {
    // Authorisation is re-read from the database on every request, so a demotion
    // takes effect immediately instead of lingering until the token expires.
    const { token } = await signAccessToken(USER_ID);
    const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());

    expect(claims).not.toHaveProperty('role');
    expect(claims).not.toHaveProperty('permissions');
    expect(Object.keys(claims).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sub']);
  });
});

describe('verifyAccessToken', () => {
  it('rejects a tampered signature', async () => {
    const { token } = await signAccessToken(USER_ID);
    const [header, payload] = token.split('.');

    await expectRejection(
      verifyAccessToken(`${header}.${payload}.aaaaaaaaaaaaaaaaaaaaaaaaaaaa`),
      ERROR_CODES.TOKEN_INVALID,
    );
  });

  it('rejects garbage', async () => {
    for (const bad of ['', 'not-a-jwt', 'a.b.c']) {
      await expectRejection(verifyAccessToken(bad), ERROR_CODES.TOKEN_INVALID);
    }
  });

  it('reports an expired token distinctly, so the client knows to refresh', async () => {
    const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuer('futcheck')
      .setAudience('futcheck-api')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3_600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret);

    await expectRejection(verifyAccessToken(expired), ERROR_CODES.TOKEN_EXPIRED);
  });

  it('refuses a token signed with the refresh secret', async () => {
    // The two secrets must not be interchangeable, or a refresh token could be
    // replayed as an access token.
    const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuer('futcheck')
      .setAudience('futcheck-api')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(refreshSecret);

    await expectRejection(verifyAccessToken(token), ERROR_CODES.TOKEN_INVALID);
  });

  it('refuses a token from another issuer or audience', async () => {
    const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

    const wrongIssuer = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuer('someone-else')
      .setAudience('futcheck-api')
      .setExpirationTime('15m')
      .sign(secret);

    const wrongAudience = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuer('futcheck')
      .setAudience('another-app')
      .setExpirationTime('15m')
      .sign(secret);

    await expectRejection(verifyAccessToken(wrongIssuer), ERROR_CODES.TOKEN_INVALID);
    await expectRejection(verifyAccessToken(wrongAudience), ERROR_CODES.TOKEN_INVALID);
  });

  it('refuses an unsigned (alg: none) token', async () => {
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64url',
    )}.${Buffer.from(JSON.stringify({ sub: USER_ID })).toString('base64url')}.`;

    await expectRejection(verifyAccessToken(unsigned), ERROR_CODES.TOKEN_INVALID);
  });
});
