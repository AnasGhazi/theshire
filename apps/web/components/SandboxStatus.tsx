'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Status = 'checking' | 'online' | 'degraded' | 'offline';

const LABELS: Record<Status, string> = {
  checking: 'Checking the code runner…',
  online: 'Code runner online',
  degraded: 'Code runner unavailable: lessons work, but code can’t run right now',
  offline: 'Server unreachable',
};

const COLORS: Record<Status, string> = {
  checking: 'bg-muted',
  online: 'bg-lime',
  degraded: 'bg-warn',
  offline: 'bg-danger',
};

/** A status light for the sandbox, polled from /api/health. */
export function SandboxStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      api.health().then(
        (h) => !cancelled && setStatus(h.docker.available ? 'online' : 'degraded'),
        () => !cancelled && setStatus('offline'),
      );
    void check();
    const timer = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <span className="group relative flex items-center" tabIndex={0} aria-label={LABELS[status]}>
      <span className={`size-3.5 rounded-full ${COLORS[status]} ring-4 ring-white/5`} />
      <span className="pointer-events-none absolute top-7 right-0 z-30 w-max max-w-64 rounded-md border-2 border-line bg-raised px-3 py-2 text-sm text-ink opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100">
        {LABELS[status]}
      </span>
    </span>
  );
}
