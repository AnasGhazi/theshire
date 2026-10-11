'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type AuthState } from '@/lib/api';
import { useProgress } from './ProgressProvider';

interface AuthContextValue {
  /** Null until loaded. */
  auth: AuthState | null;
  signOut: () => Promise<void>;
  /** Set when the last Google sign-in attempt didn't complete. */
  signInFailed: boolean;
  dismissSignInFailed: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { refresh } = useProgress();
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [signInFailed, setSignInFailed] = useState(false);

  useEffect(() => {
    api.auth.me().then(setAuth, () => setAuth({ user: null, googleEnabled: false }));

    // The API sends failed sign-ins back with ?signin=failed; show a notice and tidy the URL.
    const url = new URL(window.location.href);
    if (url.searchParams.get('signin') === 'failed') {
      url.searchParams.delete('signin');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      queueMicrotask(() => setSignInFailed(true));
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuth(await api.auth.logout());
    await refresh(); // now a fresh anonymous learner
  }, [refresh]);

  const value = useMemo(
    () => ({ auth, signOut, signInFailed, dismissSignInFailed: () => setSignInFailed(false) }),
    [auth, signOut, signInFailed],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
