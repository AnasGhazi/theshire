import { beforeAll, describe, expect, it } from 'vitest';
import { CLIENT, fakeGoogle } from './fake-google';
import { pkceChallenge } from './google';

describe('GoogleAuth', () => {
  let google: Awaited<ReturnType<typeof fakeGoogle>>;
  beforeAll(async () => {
    google = await fakeGoogle();
  });

  it('builds an authorization URL with PKCE, state, and nonce', () => {
    const url = new URL(
      google.auth.authorizationUrl({ state: 's1', nonce: 'n1', codeVerifier: 'v1' }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'client-123',
      redirect_uri: CLIENT.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: 's1',
      nonce: 'n1',
      code_challenge: pkceChallenge('v1'),
      code_challenge_method: 'S256',
    });
  });

  it('exchanges the code with the PKCE verifier and returns the verified profile', async () => {
    google.setClaims({ nonce: 'n1' });
    google.setToken(() => google.sign());
    const profile = await google.auth.exchangeCode('code-xyz', 'v1', 'n1');
    expect(profile).toEqual({
      sub: 'google-sub-1',
      email: 'sam@example.com',
      name: 'Sam',
      picture: 'https://pic',
    });
    expect(Object.fromEntries(google.requests.at(-1)!)).toMatchObject({
      code: 'code-xyz',
      code_verifier: 'v1',
      grant_type: 'authorization_code',
    });
  });

  it('drops unverified emails', async () => {
    google.setClaims({ nonce: 'n1' });
    google.setToken(() => google.sign({ email_verified: false }));
    expect((await google.auth.exchangeCode('c', 'v', 'n1')).email).toBeNull();
  });

  it.each([
    ['a replayed nonce', () => google.sign({ nonce: 'other' }), /nonce mismatch/],
    ['a token signed by another key', () => google.otherKeyToken(), /invalid id_token/],
    ['the wrong audience', () => google.sign({ aud: 'someone-else' }), /invalid id_token/],
    ['the wrong issuer', () => google.sign({ iss: 'https://evil.example' }), /invalid id_token/],
    [
      'an expired token',
      () => google.sign({ exp: Math.floor(Date.now() / 1000) - 60 }),
      /invalid id_token/,
    ],
  ])('rejects %s', async (_label, token, error) => {
    google.setClaims({ nonce: 'n1' });
    google.setToken(token);
    await expect(google.auth.exchangeCode('c', 'v', 'n1')).rejects.toThrow(error);
  });
});
