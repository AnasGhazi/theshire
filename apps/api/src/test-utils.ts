import type { AppDeps, AppSettings, BuildAppOptions } from './app';
import { ContentIndex } from './content/load-content';
import { openDatabase } from './db/database';
import { SqliteProgressRepository } from './progress/repository';

export const testSettings: AppSettings = {
  cookieSecret: 'test-cookie-secret-that-is-long-enough',
  secureCookies: false,
  trustProxy: false,
  rateLimit: { perLearner: 1000, perIp: 1000, windowMs: 60_000 },
};

/** App options with harmless defaults: no content, a runner that must not be called, fresh DB. */
export function testApp(
  deps: Partial<AppDeps> = {},
  settings: Partial<AppSettings> = {},
): BuildAppOptions {
  return {
    deps: {
      probeDocker: async () => ({ available: true }),
      runner: { run: () => Promise.reject(new Error('runner not expected in this test')) },
      content: new ContentIndex([]),
      progress: new SqliteProgressRepository(openDatabase(':memory:')),
      ...deps,
    },
    settings: { ...testSettings, ...settings },
  };
}

/** Pulls the `name=value` pair out of a Set-Cookie header, ready to send back as a Cookie. */
export function cookieFrom(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!header) throw new Error('response set no cookie');
  return header.split(';')[0] as string;
}
