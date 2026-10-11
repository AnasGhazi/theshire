/** Test helper: a stand-in for Google that signs ID tokens with a local key. */
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { GoogleAuth } from './google';

export const CLIENT = {
  clientId: 'client-123',
  clientSecret: 'secret',
  redirectUri: 'http://localhost:3000/api/auth/google/callback',
};

/** A stand-in for Google: issues ID tokens signed with a local key, served through a local JWKS. */
export async function fakeGoogle() {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  const jwks = createLocalJWKSet({ keys: [jwk] });
  let claims: JWTPayload = {};
  const requests: URLSearchParams[] = [];

  // All claims go in the payload (not via setters) so tests can override any of them.
  const sign = (overrides: JWTPayload = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      iss: 'https://accounts.google.com',
      aud: CLIENT.clientId,
      sub: 'google-sub-1',
      iat: now,
      exp: now + 300,
      email: 'sam@example.com',
      email_verified: true,
      name: 'Sam',
      picture: 'https://pic',
      ...claims,
      ...overrides,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .sign(privateKey);
  };

  let nextToken: () => Promise<string> = () => sign();
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    requests.push(new URLSearchParams(init.body as URLSearchParams));
    return new Response(JSON.stringify({ id_token: await nextToken() }), { status: 200 });
  }) as typeof fetch;

  return {
    auth: new GoogleAuth(CLIENT, { jwks, fetch: fetchImpl }),
    requests,
    /** Claims for the next token (e.g. the nonce the app sent). */
    setClaims: (c: JWTPayload) => (claims = c),
    setToken: (fn: () => Promise<string>) => (nextToken = fn),
    sign,
    otherKeyToken: async () => {
      const other = await generateKeyPair('RS256');
      return new SignJWT({ nonce: claims.nonce })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer('https://accounts.google.com')
        .setAudience(CLIENT.clientId)
        .setSubject('attacker')
        .setExpirationTime('5m')
        .sign(other.privateKey);
    },
  };
}
