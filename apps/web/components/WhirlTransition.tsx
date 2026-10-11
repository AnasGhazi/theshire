'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/sound';

const WHIRL_EVENT = 'theshire:whirl';
const IN_MS = 750;
const OUT_MS = 650;

interface WhirlRequest {
  href: string;
  /** Viewport point the whirl spins out from. */
  x: number;
  y: number;
}

/** Spins a magical whirl out from (x, y), navigates to `href` beneath it, then spins it away. */
export function whirlTo(request: WhirlRequest) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    window.location.assign(request.href);
    return;
  }
  window.dispatchEvent(new CustomEvent<WhirlRequest>(WHIRL_EVENT, { detail: request }));
}

type Phase =
  { kind: 'idle' } | { kind: 'in' | 'covered' | 'out'; x: number; y: number; target: string };

/** Lives in the root layout so the overlay survives the route change. */
export function WhirlTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const onWhirl = (e: Event) => {
      const { href, x, y } = (e as CustomEvent<WhirlRequest>).detail;
      const target = new URL(href, window.location.href).pathname;
      sfx.whirl();
      router.prefetch(href);
      setPhase({ kind: 'in', x, y, target });
      later(IN_MS, () => {
        setPhase((p) => (p.kind === 'in' ? { ...p, kind: 'covered' } : p));
        router.push(href);
      });
      // Never leave the screen covered, even if navigation stalls.
      later(IN_MS + 5000, () =>
        setPhase((p) => (p.kind === 'covered' ? { ...p, kind: 'out' } : p)),
      );
    };
    window.addEventListener(WHIRL_EVENT, onWhirl);
    const pending = timers.current;
    return () => {
      window.removeEventListener(WHIRL_EVENT, onWhirl);
      pending.forEach(clearTimeout);
    };
  }, [router, later]);

  // Once the new page is showing beneath the whirl, spin it away.
  useEffect(() => {
    if (phase.kind === 'covered' && pathname === phase.target) {
      later(120, () => setPhase((p) => (p.kind === 'covered' ? { ...p, kind: 'out' } : p)));
    }
    if (phase.kind === 'out') later(OUT_MS, () => setPhase({ kind: 'idle' }));
  }, [phase, pathname, later]);

  if (phase.kind === 'idle') return null;
  const origin =
    phase.kind === 'out' ? { x: '50%', y: '50%' } : { x: `${phase.x}px`, y: `${phase.y}px` };

  return (
    <div
      className={`whirl whirl-${phase.kind}`}
      style={{ '--whirl-x': origin.x, '--whirl-y': origin.y } as React.CSSProperties}
      aria-hidden
    >
      <div className="whirl-cover" />
      <div className="whirl-vortex" />
      <div className="whirl-sparkles">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}
