import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from '@futcheck/shared';

import { createApp } from '../../app.js';

/**
 * Endpoint tests that stop at the validation and cookie layers, so they need no
 * database. The paths that do reach Postgres — a successful sign-up, login,
 * rotation and reuse detection — are covered by the integration suite.
 */
const app = createApp();

const validRegistration = {
  name: 'Ana Souza',
  email: 'ana@example.com',
  phone: '11988887777',
  password: 'senhaSegura1',
  acceptedTerms: true,
};

describe('POST /auth/register — validation', () => {
  it('rejects an empty body with field-level details', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({});

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(response.body.error.details).toBeInstanceOf(Array);

    const fields = (response.body.error.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toContain('name');
    expect(fields).toContain('email');
    expect(fields).toContain('password');
  });

  it('refuses a sign-up that does not accept the terms', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, acceptedTerms: false });

    expect(response.status).toBe(422);
  });

  it('refuses a malformed e-mail', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, email: 'nao-e-email' });

    expect(response.status).toBe(422);
  });

  it('refuses a short password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, password: 'curta' });

    expect(response.status).toBe(422);
  });

  it('never echoes the submitted password back in the error', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, password: 'curta', email: 'bad' });

    expect(JSON.stringify(response.body)).not.toContain('curta');
  });
});

describe('POST /auth/login — validation', () => {
  it('refuses a malformed e-mail', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nope', password: 'whatever' });

    expect(response.status).toBe(422);
  });

  it('refuses a missing password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com' });

    expect(response.status).toBe(422);
  });

  it('never echoes the submitted password back in the error', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nope', password: 'minha-senha-secreta' });

    expect(JSON.stringify(response.body)).not.toContain('minha-senha-secreta');
  });
});

describe('POST /auth/refresh', () => {
  it('answers 401 when no refresh cookie is present', async () => {
    const response = await request(app).post('/api/v1/auth/refresh');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.TOKEN_INVALID);
  });

  it('clears the useless cookie on failure, so the client stops retrying', async () => {
    const response = await request(app).post('/api/v1/auth/refresh');
    const cookies = (response.headers['set-cookie'] ?? []) as string[];

    expect(cookies.join(';')).toContain('futcheck_rt=;');
  });
});

describe('POST /auth/logout', () => {
  it('succeeds even with no session, so logging out is idempotent', async () => {
    const response = await request(app).post('/api/v1/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it('clears the refresh cookie', async () => {
    const response = await request(app).post('/api/v1/auth/logout');
    const cookies = (response.headers['set-cookie'] ?? []) as string[];

    expect(cookies.join(';')).toContain('futcheck_rt=;');
  });
});

describe('POST /auth/forgot-password', () => {
  it('refuses a malformed e-mail', async () => {
    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nao-e-email' });

    expect(response.status).toBe(422);
  });
});

describe('POST /auth/reset-password — validation', () => {
  it('refuses a missing token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ password: 'senhaSegura1' });

    expect(response.status).toBe(422);
  });

  it('refuses a short password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'qualquer-token', password: 'curta' });

    expect(response.status).toBe(422);
  });
});

describe('refresh cookie hardening', () => {
  it('scopes the cookie to the auth routes and marks it httpOnly', async () => {
    const response = await request(app).post('/api/v1/auth/logout');
    const cookie = ((response.headers['set-cookie'] ?? []) as string[]).join(';');

    // httpOnly keeps it away from JavaScript; the narrow path keeps it off every
    // other API call.
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/v1/auth');
  });
});
