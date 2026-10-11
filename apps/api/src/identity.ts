import { randomUUID } from 'node:crypto';
import fastifyCookie from '@fastify/cookie';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AccountRepository, User } from './accounts/repository';
import { SESSION_TTL_MS } from './accounts/repository';

declare module 'fastify' {
  interface FastifyRequest {
    /** Whose progress this request reads and writes. Handlers rely only on this, never on cookies. */
    learnerId: string;
    /** The signed-in account, or null for anonymous visitors. */
    user: User | null;
  }
}

export const LEARNER_COOKIE = 'theshire_learner';
export const SESSION_COOKIE = 'theshire_session';
const ONE_YEAR_S = 60 * 60 * 24 * 365;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface IdentityOptions {
  cookieSecret: string;
  secureCookies: boolean;
  accounts: AccountRepository;
}

const cookieBase = (secure: boolean) => ({
  signed: true,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure,
  path: '/',
});

/** Gives this browser a brand-new anonymous learner (on first visit, sign-in, and sign-out). */
export function issueAnonymousLearner(reply: FastifyReply, secure: boolean): string {
  const id = randomUUID();
  reply.setCookie(LEARNER_COOKIE, id, { ...cookieBase(secure), maxAge: ONE_YEAR_S });
  return id;
}

export function setSessionCookie(reply: FastifyReply, token: string, secure: boolean) {
  reply.setCookie(SESSION_COOKIE, token, { ...cookieBase(secure), maxAge: SESSION_TTL_MS / 1000 });
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean) {
  reply.clearCookie(SESSION_COOKIE, cookieBase(secure));
}

/**
 * Identity middleware. A valid session cookie means a signed-in account; otherwise the visitor is
 * an anonymous learner identified by a signed, HTTP-only cookie issued on first visit.
 */
export async function registerIdentity(app: FastifyInstance, opts: IdentityOptions) {
  await app.register(fastifyCookie, { secret: opts.cookieSecret });
  app.decorateRequest('learnerId', '');
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (request, reply) => {
    const session = request.cookies[SESSION_COOKIE];
    if (session) {
      const { valid, value } = request.unsignCookie(session);
      const user = valid && value ? await opts.accounts.findSession(value) : null;
      if (user) {
        request.user = user;
        request.learnerId = user.learnerId;
        return;
      }
      clearSessionCookie(reply, opts.secureCookies); // expired, revoked, or tampered
    }

    const raw = request.cookies[LEARNER_COOKIE];
    if (raw) {
      const { valid, value } = request.unsignCookie(raw);
      if (valid && value && UUID.test(value)) {
        request.learnerId = value;
        return;
      }
    }
    request.learnerId = issueAnonymousLearner(reply, opts.secureCookies);
  });
}

/** The session token from the request, if its signature is valid. */
export function sessionToken(request: {
  cookies: Record<string, string | undefined>;
  unsignCookie: FastifyInstance['unsignCookie'];
}) {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const { valid, value } = request.unsignCookie(raw);
  return valid ? value : null;
}
