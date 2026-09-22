import { describe, expect, it } from 'vitest';

import { durationToSeconds, generateOpaqueToken, hashOpaqueToken } from './tokens.js';

describe('generateOpaqueToken', () => {
  it('produces url-safe tokens with 256 bits of entropy', () => {
    const token = generateOpaqueToken();

    // 32 random bytes in base64url: 43 characters, no padding, no + or /.
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('never repeats', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateOpaqueToken()));
    expect(tokens.size).toBe(500);
  });
});

describe('hashOpaqueToken', () => {
  it('is deterministic, so a token can be looked up by its hash', () => {
    const token = generateOpaqueToken();
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });

  it('produces a sha-256 hex digest', () => {
    expect(hashOpaqueToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never contains the token itself', () => {
    const token = generateOpaqueToken();
    expect(hashOpaqueToken(token)).not.toContain(token);
  });

  it('gives different hashes to different tokens', () => {
    expect(hashOpaqueToken('token-a')).not.toBe(hashOpaqueToken('token-b'));
  });
});

describe('durationToSeconds', () => {
  it('converts every supported unit', () => {
    expect(durationToSeconds('45s')).toBe(45);
    expect(durationToSeconds('15m')).toBe(900);
    expect(durationToSeconds('2h')).toBe(7_200);
    expect(durationToSeconds('1d')).toBe(86_400);
  });

  it('rejects anything malformed instead of guessing', () => {
    for (const bad of ['15', 'm15', '15min', '', '-5m', '1.5h', '15w']) {
      expect(() => durationToSeconds(bad)).toThrow();
    }
  });
});
