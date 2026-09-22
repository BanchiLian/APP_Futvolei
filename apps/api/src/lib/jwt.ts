import { SignJWT, jwtVerify } from 'jose';

import { ERROR_CODES } from '@futcheck/shared';

import { env } from '../config/env.js';
import { unauthorized } from './errors.js';
import { durationToSeconds } from './tokens.js';

/**
 * Access tokens.
 *
 * Short-lived (15 minutes by default) and deliberately thin: the only claim that
 * matters is the subject. Roles and permissions are *not* embedded, because a
 * token minted before a demotion would keep the old powers until it expired.
 * `authenticate` re-reads the user on every request instead.
 */

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

const ALGORITHM = 'HS256';
const ISSUER = 'futcheck';
const AUDIENCE = 'futcheck-api';

export const ACCESS_TOKEN_TTL_SECONDS = durationToSeconds(env.JWT_ACCESS_TTL);

export interface AccessToken {
  token: string;
  /** Seconds until expiry, for the client to schedule a refresh. */
  expiresIn: number;
}

export async function signAccessToken(userId: string): Promise<AccessToken> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(accessSecret);

  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

/**
 * Returns the user id carried by a valid token.
 *
 * Every failure — expired, tampered, wrong issuer, signed with the refresh
 * secret — surfaces as a 401. The distinction between "expired" and "invalid" is
 * kept because the web client retries a refresh on the former.
 */
export async function verifyAccessToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, accessSecret, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw unauthorized(ERROR_CODES.TOKEN_INVALID);
    }

    return payload.sub;
  } catch (error) {
    if (error instanceof Error && error.name === 'JWTExpired') {
      throw unauthorized(ERROR_CODES.TOKEN_EXPIRED);
    }

    throw unauthorized(ERROR_CODES.TOKEN_INVALID);
  }
}
