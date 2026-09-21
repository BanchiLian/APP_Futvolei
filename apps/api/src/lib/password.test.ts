import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('produces an argon2id hash with the configured parameters', async () => {
    const hash = await hashPassword('senha-de-teste-123');

    // Guards the inlined ARGON2ID constant and the OWASP cost parameters.
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain('m=19456');
    expect(hash).toContain('t=2');
    expect(hash).toContain('p=1');
  });

  it('never stores the password in the hash', async () => {
    const hash = await hashPassword('senha-de-teste-123');
    expect(hash).not.toContain('senha-de-teste-123');
  });

  it('salts each hash, so two identical passwords look different', async () => {
    const [first, second] = await Promise.all([
      hashPassword('mesma-senha'),
      hashPassword('mesma-senha'),
    ]);

    expect(first).not.toBe(second);
    expect(await verifyPassword(first, 'mesma-senha')).toBe(true);
    expect(await verifyPassword(second, 'mesma-senha')).toBe(true);
  });

  it('accepts the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('senha-correta');

    expect(await verifyPassword(hash, 'senha-correta')).toBe(true);
    expect(await verifyPassword(hash, 'senha-errada')).toBe(false);
    expect(await verifyPassword(hash, '')).toBe(false);
  });

  it('returns false for a corrupted hash instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'qualquer')).toBe(false);
    expect(await verifyPassword('', 'qualquer')).toBe(false);
  });
});
