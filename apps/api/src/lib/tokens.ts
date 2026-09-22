import { createHash, randomBytes } from 'node:crypto';

/**
 * Opaque tokens: refresh tokens and password reset tokens.
 *
 * Only the hash is ever stored, so a leaked database cannot be used to mint
 * sessions or reset passwords.
 *
 * The hash is SHA-256, not Argon2, and that is deliberate. Argon2 exists to slow
 * down brute force against *low-entropy* secrets that humans choose. These tokens
 * are 256 bits of CSPRNG output, so brute force is not on the table, and we need
 * to look a token up by its hash — which a salted, deliberately slow hash cannot
 * do. Passwords use Argon2id (see `password.ts`); these do not.
 */

/** 256 bits of entropy. */
const TOKEN_BYTES = 32;

export function generateOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Converts `15m`, `900s`, `2h`, `1d` into seconds. */
export function durationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);

  if (!match?.[1] || !match[2]) {
    throw new Error(`Invalid duration: ${duration}`);
  }

  const amount = Number.parseInt(match[1], 10);
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3_600, d: 86_400 };
  const multiplier = multipliers[match[2]];

  if (multiplier === undefined) {
    throw new Error(`Invalid duration unit: ${match[2]}`);
  }

  return amount * multiplier;
}
