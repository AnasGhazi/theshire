import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from './app';
import { LEARNER_COOKIE } from './identity';
import { cookieFrom, testApp } from './test-utils';

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** Records a passed exercise for whoever sends `cookie`, then reads their progress. */
async function whoAmI(cookie?: string) {
  const res = await app!.inject({
    method: 'GET',
    url: '/api/progress',
    headers: cookie ? { cookie } : {},
  });
  return res;
}

describe('anonymous learner identity', () => {
  it('issues a signed, HTTP-only, SameSite=Lax cookie on first visit', async () => {
    app = await buildApp(testApp());
    const res = await whoAmI();
    const header = String(res.headers['set-cookie']);

    expect(header).toMatch(new RegExp(`^${LEARNER_COOKIE}=[0-9a-f-]{36}\\.[\\w+/=-]+;`));
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).not.toContain('Secure');
  });

  it('marks the cookie Secure when configured', async () => {
    app = await buildApp(testApp({}, { secureCookies: true }));
    expect(String((await whoAmI()).headers['set-cookie'])).toContain('Secure');
  });

  it('keeps the same learner while the cookie is sent back', async () => {
    const recorded: string[] = [];
    app = await buildApp(testApp());
    app.addHook('onRequest', async (request) => {
      recorded.push(request.learnerId);
    });
    const cookie = cookieFrom((await whoAmI()).headers['set-cookie']);
    const again = await whoAmI(cookie);

    expect(again.headers['set-cookie']).toBeUndefined();
    expect(recorded[0]).toBe(recorded[1]);
  });

  it.each([
    ['tampered signature', (c: string) => c.slice(0, -2) + 'xx'],
    ['unsigned value', () => `${LEARNER_COOKIE}=00000000-0000-4000-8000-000000000000`],
    ['non-uuid value', () => `${LEARNER_COOKIE}=admin`],
  ])('replaces a %s with a fresh identity', async (_label, mangle) => {
    app = await buildApp(testApp());
    const cookie = cookieFrom((await whoAmI()).headers['set-cookie']);
    const res = await whoAmI(mangle(cookie));
    const fresh = cookieFrom(res.headers['set-cookie']);

    expect(fresh).not.toBe(cookie);
  });
});
