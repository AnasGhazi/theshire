import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AuthState, ErrorResponse, type AccountUser } from '@theshire/shared';
import type { AccountRepository, User } from '../accounts/repository';
import type { GoogleAuth } from '../auth/google';
import { randomToken } from '../auth/google';
import { AppError } from '../errors';
import {
  clearSessionCookie,
  issueAnonymousLearner,
  sessionToken,
  setSessionCookie,
} from '../identity';

const OAUTH_COOKIE = 'theshire_oauth';
const OAUTH_COOKIE_PATH = '/api/auth/google';

/** Only same-site relative paths, so sign-in can't be turned into an open redirect. */
export function safeReturnTo(value: string | undefined): string {
  if (!value || value.length > 512 || !/^\/(?![/\\])[^\s\\]*$/.test(value)) return '/';
  return value;
}

const OAuthState = z.object({
  state: z.string(),
  nonce: z.string(),
  verifier: z.string(),
  returnTo: z.string(),
});

/** The sign-in flow saved in the signed cookie, or null if it's missing or malformed. */
function parseFlow(value: string | null): z.infer<typeof OAuthState> | null {
  if (!value) return null;
  try {
    const parsed = OAuthState.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const publicUser = (u: User | null): AccountUser | null =>
  u && { name: u.name, email: u.email, avatarUrl: u.avatarUrl };

export const authRoutes: FastifyPluginAsyncZod<{
  accounts: AccountRepository;
  google: GoogleAuth | null;
  secureCookies: boolean;
}> = async (app, { accounts, google, secureCookies }) => {
  app.get(
    '/auth/me',
    {
      schema: {
        summary: 'Who is signed in, and whether Google sign-in is available.',
        response: { 200: AuthState },
      },
    },
    async (request) => ({ user: publicUser(request.user), googleEnabled: google !== null }),
  );

  app.get(
    '/auth/google/login',
    {
      schema: {
        summary:
          'Starts "Sign in with Google": redirects to Google, then back to `returnTo` (a same-site path). 404 if not configured.',
        querystring: z.object({ returnTo: z.string().optional() }),
        response: { 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      if (!google)
        throw new AppError(404, 'AUTH_NOT_CONFIGURED', 'Google sign-in is not configured.');
      const flow = {
        state: randomToken(),
        nonce: randomToken(),
        verifier: randomToken(),
        returnTo: safeReturnTo(request.query.returnTo),
      };
      reply.setCookie(OAUTH_COOKIE, JSON.stringify(flow), {
        signed: true,
        httpOnly: true,
        sameSite: 'lax', // must survive the top-level redirect back from Google
        secure: secureCookies,
        path: OAUTH_COOKIE_PATH,
        maxAge: 600,
      });
      return reply.redirect(
        google.authorizationUrl({
          state: flow.state,
          nonce: flow.nonce,
          codeVerifier: flow.verifier,
        }),
      );
    },
  );

  app.get(
    '/auth/google/callback',
    {
      schema: {
        summary:
          'Google redirects here. Verifies the response, signs the learner in, and redirects back.',
        querystring: z.object({
          code: z.string().optional(),
          state: z.string().optional(),
          error: z.string().optional(),
        }),
        response: { 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      if (!google)
        throw new AppError(404, 'AUTH_NOT_CONFIGURED', 'Google sign-in is not configured.');

      const raw = request.cookies[OAUTH_COOKIE];
      reply.clearCookie(OAUTH_COOKIE, { path: OAUTH_COOKIE_PATH });
      const unsigned = raw ? request.unsignCookie(raw) : null;
      const flow = unsigned?.valid ? parseFlow(unsigned.value) : null;

      const fail = (reason: string) => {
        request.log.warn({ reason }, 'google sign-in failed');
        const target = flow?.returnTo ?? '/';
        return reply.redirect(`${target}${target.includes('?') ? '&' : '?'}signin=failed`);
      };

      if (!flow) return fail('missing or invalid flow cookie');
      if (request.query.error) return fail(`google returned ${request.query.error}`);
      if (!request.query.code || request.query.state !== flow.state) return fail('state mismatch');

      let user: User;
      try {
        const profile = await google.exchangeCode(request.query.code, flow.verifier, flow.nonce);
        user = await accounts.signInWithGoogle(profile, request.learnerId);
      } catch (err) {
        return fail((err as Error).message);
      }

      const previous = sessionToken(request);
      if (previous) await accounts.deleteSession(previous);
      setSessionCookie(reply, await accounts.createSession(user.id), secureCookies);
      // This browser's anonymous identity now belongs to (or was merged into) the account.
      issueAnonymousLearner(reply, secureCookies);
      request.log.info({ userId: user.id }, 'signed in with google');
      return reply.redirect(flow.returnTo);
    },
  );

  app.post(
    '/auth/logout',
    {
      schema: {
        summary: 'Signs out. The browser continues as a fresh anonymous learner.',
        response: { 200: AuthState },
      },
    },
    async (request, reply) => {
      const token = sessionToken(request);
      if (token) await accounts.deleteSession(token);
      clearSessionCookie(reply, secureCookies);
      issueAnonymousLearner(reply, secureCookies);
      return { user: null, googleEnabled: google !== null };
    },
  );
};
