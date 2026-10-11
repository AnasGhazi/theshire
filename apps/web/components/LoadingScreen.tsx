'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { music, musicSetting, preloadMusic } from '@/lib/music';
import { soundSettings } from '@/lib/sound';
import { DOOR_OPEN_ROWS, DOOR_PALETTE, DOOR_ROWS, PixelArt } from './PixelArt';

const TIPS = [
  'Brewing second breakfast…',
  'Polishing the round door…',
  'Counting the mushrooms…',
  'Waking the wizard…',
  'Lighting the lanterns…',
];

type Phase = 'loading' | 'leaving' | 'gone';

/**
 * A title screen on every full page load. It covers the moment while fonts and, on the home page,
 * the whole music track download, so the site appears with music ready to play at once. It then
 * opens like the round door and gets out of the way on its own.
 */
export function LoadingScreen() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState(0);
  const [tip, setTip] = useState(TIPS[0]!);
  const [home] = useState(() => pathname === '/');

  useEffect(() => {
    let cancelled = false;
    const wantsMusic = home && musicSetting.get() && !soundSettings.isMuted();
    const tips = setInterval(() => setTip(TIPS[Math.floor(Math.random() * TIPS.length)]!), 1200);

    const minimum = new Promise((r) => setTimeout(r, wantsMusic ? 900 : 450));
    const assets = Promise.all([
      document.fonts.ready,
      wantsMusic ? preloadMusic((f) => !cancelled && setProgress(f)) : Promise.resolve(),
    ]);
    const timeout = new Promise((r) => setTimeout(r, 10_000)); // never trap anyone behind it

    void Promise.all([minimum, Promise.race([assets, timeout])]).then(() => {
      if (cancelled) return;
      clearInterval(tips);
      setProgress(1);
      // Start the music as the door opens. Browsers that block autoplay reject this; the home
      // page then starts it on the first click or key press (see HomeMusic).
      if (wantsMusic)
        void music()
          .play()
          .catch(() => {});
      setPhase('leaving');
      setTimeout(() => setPhase('gone'), home ? 900 : 400);
    });
    return () => {
      cancelled = true;
      clearInterval(tips);
    };
  }, [home]);

  if (phase === 'gone') return null;

  const doorOpen = phase === 'leaving' && home;
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
        className={`flex w-full max-w-sm flex-col items-center gap-4 transition-opacity duration-300 ${doorOpen ? 'opacity-0' : ''}`}
      >
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
      </div>
      <noscript>
        <style>{'[aria-label="The Shire is loading"]{display:none!important}'}</style>
      </noscript>
    </div>
  );
}
