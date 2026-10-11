'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/sound';
import { PixelArt } from '../PixelArt';
import { BILBO, GANDALF, type SpriteSheet } from './sprites';

export type CharacterName = 'bilbo' | 'gandalf';
export type Mood = 'idle' | 'happy' | 'cast';

const SHEETS: Record<CharacterName, SpriteSheet> = { bilbo: BILBO, gandalf: GANDALF };
const LABELS: Record<CharacterName, string> = { bilbo: 'Bilbo Baggins', gandalf: 'Gandalf' };

/** Things they say when clicked (all original lines). */
const CHATTER: Record<CharacterName, string[]> = {
  bilbo: [
    'Second breakfast first, then loops?',
    "I'm going on a coding adventure!",
    'Psst! Stuck? The hint is under Help.',
    'Bugs are just unexpected adventures.',
    'A good program is like a good pantry: well organised.',
    'Run it early, run it often. That’s my motto.',
  ],
  gandalf: [
    'Read the last line of an error first. It usually knows.',
    'Every loop must find its way home.',
    'Small steps, young coder. Print as you go.',
    'Even wizards test their spells before casting them.',
    'A function should do one thing, and do it well.',
    'Patience. The answer is closer than you think.',
  ],
};

export interface SayEvent {
  who: CharacterName;
  text: string;
  mood?: Mood;
}

const SAY_EVENT = 'theshire:say';

/** Makes an on-screen character speak, from anywhere. */
export function say(event: SayEvent) {
  window.dispatchEvent(new CustomEvent<SayEvent>(SAY_EVENT, { detail: event }));
}

export function onSay(listener: (event: SayEvent) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<SayEvent>).detail);
  window.addEventListener(SAY_EVENT, handler);
  return () => window.removeEventListener(SAY_EVENT, handler);
}

/**
 * An animated pixel character: idles and blinks, hops and talks when clicked, and speaks when
 * `say()` is called for it. `bubble` controls where the speech bubble appears.
 */
export function Character({
  who,
  height,
  bubble = 'above',
  align = 'center',
  className = '',
}: {
  who: CharacterName;
  height: number;
  /** 'none' when a parent shows speech itself. */
  bubble?: 'above' | 'left' | 'none';
  /** For 'above' bubbles: which way the bubble extends, so it stays on screen near edges. */
  align?: 'center' | 'start' | 'end';
  className?: string;
}) {
  const sheet = SHEETS[who];
  const [frame, setFrame] = useState<'idle' | 'blink' | 'glow'>('idle');
  const [mood, setMood] = useState<Mood>('idle');
  const [speech, setSpeech] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const chatIndex = useRef(-1);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Blink every few seconds; Gandalf's staff also flickers.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(
        () => {
          setFrame('blink');
          timer = setTimeout(() => {
            setFrame(who === 'gandalf' && Math.random() < 0.5 ? 'glow' : 'idle');
            loop();
          }, 140);
        },
        2200 + Math.random() * 2800,
      );
    };
    loop();
    return () => clearTimeout(timer);
  }, [who]);

  const speak = useCallback((text: string, nextMood: Mood) => {
    clearTimeout(hideTimer.current);
    setSpeech(text);
    setMood(nextMood);
    setAnimKey((k) => k + 1); // restart the hop/cast animation
    hideTimer.current = setTimeout(
      () => {
        setSpeech(null);
        setMood('idle');
      },
      Math.max(3200, text.length * 70),
    );
  }, []);

  useEffect(() => {
    const unsubscribe = onSay(({ who: target, text, mood: m }) => {
      if (target === who) speak(text, m ?? 'happy');
    });
    return () => {
      unsubscribe();
      clearTimeout(hideTimer.current);
    };
  }, [who, speak]);

  const onClick = () => {
    const lines = CHATTER[who];
    chatIndex.current = (chatIndex.current + 1) % lines.length;
    (who === 'bilbo' ? sfx.bilbo : sfx.gandalf)();
    say({ who, text: lines[chatIndex.current]!, mood: who === 'gandalf' ? 'cast' : 'happy' });
  };

  const rows = sheet.frames[frame] ?? sheet.frames.idle!;
  const width = Math.max(...rows.map((r) => r.length));
  const pixelWidth = (height / rows.length) * width;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {speech && bubble !== 'none' && (
        <div
          role="status"
          className={`pop-in pointer-events-none absolute z-30 w-max max-w-64 rounded-lg border-3 border-ink bg-[#fffbea] px-3 py-2 font-sans text-sm leading-snug font-bold text-[#1a1405] shadow-[0_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-80 ${
            bubble === 'above'
              ? `bottom-full mb-3 ${align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`
              : 'top-1/2 right-full mr-3 -translate-y-1/2'
          }`}
        >
          {speech}
          <span
            aria-hidden
            className={`absolute size-3 rotate-45 border-ink bg-[#fffbea] ${
              bubble === 'above'
                ? `top-full -mt-1.5 border-r-3 border-b-3 ${align === 'start' ? 'left-6' : align === 'end' ? 'right-6' : 'left-1/2 -ml-1.5'}`
                : 'top-1/2 left-full -mt-1.5 -ml-1.5 border-t-3 border-r-3'
            }`}
          />
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        aria-label={`${LABELS[who]}: click to talk`}
        title={LABELS[who]}
        className="group cursor-pointer rounded-md focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-yellow"
      >
        <span
          key={animKey}
          className={`sprite-idle block ${mood === 'happy' ? 'sprite-hop' : mood === 'cast' ? 'sprite-cast' : ''}`}
        >
          <PixelArt
            rows={rows}
            palette={sheet.palette}
            className="block transition-transform group-hover:-translate-y-0.5"
            title={LABELS[who]}
            style={{ height, width: pixelWidth }}
          />
        </span>
      </button>
    </div>
  );
}
