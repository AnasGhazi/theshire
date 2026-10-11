import { describe, expect, it } from 'vitest';
import { HealthResponse } from './health';

describe('HealthResponse', () => {
  it('accepts a healthy payload without a docker version', () => {
    const parsed = HealthResponse.parse({
      status: 'ok',
      uptimeSeconds: 1.5,
      docker: { available: false },
    });
    expect(parsed.docker.available).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(() =>
      HealthResponse.parse({ status: 'degraded', uptimeSeconds: 0, docker: { available: true } }),
    ).toThrow();
  });
});
