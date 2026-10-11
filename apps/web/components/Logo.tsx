'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/sound';
import { GOLLUM } from './characters/sprites';
import { DOOR_AJAR_ROWS, DOOR_OPEN_ROWS, DOOR_PALETTE, DOOR_ROWS, PixelArt } from './PixelArt';
import { whirlTo } from './WhirlTransition';

type Door = 'closed' | 'ajar' | 'open';
type Peek = 'hidden' | 'eyes' | 'peek' | 'blink' | 'caught';

const DOORS: Record<Door, string[]> = {
  closed: DOOR_ROWS,
  ajar: DOOR_AJAR_ROWS,
  open: DOOR_OPEN_ROWS,
};
const GOLLUM_LINES = [
  'My precious…!',
  'Sneaky little coders…',
  'Gollum! Gollum!',
  'What has it got in its pocketses?',
];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The round-door logo. Elsewhere it opens and whirls you home; on the home page, a certain
 * someone sometimes peeks out of it.
 */
export function Logo() {
  const pathname = usePathname();
  const home = pathname === '/';
  const [door, setDoor] = useState<Door>('closed');
  const [peek, setPeek] = useState<Peek>('hidden');
  const [line, setLine] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const link = useRef<HTMLAnchorElement>(null);

  const after = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // The easter egg: on the home page, Gollum peeks out every so often.
  useEffect(() => {
    if (!home || reducedMotion()) return;
    let stop = false;
    const cycle = (delay: number) => {
      after(delay, () => {
        if (stop) return;
        setDoor('ajar');
        after(350, () => setPeek('eyes'));
        after(1300, () => setPeek('peek'));
        after(2100, () => setPeek('blink'));
        after(2250, () => setPeek('peek'));
        after(3600, () => setPeek('hidden'));
        after(3900, () => setDoor('closed'));
        after(3900, () => cycle(18_000 + Math.random() * 20_000));
      });
    };
    cycle(7000 + Math.random() * 5000);
    return () => {
      stop = true;
      clearAll();
      setPeek('hidden');
      setDoor('closed');
      setLine(null);
    };
  }, [home]);

  const catchGollum = () => {
    clearAll();
    sfx.gollum();
    setPeek('caught');
    setLine(GOLLUM_LINES[Math.floor(Math.random() * GOLLUM_LINES.length)]!);
    after(1600, () => setPeek('hidden'));
    after(1900, () => setDoor('closed'));
    after(2800, () => setLine(null));
  };

  const goHome = (e: React.MouseEvent) => {
    if (home || reducedMotion() || e.metaKey || e.ctrlKey || e.shiftKey) return; // let the link work
    e.preventDefault();
    sfx.door();
    setDoor('ajar');
    after(180, () => setDoor('open'));
    after(420, () => {
      const box = link.current?.getBoundingClientRect();
      whirlTo({ href: '/', x: box ? box.left + 20 : 30, y: box ? box.top + box.height / 2 : 36 });
    });
    after(1800, () => setDoor('closed'));
  };

  useEffect(() => clearAll, []);

  const gollumVisible = peek !== 'hidden';
  return (
    <div className="relative flex shrink-0 items-center">
      <Link
        href="/"
        ref={link}
        onClick={goHome}
        className="flex items-center gap-3"
        aria-label="The Shire home"
      >
        <span className="relative block h-8 w-10">
          <PixelArt rows={DOORS[door]} palette={DOOR_PALETTE} className="block size-full" />
        </span>
        <span className="font-pixel text-2xl leading-none tracking-tight text-white max-sm:hidden">
          The Shire
        </span>
      </Link>

      {gollumVisible && (
        <button
          type="button"
          onClick={catchGollum}
          aria-label="Gollum is peeking out of the door!"
          className={`absolute top-[5px] left-[3px] h-[23px] w-[25px] cursor-pointer transition-transform duration-300 ${
            peek === 'eyes'
              ? ''
              : peek === 'caught'
                ? '-translate-x-1 -rotate-12'
                : '-translate-x-2.5'
          }`}
        >
          <PixelArt
            rows={GOLLUM.frames[peek === 'eyes' ? 'eyes' : peek === 'blink' ? 'blink' : 'peek']!}
            palette={GOLLUM.palette}
            className="block size-full"
          />
        </button>
      )}
      {line && (
        <p
          role="status"
          className="pop-in absolute top-full left-0 z-30 mt-3 w-max rounded-lg border-3 border-ink bg-[#e8f4d9] px-3 py-2 text-sm font-bold text-[#2b2a1f]"
        >
          <span className="text-[#6f6a52]">Gollum:</span> {line}
        </p>
      )}
    </div>
  );
}
