import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from '@futcheck/shared';

import { createApp } from './app.js';

const app = createApp();

describe('GET /health', () => {
  it('answers without touching the database', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      environment: 'test',
      timezone: 'America/Sao_Paulo',
    });
    expect(typeof response.body.uptime).toBe('number');
  });
});

describe('GET /api/v1', () => {
  it('describes the API surface', async () => {
    const response = await request(app).get('/api/v1');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: 'FutCheck API', version: 'v1' });
  });
});

describe('error contract', () => {
  it('returns 404 in the { error: { code, message } } shape', async () => {
    const response = await request(app).get('/api/v1/rota-que-nao-existe');

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: ERROR_CODES.NOT_FOUND,
    });
    expect(typeof response.body.error.message).toBe('string');
  });

  it('rejects malformed JSON with a validation error, not a crash', async () => {
    const response = await request(app)
      .post('/api/v1/qualquer-coisa')
      .set('Content-Type', 'application/json')
      .send('{"name": ');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });
});

describe('security posture', () => {
  it('sets helmet headers and hides the framework', async () => {
    const response = await request(app).get('/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
  });

  it('echoes a request id so a user can quote it in a bug report', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('honours an inbound request id from the proxy', async () => {
    const response = await request(app).get('/health').set('x-request-id', 'trace-abc-123');
    expect(response.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('allows an origin from the allowlist', async () => {
    const response = await request(app).get('/health').set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('refuses an origin outside the allowlist', async () => {
    const response = await request(app).get('/health').set('Origin', 'https://site-malicioso.com');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers a refused origin without failing the request', async () => {
    // The browser is what must refuse the response. Throwing here turned every
    // cross-origin probe into a 500 and hid the real problem.
    const response = await request(app).get('/health').set('Origin', 'https://site-malicioso.com');

    expect(response.status).toBe(200);
  });

  it('allows a request from the origin it is itself served on', async () => {
    // Vite marks its module scripts `crossorigin`, so the browser sends an
    // Origin header even for the app's own JavaScript. Rejecting that left the
    // page with no scripts at all.
    const response = await request(app)
      .get('/health')
      .set('Host', 'futcheck.example')
      .set('Origin', 'http://futcheck.example');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://futcheck.example');
  });
});
