import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { GoogleProfile } from '../accounts/repository';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Must match an "Authorized redirect URI" on the OAuth client exactly. */
  redirectUri: string;
}

/** Random URL-safe value for state, nonce, and the PKCE verifier. */
export const randomToken = () => randomBytes(32).toString('base64url');
export const pkceChallenge = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

export class GoogleSignInError extends Error {
  override name = 'GoogleSignInError';
}

/**
 * "Sign in with Google" via the OAuth 2.0 authorization code flow with PKCE. The ID token is
 * verified against Google's published keys: signature, issuer, audience, expiry, and nonce.
 */
export class GoogleAuth {
  private readonly jwks: JWTVerifyGetKey;
  private readonly fetch: typeof fetch;

  constructor(
    private readonly config: GoogleAuthConfig,
    deps: { jwks?: JWTVerifyGetKey; fetch?: typeof fetch } = {},
  ) {
    this.jwks = deps.jwks ?? createRemoteJWKSet(new URL(JWKS_URL));
    this.fetch = deps.fetch ?? fetch;
  }

  authorizationUrl({
    state,
    nonce,
    codeVerifier,
  }: {
    state: string;
    nonce: string;
    codeVerifier: string;
  }) {
    const url = new URL(AUTH_ENDPOINT);
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: pkceChallenge(codeVerifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    return url.toString();
  }

  async exchangeCode(code: string, codeVerifier: string, nonce: string): Promise<GoogleProfile> {
    const res = await this.fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        code_verifier: codeVerifier,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new GoogleSignInError(`token exchange failed with ${res.status}`);
    const body = (await res.json()) as { id_token?: unknown };
    if (typeof body.id_token !== 'string') throw new GoogleSignInError('no id_token in response');

    const { payload } = await jwtVerify(body.id_token, this.jwks, {
      issuer: ISSUERS,
      audience: this.config.clientId,
    }).catch((err: unknown) => {
      throw new GoogleSignInError(`invalid id_token: ${(err as Error).message}`);
    });
    if (payload.nonce !== nonce) throw new GoogleSignInError('nonce mismatch');
    if (typeof payload.sub !== 'string') throw new GoogleSignInError('id_token has no subject');

    const str = (v: unknown) => (typeof v === 'string' ? v : null);
    return {
      sub: payload.sub,
      // Only trust the email once Google has verified it.
      email: payload.email_verified === true ? str(payload.email) : null,
      name: str(payload.name),
      picture: str(payload.picture),
    };
  }
}
