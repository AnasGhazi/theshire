'use client';

import Link from 'next/link';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <h1 className="font-pixel text-3xl">Something went wrong</h1>
      <p className="mt-4 text-lg text-muted">
        We couldn’t load this page. The server may be restarting. Give it a moment and try again.
      </p>
      <div className="mt-8 flex gap-4">
        <button type="button" onClick={reset} className="btn btn-yellow">
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Home
        </Link>
      </div>
    </main>
  );
}
