import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig({})).toMatchObject({ HOST: '0.0.0.0', PORT: 4000, LOG_LEVEL: 'info' });
  });

  it('fails loudly on an invalid port', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow(/Invalid environment configuration/);
  });
});
