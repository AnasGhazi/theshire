import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './errors';

/** Fixed-window request counter per key, held in memory (one API instance). */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Counts one hit for `key`. Returns 0 if allowed, else milliseconds until it would be. */
  consume(key: string): number {
    const now = this.now();
    if (this.windows.size > 10_000) this.sweep(now);

    const window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return 0;
    }
    if (window.count >= this.limit) return window.resetAt - now;
    window.count++;
    return 0;
  }

  private sweep(now: number) {
    for (const [key, window] of this.windows) if (window.resetAt <= now) this.windows.delete(key);
  }
}

export interface RateLimitSettings {
  perLearner: number;
  perIp: number;
  windowMs: number;
}

/** A preHandler enforcing both a per-learner and a per-IP limit on the routes that use it. */
export function createRateLimitHook({ perLearner, perIp, windowMs }: RateLimitSettings) {
  const byLearner = new RateLimiter(perLearner, windowMs);
  const byIp = new RateLimiter(perIp, windowMs);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const waitMs = Math.max(
      byLearner.consume(`learner:${request.learnerId}`),
      byIp.consume(`ip:${request.ip}`),
    );
    if (waitMs > 0) {
      reply.header('retry-after', Math.ceil(waitMs / 1000));
      throw new AppError(
        429,
        'RATE_LIMITED',
        'Too many runs. Take a breath and try again shortly.',
      );
    }
  };
}
