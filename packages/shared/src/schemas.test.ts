import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PASSWORD_MIN_LENGTH,
  SUPER_ADMIN_PASSWORD_MIN_LENGTH,
  buildPaginationMeta,
  loginSchema,
  paginationSchema,
  registerSchema,
  superAdminPasswordSchema,
  usernameSchema,
} from './schemas.js';

const validRegistration = {
  name: 'Ana Souza',
  email: 'ana@example.com',
  phone: '(11) 98888-7777',
  password: 'senhaSegura1',
  acceptedTerms: true as const,
};

describe('registerSchema', () => {
  it('accepts a valid sign-up', () => {
    const result = registerSchema.safeParse(validRegistration);
    expect(result.success).toBe(true);
  });

  it('has no role field at all', () => {
    expect(Object.keys(registerSchema.shape)).not.toContain('role');
  });

  it('strips a role smuggled into the payload', () => {
    // Section 4.2 / 13: public sign-up always yields DAYUSE, whatever is sent.
    const result = registerSchema.parse({ ...validRegistration, role: 'ADMIN' });
    expect(result).not.toHaveProperty('role');
  });

  it('strips isActive and any other unknown field', () => {
    const result = registerSchema.parse({
      ...validRegistration,
      isActive: false,
      id: 'forged-id',
    });

    expect(Object.keys(result).sort()).toEqual([
      'acceptedTerms',
      'email',
      'name',
      'password',
      'phone',
    ]);
  });

  it('normalises the e-mail to lowercase and trims it', () => {
    const result = registerSchema.parse({ ...validRegistration, email: '  ANA@Example.COM ' });
    expect(result.email).toBe('ana@example.com');
  });

  it('keeps only the digits of the phone number', () => {
    const result = registerSchema.parse(validRegistration);
    expect(result.phone).toBe('11988887777');
  });

  it('requires the terms to be accepted', () => {
    const result = registerSchema.safeParse({ ...validRegistration, acceptedTerms: false });
    expect(result.success).toBe(false);
  });

  it('rejects a password below the minimum length', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed e-mail', () => {
    const result = registerSchema.safeParse({ ...validRegistration, email: 'nao-e-email' });
    expect(result.success).toBe(false);
  });

  it('rejects a phone number that is too short', () => {
    const result = registerSchema.safeParse({ ...validRegistration, phone: '1198' });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('normalises an e-mail so login is case-insensitive', () => {
    const result = loginSchema.parse({ login: '  ANA@EXAMPLE.COM ', password: 'x' });
    expect(result.login).toBe('ana@example.com');
  });

  it('accepts a username in the same field', () => {
    expect(loginSchema.parse({ login: 'Admin', password: 'x' }).login).toBe('admin');
  });

  it('refuses an empty login', () => {
    expect(loginSchema.safeParse({ login: '   ', password: 'x' }).success).toBe(false);
  });
});

describe('usernameSchema', () => {
  it('lowercases and accepts a simple handle', () => {
    expect(usernameSchema.parse(' Admin ')).toBe('admin');
  });

  it('refuses spaces, @ and handles that are too short', () => {
    for (const bad of ['ad', 'meu admin', 'a@b', 'x'.repeat(31)]) {
      expect(usernameSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('superAdminPasswordSchema', () => {
  it('demands at least 12 characters', () => {
    expect(
      superAdminPasswordSchema.safeParse('a'.repeat(SUPER_ADMIN_PASSWORD_MIN_LENGTH - 1)).success,
    ).toBe(false);
    expect(
      superAdminPasswordSchema.safeParse('a'.repeat(SUPER_ADMIN_PASSWORD_MIN_LENGTH)).success,
    ).toBe(true);
  });

  it('is stricter than the regular password rule', () => {
    expect(SUPER_ADMIN_PASSWORD_MIN_LENGTH).toBeGreaterThan(PASSWORD_MIN_LENGTH);
  });
});

describe('paginationSchema', () => {
  it('applies defaults when nothing is sent', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('coerces query-string values', () => {
    expect(paginationSchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it('caps pageSize so a client cannot ask for everything', () => {
    expect(paginationSchema.safeParse({ pageSize: MAX_PAGE_SIZE + 1 }).success).toBe(false);
  });

  it('rejects page zero', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
  });
});

describe('buildPaginationMeta', () => {
  it('computes the page count', () => {
    expect(buildPaginationMeta({ page: 1, pageSize: 20 }, 41)).toEqual({
      page: 1,
      pageSize: 20,
      total: 41,
      totalPages: 3,
    });
  });

  it('always reports at least one page, even when empty', () => {
    expect(buildPaginationMeta({ page: 1, pageSize: 20 }, 0).totalPages).toBe(1);
  });
});
