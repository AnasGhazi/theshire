'use client';

import { useRef, useState } from 'react';
import type { CourseDetail } from '@/lib/api';
import { recallLesson } from '@/lib/last-lesson';
import { sfx } from '@/lib/sound';
import { DOOR_AJAR_ROWS, DOOR_OPEN_ROWS, DOOR_PALETTE, DOOR_ROWS, PixelArt } from '../PixelArt';
import { useProgress } from '../ProgressProvider';
import { whirlTo } from '../WhirlTransition';
import { say } from './Character';

type DoorState = 'closed' | 'ajar' | 'open';
const FRAMES: Record<DoorState, string[]> = {
  closed: DOOR_ROWS,
  ajar: DOOR_AJAR_ROWS,
  open: DOOR_OPEN_ROWS,
};

/**
 * The round door: opens, then whirls the learner back to the lesson they last visited (or their
 * next unfinished one).
 */
export function MagicDoor({
  courses,
  className = '',
}: {
  courses: CourseDetail[];
  className?: string;
}) {
  const { isLessonComplete } = useProgress();
  const [state, setState] = useState<DoorState>('closed');
  const button = useRef<HTMLButtonElement>(null);

  const destination = () => {
    const lessons = courses.flatMap((c) => c.lessons);
    const remembered = recallLesson();
    if (remembered && lessons.some((l) => l.id === remembered.id)) return remembered;
    const next = lessons.find((l) => !isLessonComplete(l.id)) ?? lessons[0];
    return next ? { id: next.id, title: next.title } : null;
  };

  const open = () => {
    const lesson = destination();
    if (!lesson || state !== 'closed') return;
    sfx.door();
    say({ who: 'bilbo', text: `Off we go: back to “${lesson.title}”!` });
    setState('ajar');
    setTimeout(() => setState('open'), 220);
    setTimeout(() => {
      const box = button.current?.getBoundingClientRect();
      whirlTo({
        href: `/lessons/${lesson.id}`,
        x: box ? box.left + box.width / 2 : window.innerWidth / 2,
        y: box ? box.top + box.height * 0.6 : window.innerHeight / 2,
      });
    }, 650);
    setTimeout(() => setState('closed'), 2000);
  };

  return (
    <button
      ref={button}
      type="button"
      onClick={open}
      aria-label="Open the door: continue your last lesson"
      title="Continue your adventure"
      className={`magic-door cursor-pointer rounded-md focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-yellow ${className}`}
    >
      <PixelArt
        rows={FRAMES[state]}
        palette={DOOR_PALETTE}
        className="block size-full transition-[filter]"
      />
    </button>
  );
}
