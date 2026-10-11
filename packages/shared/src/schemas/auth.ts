import { z } from 'zod';

export const AccountUser = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type AccountUser = z.infer<typeof AccountUser>;

export const AuthState = z.object({
  /** Null when browsing anonymously. */
  user: AccountUser.nullable(),
  /** Whether "Sign in with Google" is configured on this server. */
  googleEnabled: z.boolean(),
});
export type AuthState = z.infer<typeof AuthState>;
