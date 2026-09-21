import { hash, verify } from '@node-rs/argon2';

/**
 * `Algorithm.Argon2id` from `@node-rs/argon2`.
 *
 * The package declares `Algorithm` as an ambient const enum, which cannot be
 * imported under `verbatimModuleSyntax`/`isolatedModules` — it has no runtime
 * value. The numeric value is inlined instead, and `password.test.ts` asserts that
 * the produced hash really is an `$argon2id$` one, so a wrong constant fails loudly.
 */
const ARGON2ID = 2;

/** OWASP-recommended parameters for Argon2id: 19 MiB, 2 iterations, 1 lane. */
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, ARGON2_OPTIONS);
}

/**
 * Never throws on a malformed hash — a corrupted row must read as "wrong
 * password", not as a 500 that tells an attacker the account exists.
 */
export async function verifyPassword(
  passwordHash: string,
  plainPassword: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, plainPassword, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
