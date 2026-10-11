import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig({})).toMatchObject({
      host: '0.0.0.0',
      port: 4000,
      logLevel: 'info',
      sandbox: { maxConcurrent: 4, maxQueue: 20 },
    });
  });

  it('fails loudly on an invalid port', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow(/Invalid environment configuration/);
  });

  it.each([
    ['SANDBOX_MEMORY_MB', '4096'],
    ['SANDBOX_TIMEOUT_MS', '600000'],
    ['SANDBOX_PIDS_LIMIT', '100000'],
    ['SANDBOX_CPUS', '8'],
  ])('refuses to loosen %s past its safety cap', (name, value) => {
    expect(() => loadConfig({ [name]: value })).toThrow(new RegExp(name));
  });
});
