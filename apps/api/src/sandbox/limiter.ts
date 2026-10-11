import { AppError } from '../errors';
import type { Runner } from './types';

/**
 * Caps how many tasks run at once. Extra tasks wait in a FIFO queue; once the queue is full,
 * new tasks are rejected immediately with a 429.
 */
export class ConcurrencyLimiter {
  private running = 0;
  private readonly queue: Array<() => void> = [];

  constructor(
    readonly maxConcurrent: number,
    readonly maxQueue: number,
  ) {}

  get stats() {
    return { running: this.running, queued: this.queue.length };
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        throw new AppError(
          429,
          'SANDBOX_BUSY',
          'Too many code runs in progress. Try again shortly.',
        );
      }
      await new Promise<void>((resolve) => this.queue.push(resolve));
    } else {
      this.running++;
    }
    try {
      return await task();
    } finally {
      const next = this.queue.shift();
      // Hand the slot straight to the next waiter, or free it.
      if (next) next();
      else this.running--;
    }
  }
}

export function limitRunner(runner: Runner, limiter: ConcurrencyLimiter): Runner {
  return { run: (request) => limiter.run(() => runner.run(request)) };
}
