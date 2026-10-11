'use client';

import { Play } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { music, musicSetting, preloadMusic } from '@/lib/music';
import { sfx, soundSettings } from '@/lib/sound';
import { DOOR_OPEN_ROWS, DOOR_PALETTE, DOOR_ROWS, PixelArt } from './PixelArt';

const TIPS = [
  'Brewing second breakfast…',
  'Polishing the round door…',
  'Counting the mushrooms…',
  'Waking the wizard…',
  'Lighting the pipe-weed lanterns…',
];

type Phase = 'loading' | 'ready' | 'leaving' | 'gone';

/**
 * A title screen shown on every full page load. It waits for fonts (and, on the home page, the
 * music), then on the home page asks the visitor to press Enter: that press is the user gesture
 * browsers require before playing sound, so the music can start immediately.
 */
export function LoadingScreen() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState(0);
  const [tip, setTip] = useState(TIPS[0]!);
  const gate = useRef(false); // whether this load needs the "Enter" press
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    const wantsMusic = pathname === '/' && musicSetting.get() && !soundSettings.isMuted();
    gate.current = wantsMusic;
    const tips = setInterval(() => setTip(TIPS[Math.floor(Math.random() * TIPS.length)]!), 1400);

    const minimum = new Promise((r) => setTimeout(r, wantsMusic ? 900 : 450));
    const assets = Promise.all([
      document.fonts.ready,
      wantsMusic ? preloadMusic((f) => !cancelled && setProgress(f)) : Promise.resolve(),
    ]);
    const timeout = new Promise((r) => setTimeout(r, 12_000)); // never trap anyone behind it

    void Promise.all([minimum, Promise.race([assets, timeout])]).then(() => {
      if (cancelled) return;
      clearInterval(tips);
      setProgress(1);
      if (wantsMusic) setPhase('ready');
      else leave(false);
    });
    return () => {
      cancelled = true;
      clearInterval(tips);
    };
    // Only for the page the site was loaded on; later navigations are client-side.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'ready') return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        enter(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function leave(withDoor: boolean) {
    setPhase('leaving');
    setTimeout(() => setPhase('gone'), withDoor ? 900 : 400);
  }

  function enter(withMusic: boolean) {
    if (phase !== 'ready') return;
    if (withMusic) {
      void music()
        .play()
        .catch(() => {}); // inside the click/key handler, so it's allowed
      sfx.door();
    } else {
      musicSetting.set(false);
    }
    leave(true);
  }

  if (phase === 'gone') return null;

  const doorOpen = phase === 'leaving' && gate.current;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The Shire is loading"
      className={`fixed inset-0 z-[90] flex flex-col items-center justify-center gap-8 bg-page px-6 text-center transition-opacity duration-500 ${
        phase === 'leaving' ? 'pointer-events-none opacity-0 delay-300' : 'opacity-100'
      }`}
    >
      <PixelArt
        rows={doorOpen ? DOOR_OPEN_ROWS : DOOR_ROWS}
        palette={DOOR_PALETTE}
        className={`h-32 w-40 transition-transform duration-700 ${doorOpen ? 'scale-[8]' : 'sprite-idle'}`}
      />
      <div className={`transition-opacity duration-300 ${doorOpen ? 'opacity-0' : ''}`}>
        <h1 className="font-pixel text-5xl">The Shire</h1>
        <p className="mt-2 text-lg text-muted">Learn to code. Second breakfast optional.</p>
      </div>

      <div
        className={`flex h-24 w-full max-w-sm flex-col items-center gap-4 transition-opacity duration-300 ${doorOpen ? 'opacity-0' : ''}`}
      >
        {phase === 'loading' ? (
          <>
            <div
              className="pbar w-full"
              role="progressbar"
              aria-label="Loading"
              aria-valuenow={Math.round(progress * 100)}
            >
              <span style={{ width: `${Math.max(4, progress * 100)}%` }} />
            </div>
            <p className="font-pixel text-sm text-muted" aria-live="polite">
              {tip}
            </p>
          </>
        ) : (
          <>
            <button
              ref={button}
              type="button"
              onClick={() => enter(true)}
              className="btn btn-yellow pop-in text-xl"
            >
              <Play className="size-5 fill-current" /> Enter the Shire
            </button>
            <button
              type="button"
              onClick={() => enter(false)}
              className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Enter without music
            </button>
          </>
        )}
      </div>
      <noscript>
        <style>{'[aria-label="The Shire is loading"]{display:none!important}'}</style>
      </noscript>
    </div>
  );
}
