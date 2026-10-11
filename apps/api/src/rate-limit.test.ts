import { afterEach, describe, expect, it } from 'vitest';
import type { RunResult } from '@theshire/shared';
import { buildApp, type App } from './app';
import { RateLimiter } from './rate-limit';
import { cookieFrom, testApp } from './test-utils';

describe('RateLimiter', () => {
  it('allows `limit` hits per window, then reports the wait', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.consume('k')).toBe(0);
    expect(limiter.consume('k')).toBe(0);
    now = 400;
    expect(limiter.consume('k')).toBe(600);
    expect(limiter.consume('other')).toBe(0);
    now = 1000;
    expect(limiter.consume('k')).toBe(0);
  });
});

describe('rate limiting on POST /api/run', () => {
  let app: App | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const ok: RunResult = {
    stdout: '',
    stderr: '',
    exitCode: 0,
    timedOut: false,
    oomKilled: false,
    truncated: false,
    durationMs: 1,
  };
  const post = (cookie?: string, ip = '10.0.0.1') =>
    app!.inject({
      method: 'POST',
      url: '/api/run',
      remoteAddress: ip,
      headers: cookie ? { cookie } : {},
      payload: { language: 'python', code: '' },
    });

  it('limits each learner, with a Retry-After header', async () => {
    app = await buildApp(
      testApp(
        { runner: { run: async () => ok } },
        { rateLimit: { perLearner: 2, perIp: 100, windowMs: 60_000 } },
      ),
    );
    const cookie = cookieFrom((await post()).headers['set-cookie']);
    expect((await post(cookie)).statusCode).toBe(200);

    const blocked = await post(cookie);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('limits each IP even when the learner drops their cookie', async () => {
    app = await buildApp(
      testApp(
        { runner: { run: async () => ok } },
        { rateLimit: { perLearner: 100, perIp: 3, windowMs: 60_000 } },
      ),
    );
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await post()).statusCode); // fresh learner each time
    expect(codes).toEqual([200, 200, 200, 429]);
    expect((await post(undefined, '10.0.0.2')).statusCode).toBe(200);
  });
});
