import { afterEach, describe, expect, it } from 'vitest';
import { ErrorResponse, HealthResponse } from '@theshire/shared';
import { buildApp, type App } from './app';
import { testApp } from './test-utils';

let app: App | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /api/health', () => {
  it('returns 200 with docker status when docker is available', async () => {
    app = await buildApp(
      testApp({ probeDocker: async () => ({ available: true, version: '27.0.0' }) }),
    );
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    const body = HealthResponse.parse(res.json());
    expect(body.docker).toEqual({ available: true, version: '27.0.0' });
  });

  it('still returns 200 (liveness) when docker is unavailable', async () => {
    app = await buildApp(testApp({ probeDocker: async () => ({ available: false }) }));
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    expect(HealthResponse.parse(res.json()).docker.available).toBe(false);
  });
});

describe('error handling', () => {
  it('returns the standard error shape for unknown routes', async () => {
    app = await buildApp(testApp());
    const res = await app.inject({ method: 'GET', url: '/api/nope' });

    expect(res.statusCode).toBe(404);
    expect(ErrorResponse.parse(res.json()).error.code).toBe('NOT_FOUND');
  });

  it('hides internal error details behind a 500', async () => {
    app = await buildApp(
      testApp({
        probeDocker: async () => {
          throw new Error('secret internals');
        },
      }),
    );
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});

describe('request ids', () => {
  it('generates one per request and returns it', async () => {
    app = await buildApp(testApp());
    const a = await app.inject({ method: 'GET', url: '/api/health' });
    const b = await app.inject({ method: 'GET', url: '/api/health' });
    expect(a.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
  });

  it('keeps an incoming X-Request-Id, including on errors', async () => {
    app = await buildApp(testApp());
    const res = await app.inject({
      method: 'GET',
      url: '/api/nope',
      headers: { 'x-request-id': 'trace-123' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.headers['x-request-id']).toBe('trace-123');
  });
});
