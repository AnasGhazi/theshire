import { describe, expect, it } from 'vitest';
import type { AppError } from '../errors';
import { ConcurrencyLimiter } from './limiter';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const tick = () => new Promise((r) => setImmediate(r));

describe('ConcurrencyLimiter', () => {
  it('runs up to maxConcurrent tasks at once and queues the rest in order', async () => {
    const limiter = new ConcurrencyLimiter(2, 10);
    const gates = [deferred(), deferred(), deferred()];
    const started: number[] = [];
    const results = gates.map((gate, i) =>
      limiter.run(async () => {
        started.push(i);
        await gate.promise;
        return i;
      }),
    );

    await tick();
    expect(started).toEqual([0, 1]);
    expect(limiter.stats).toEqual({ running: 2, queued: 1 });

    gates[0]!.resolve();
    await tick();
    expect(started).toEqual([0, 1, 2]);
    expect(limiter.stats).toEqual({ running: 2, queued: 0 });

    gates[1]!.resolve();
    gates[2]!.resolve();
    expect(await Promise.all(results)).toEqual([0, 1, 2]);
    expect(limiter.stats).toEqual({ running: 0, queued: 0 });
  });

  it('rejects with 429 once the queue is full', async () => {
    const limiter = new ConcurrencyLimiter(1, 1);
    const gate = deferred();
    const first = limiter.run(() => gate.promise);
    const second = limiter.run(async () => 'queued');

    await expect(limiter.run(async () => 'overflow')).rejects.toMatchObject({
      statusCode: 429,
      code: 'SANDBOX_BUSY',
    } satisfies Partial<AppError>);

    gate.resolve();
    await first;
    expect(await second).toBe('queued');
  });

  it('frees the slot when a task fails', async () => {
    const limiter = new ConcurrencyLimiter(1, 0);
    await expect(limiter.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await limiter.run(async () => 'next')).toBe('next');
  });
});
