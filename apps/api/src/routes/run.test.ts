import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorResponse, MAX_CODE_LENGTH, RunResult } from '@theshire/shared';
import { buildApp, type App } from '../app';
import { AppError } from '../errors';
import type { Runner } from '../sandbox/types';
import { testApp } from '../test-utils';

const okResult: RunResult = {
  stdout: 'hi\n',
  stderr: '',
  exitCode: 0,
  timedOut: false,
  oomKilled: false,
  truncated: false,
  durationMs: 120,
};

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function appWith(runner: Runner) {
  app = await buildApp(testApp({ runner }));
  return app;
}

describe('POST /api/run', () => {
  it('passes the validated request to the runner and returns its result', async () => {
    const run = vi.fn<Runner['run']>().mockResolvedValue(okResult);
    const res = await (
      await appWith({ run })
    ).inject({
      method: 'POST',
      url: '/api/run',
      payload: { language: 'python', code: 'print("hi")' },
    });

    expect(res.statusCode).toBe(200);
    expect(RunResult.parse(res.json())).toEqual(okResult);
    expect(run).toHaveBeenCalledWith({ language: 'python', code: 'print("hi")' });
  });

  it.each([
    ['unknown language', { language: 'ruby', code: 'puts 1' }],
    ['missing code', { language: 'python' }],
    ['oversized code', { language: 'python', code: 'x'.repeat(MAX_CODE_LENGTH + 1) }],
  ])('rejects %s with 400 before reaching the runner', async (_label, payload) => {
    const run = vi.fn<Runner['run']>();
    const res = await (await appWith({ run })).inject({ method: 'POST', url: '/api/run', payload });

    expect(res.statusCode).toBe(400);
    expect(ErrorResponse.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
    expect(run).not.toHaveBeenCalled();
  });

  it.each([
    [429, 'SANDBOX_BUSY'],
    [503, 'SANDBOX_UNAVAILABLE'],
  ])('maps runner AppError %i to the error shape', async (status, code) => {
    const run = vi
      .fn<Runner['run']>()
      .mockRejectedValue(
        new AppError(status, code, 'nope', { cause: new Error('internal detail') }),
      );
    const res = await (
      await appWith({ run })
    ).inject({ method: 'POST', url: '/api/run', payload: { language: 'python', code: '' } });

    expect(res.statusCode).toBe(status);
    expect(res.json()).toEqual({ error: { code, message: 'nope' } });
  });
});
