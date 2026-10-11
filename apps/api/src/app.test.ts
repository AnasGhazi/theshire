import { afterEach, describe, expect, it } from 'vitest';
import { ErrorResponse, HealthResponse } from '@theshire/shared';
import { buildApp, type App } from './app';
import type { Runner } from './sandbox/types';
import { ContentIndex } from './content/load-content';

const noRunner: Runner = {
  run: () => Promise.reject(new Error('runner not expected in this test')),
};

let app: App | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /api/health', () => {
  it('returns 200 with docker status when docker is available', async () => {
    app = await buildApp({
      probeDocker: async () => ({ available: true, version: '27.0.0' }),
      runner: noRunner,
      content: new ContentIndex([]),
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    const body = HealthResponse.parse(res.json());
    expect(body.docker).toEqual({ available: true, version: '27.0.0' });
  });

  it('still returns 200 (liveness) when docker is unavailable', async () => {
    app = await buildApp({
      probeDocker: async () => ({ available: false }),
      runner: noRunner,
      content: new ContentIndex([]),
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    expect(HealthResponse.parse(res.json()).docker.available).toBe(false);
  });
});

describe('error handling', () => {
  it('returns the standard error shape for unknown routes', async () => {
    app = await buildApp({
      probeDocker: async () => ({ available: false }),
      runner: noRunner,
      content: new ContentIndex([]),
    });
    const res = await app.inject({ method: 'GET', url: '/api/nope' });

    expect(res.statusCode).toBe(404);
    expect(ErrorResponse.parse(res.json()).error.code).toBe('NOT_FOUND');
  });

  it('hides internal error details behind a 500', async () => {
    app = await buildApp({
      probeDocker: async () => {
        throw new Error('secret internals');
      },
      runner: noRunner,
      content: new ContentIndex([]),
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});
