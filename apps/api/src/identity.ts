import { randomUUID } from 'node:crypto';
import fastifyCookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Who is making the request. Route handlers rely only on this, never on the cookie. */
    learnerId: string;
  }
}

export const LEARNER_COOKIE = 'theshire_learner';
const ONE_YEAR_S = 60 * 60 * 24 * 365;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface IdentityOptions {
  cookieSecret: string;
  secureCookies: boolean;
}

/**
 * Anonymous identity: a random learner id in a signed, HTTP-only cookie, issued on first visit.
 * Real authentication can replace this function as long as it sets `request.learnerId`.
 */
export async function registerAnonymousIdentity(app: FastifyInstance, opts: IdentityOptions) {
  await app.register(fastifyCookie, { secret: opts.cookieSecret });
  app.decorateRequest('learnerId', '');

  app.addHook('onRequest', async (request, reply) => {
    const raw = request.cookies[LEARNER_COOKIE];
    if (raw) {
      const { valid, value } = request.unsignCookie(raw);
      if (valid && value && UUID.test(value)) {
        request.learnerId = value;
        return;
      }
    }
    request.learnerId = randomUUID();
    reply.setCookie(LEARNER_COOKIE, request.learnerId, {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.secureCookies,
      path: '/',
      maxAge: ONE_YEAR_S,
    });
  });
}
