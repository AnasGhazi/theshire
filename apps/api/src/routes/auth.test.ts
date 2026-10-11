import { afterEach, describe, expect, it } from 'vitest';
import { AuthState, Progress } from '@theshire/shared';
import { buildApp, type App } from '../app';
import { fakeGoogle } from '../auth/fake-google';
import { LEARNER_COOKIE, SESSION_COOKIE } from '../identity';
import { cookieFrom, testApp } from '../test-utils';
import { safeReturnTo } from './auth';

type Google = Awaited<ReturnType<typeof fakeGoogle>>;

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** A tiny cookie jar, so tests behave like one browser. */
class Browser {
  private jar = new Map<string, string>();
  constructor(private readonly app: App) {}
  get cookie() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  private store(setCookie: string | string[] | undefined) {
    for (const header of Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []) {
      const [pair, ...attrs] = header.split(';');
      const [name, value] = pair!.split(/=(.*)/s) as [string, string];
      const expired = attrs.some((a) => /expires=thu, 01 jan 1970/i.test(a)) || value === '';
      if (expired) this.jar.delete(name.trim());
      else this.jar.set(name.trim(), value);
    }
  }
  async request(method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) {
    const res = await this.app.inject({
      method,
      url,
      headers: { cookie: this.cookie },
      ...(payload ? { payload } : {}),
    });
    this.store(res.headers['set-cookie']);
    return res;
  }
  /** Runs the whole Google flow: login redirect, Google consent (faked), callback. */
  async signIn(google: Google, returnTo = '/lessons/x', sub = 'google-sub-1') {
    const login = await this.request(
      'GET',
      `/api/auth/google/login?returnTo=${encodeURIComponent(returnTo)}`,
    );
    const authUrl = new URL(String(login.headers.location));
    google.setClaims({ nonce: authUrl.searchParams.get('nonce')!, sub });
    google.setToken(() => google.sign());
    return this.request(
      'GET',
      `/api/auth/google/callback?code=abc&state=${authUrl.searchParams.get('state')}`,
    );
  }
  async me() {
    return AuthState.parse((await this.request('GET', '/api/auth/me')).json());
  }
  async progress() {
    return Progress.parse((await this.request('GET', '/api/progress')).json());
  }
}

async function setup() {
  const google = await fakeGoogle();
  const options = testApp({ google: google.auth });
  app = await buildApp(options);
  return {
    google,
    browser: () => new Browser(app!),
    accounts: options.deps.accounts,
    progress: options.deps.progress,
  };
}

describe('Google sign-in', () => {
  it('reports when Google sign-in is not configured', async () => {
    app = await buildApp(testApp());
    expect((await app.inject({ method: 'GET', url: '/api/auth/me' })).json()).toEqual({
      user: null,
      googleEnabled: false,
    });
    const login = await app.inject({ method: 'GET', url: '/api/auth/google/login' });
    expect(login.statusCode).toBe(404);
    expect(login.json().error.code).toBe('AUTH_NOT_CONFIGURED');
  });

  it('signs in, returns to the page, and attributes progress to the account', async () => {
    const { google, browser } = await setup();
    const b = browser();
    expect(await b.me()).toEqual({ user: null, googleEnabled: true });

    const login = await b.request(
      'GET',
      '/api/auth/google/login?returnTo=/lessons/python-basics-03',
    );
    expect(login.statusCode).toBe(302);
    expect(String(login.headers.location)).toMatch(/^https:\/\/accounts\.google\.com\//);
    const flowCookie = String(login.headers['set-cookie']);
    expect(flowCookie).toMatch(/theshire_oauth=.*HttpOnly/);
    expect(flowCookie).toContain('Path=/api/auth/google');

    const authUrl = new URL(String(login.headers.location));
    google.setClaims({ nonce: authUrl.searchParams.get('nonce')!, sub: 'google-sub-1' });
    google.setToken(() => google.sign());
    const callback = await b.request(
      'GET',
      `/api/auth/google/callback?code=abc&state=${authUrl.searchParams.get('state')}`,
    );

    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe('/lessons/python-basics-03');
    expect(cookieFrom(callback.headers['set-cookie'], SESSION_COOKIE)).toBeTruthy();
    expect(await b.me()).toEqual({
      user: { name: 'Sam', email: 'sam@example.com', avatarUrl: 'https://pic' },
      googleEnabled: true,
    });
  });

  it("keeps a new user's anonymous progress", async () => {
    const { google, browser, progress } = await setup();
    const b = browser();
    await b.request('GET', '/api/auth/me'); // first visit: anonymous learner cookie
    const anon = decodeURIComponent(b.cookie.match(new RegExp(`${LEARNER_COOKIE}=([^.;]+)`))![1]!);
    await progress.recordAttempt(anon, 'ex1', true);
    await progress.completeLesson(anon, 'l1');

    await b.signIn(google);
    const p = await b.progress();
    expect(p.completedLessons.map((l) => l.lessonId)).toEqual(['l1']);
    expect(p.exercises).toEqual([{ exerciseId: 'ex1', attempts: 1, passedAt: expect.any(String) }]);
  });

  it('merges a second device into the existing account and follows the user across browsers', async () => {
    const { google, browser, progress } = await setup();
    const laptop = browser();
    await laptop.signIn(google);
    expect(await laptop.progress()).toEqual({ completedLessons: [], exercises: [] });

    // On a phone, the learner does some work anonymously first...
    const phone = browser();
    await phone.request('GET', '/api/auth/me');
    const phoneAnon = decodeURIComponent(
      phone.cookie.match(new RegExp(`${LEARNER_COOKIE}=([^.;]+)`))![1]!,
    );
    await progress.recordAttempt(phoneAnon, 'ex1', false);
    await progress.recordAttempt(phoneAnon, 'ex1', true);
    await progress.completeLesson(phoneAnon, 'l1');

    // ...then signs in with the same Google account.
    await phone.signIn(google);
    const merged = await phone.progress();
    expect(merged.completedLessons.map((l) => l.lessonId)).toEqual(['l1']);
    expect(merged.exercises[0]).toMatchObject({ exerciseId: 'ex1', attempts: 2 });

    // The laptop sees the same account progress.
    expect(await laptop.progress()).toEqual(merged);
  });

  it('signs out to a fresh anonymous learner that cannot see account progress', async () => {
    const { google, browser, progress, accounts } = await setup();
    const b = browser();
    await b.signIn(google);
    const user = await accounts.findSession(
      decodeURIComponent(b.cookie.match(/theshire_session=([^.;]+)/)![1]!),
    );
    await progress.completeLesson(user!.learnerId, 'l1');
    expect((await b.progress()).completedLessons).toHaveLength(1);

    const out = await b.request('POST', '/api/auth/logout');
    expect(AuthState.parse(out.json()).user).toBeNull();
    expect(await b.me()).toMatchObject({ user: null });
    expect((await b.progress()).completedLessons).toEqual([]);
  });

  it('revokes the session server-side on sign-out', async () => {
    const { google, browser } = await setup();
    const b = browser();
    await b.signIn(google);
    const stolen = b.cookie; // e.g. copied before sign-out
    await b.request('POST', '/api/auth/logout');
    const res = await (app as App).inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: stolen },
    });
    expect(res.json().user).toBeNull();
  });

  it.each([
    ['a wrong state', (state: string) => `code=abc&state=${state}x`],
    ['Google reporting an error', () => 'error=access_denied'],
    ['no code', (state: string) => `state=${state}`],
  ])('fails safely on %s', async (_label, query) => {
    const { browser } = await setup();
    const b = browser();
    const login = await b.request('GET', '/api/auth/google/login?returnTo=/courses/c');
    const state = new URL(String(login.headers.location)).searchParams.get('state')!;
    const res = await b.request('GET', `/api/auth/google/callback?${query(state)}`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/courses/c?signin=failed');
    expect(await b.me()).toMatchObject({ user: null });
  });

  it('rejects a callback with no flow cookie (CSRF / login injection)', async () => {
    const { browser } = await setup();
    const res = await browser().request('GET', '/api/auth/google/callback?code=abc&state=whatever');
    expect(res.headers.location).toBe('/?signin=failed');
  });

  it('fails safely when the ID token is forged', async () => {
    const { google, browser } = await setup();
    const b = browser();
    const login = await b.request('GET', '/api/auth/google/login');
    const authUrl = new URL(String(login.headers.location));
    google.setClaims({ nonce: authUrl.searchParams.get('nonce')! });
    google.setToken(() => google.otherKeyToken());
    const res = await b.request(
      'GET',
      `/api/auth/google/callback?code=abc&state=${authUrl.searchParams.get('state')}`,
    );
    expect(res.headers.location).toBe('/?signin=failed');
    expect(await b.me()).toMatchObject({ user: null });
  });
});

describe('safeReturnTo', () => {
  it.each([
    ['/lessons/a', '/lessons/a'],
    ['/courses/x?tab=1', '/courses/x?tab=1'],
    [undefined, '/'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['javascript:alert(1)', '/'],
    ['/ok path', '/'],
  ])('%s -> %s', (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });
});
