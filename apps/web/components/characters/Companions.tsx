'use client';

import { useEffect, useRef, useState } from 'react';
import type { Language } from '@/lib/api';
import { onOutcome, type Outcome } from '@/lib/events';
import { Character, onSay, say, type SayEvent } from './Character';

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]!;

/** What the companions say about each outcome. */
function react(outcome: Outcome, language: Language): SayEvent[] {
  if (outcome.kind === 'request-failed') {
    return [
      {
        who: 'gandalf',
        text: 'The road to the server is blocked. Try again in a moment.',
        mood: 'cast',
      },
    ];
  }
  if (outcome.kind === 'run') {
    const r = outcome.result;
    if (r.timedOut)
      return [
        { who: 'gandalf', text: 'That loop wanders forever. Give it a way home.', mood: 'cast' },
      ];
    if (r.oomKilled)
      return [
        {
          who: 'gandalf',
          text: 'Too much memory! Something keeps growing without end.',
          mood: 'cast',
        },
      ];
    if (r.truncated)
      return [{ who: 'gandalf', text: 'So much printing! Is a loop running away?', mood: 'cast' }];
    if (r.exitCode !== 0) {
      const where = language === 'python' ? 'traceback' : 'error message';
      return [
        {
          who: 'gandalf',
          text: `An error! Read the last line of the ${where} first.`,
          mood: 'cast',
        },
      ];
    }
    return [
      {
        who: 'bilbo',
        text: pick([
          'It runs! Splendid.',
          'Look at that output!',
          'Smashing! Now try changing something.',
        ]),
      },
    ];
  }
  const r = outcome.result;
  if (r.passed && r.lessonCompleted) {
    return [
      { who: 'bilbo', text: 'Lesson complete! Time for second breakfast!' },
      { who: 'gandalf', text: 'Well done. Onward to the next adventure!', mood: 'cast' },
    ];
  }
  if (r.passed) return [{ who: 'bilbo', text: 'Every test passes! Hooray!' }];
  if (r.tests.some((t) => t.status === 'error')) {
    return [
      {
        who: 'gandalf',
        text: 'Your code raised an error. The terminal tells the tale.',
        mood: 'cast',
      },
    ];
  }
  return [
    {
      who: 'gandalf',
      text: `${r.passedCount}/${r.totalCount} passing. Compare your output with the expected line.`,
      mood: 'cast',
    },
  ];
}

/** Bilbo and Gandalf on the terminal bar, reacting to runs and submissions. */
export function Companions({ language }: { language: Language }) {
  const [speech, setSpeech] = useState<SayEvent | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const offOutcome = onOutcome((outcome) => {
      react(outcome, language).forEach((line, i) =>
        timers.push(setTimeout(() => say(line), i * 1800)),
      );
    });
    const offSay = onSay((line) => {
      clearTimeout(hide.current);
      setSpeech(line);
      hide.current = setTimeout(() => setSpeech(null), Math.max(3500, line.text.length * 70));
    });
    return () => {
      offOutcome();
      offSay();
      timers.forEach(clearTimeout);
      clearTimeout(hide.current);
    };
  }, [language]);

  return (
    <div className="relative flex items-end gap-1">
      {speech && (
        <div
          role="status"
          key={speech.text}
          className="pop-in pointer-events-none absolute top-1/2 right-full z-30 mr-3 w-max max-w-[min(26rem,60vw)] -translate-y-1/2 rounded-lg border-3 border-ink bg-[#fffbea] px-3 py-2 text-sm leading-snug font-bold text-[#1a1405] shadow-[0_3px_0_0_rgba(0,0,0,0.35)]"
        >
          <span className={speech.who === 'bilbo' ? 'text-[#4f8a3c]' : 'text-[#5d6573]'}>
            {speech.who === 'bilbo' ? 'Bilbo' : 'Gandalf'}:
          </span>{' '}
          {speech.text}
          <span
            aria-hidden
            className="absolute top-1/2 left-full -mt-1.5 -ml-1.5 size-3 rotate-45 border-t-3 border-r-3 border-ink bg-[#fffbea]"
          />
        </div>
      )}
      <Character who="gandalf" height={76} bubble="none" />
      <Character who="bilbo" height={60} bubble="none" />
    </div>
  );
}
