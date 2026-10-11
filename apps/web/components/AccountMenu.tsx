'use client';

import { LogOut, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';

/** Google's "G" mark, as its sign-in branding guidelines require on the button. */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function AccountMenu() {
  const { auth, signOut, signInFailed, dismissSignInFailed } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!auth?.googleEnabled) return null;

  const notice = signInFailed && (
    <div
      role="alert"
      className="pop-in absolute top-full right-0 z-40 mt-3 flex w-72 items-start gap-2 rounded-lg border-2 border-danger bg-raised p-3 text-sm"
    >
      <span className="flex-1">Google sign-in didn’t finish. Please try again.</span>
      <button
        type="button"
        onClick={dismissSignInFailed}
        aria-label="Dismiss"
        className="text-muted hover:text-ink"
      >
        <X className="size-4" />
      </button>
    </div>
  );

  if (!auth.user) {
    return (
      <div className="relative">
        {/* Plain link: sign-in is a full-page redirect to Google and back. */}
        <a
          href={api.auth.googleSignInUrl(pathname)}
          className="flex h-10 items-center gap-2.5 rounded-full border border-[#8e918f] bg-[#131314] px-3 text-sm font-semibold whitespace-nowrap text-[#e3e3e3] transition-colors hover:bg-[#1f1f20]"
        >
          <GoogleG className="size-5" />
          <span className="max-sm:hidden">Sign in with Google</span>
          <span className="sm:hidden">Sign in</span>
        </a>
        {notice}
      </div>
    );
  }

  const { user } = auth;
  const initial = (user.name ?? user.email ?? '?').charAt(0).toUpperCase();
  return (
    <div className="relative" ref={menu}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Account: ${user.name ?? user.email ?? 'signed in'}`}
        className="flex size-10 items-center justify-center overflow-hidden rounded-full border-3 border-line bg-band font-pixel hover:border-[#4a5570]"
      >
        {user.avatarUrl ? (
          // Google-hosted avatar; a plain img avoids routing it through the image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover"
          />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div className="pop-in absolute top-full right-0 z-40 mt-3 w-64 overflow-hidden rounded-lg border-2 border-line bg-raised shadow-xl">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate font-bold">{user.name ?? 'Signed in'}</p>
            {user.email && <p className="truncate text-sm text-muted">{user.email}</p>}
            <p className="mt-2 text-xs text-lime">Progress saved to your account</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-band"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
