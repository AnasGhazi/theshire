'use client';

import { useEffect } from 'react';
import type { CourseDetail } from '@/lib/api';
import { Character, say } from './Character';
import { MagicDoor } from './MagicDoor';

/** The hero scene: Bilbo and Gandalf by the round door, both clickable. */
export function HomeScene({ courses }: { courses: CourseDetail[] }) {
  useEffect(() => {
    const t = setTimeout(
      () =>
        say({
          who: 'bilbo',
          text: 'Welcome to the Shire! Knock on the door to continue your adventure.',
        }),
      1200,
    );
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="relative mx-auto h-56 w-80 shrink-0 select-none sm:w-96"
      aria-label="Bilbo and Gandalf by a round green door"
    >
      {/* hill and ground */}
      <div className="absolute inset-x-0 bottom-0 h-8 rounded-t-[50%] bg-[#2f7d4a]" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-3 bg-[#3fae5a]" aria-hidden />
      <MagicDoor
        courses={courses}
        className="absolute bottom-3 left-1/2 h-28 w-36 -translate-x-1/2"
      />
      <div className="absolute bottom-3 left-2 sm:left-4">
        <Character who="bilbo" height={84} align="start" />
      </div>
      <div className="absolute right-0 bottom-3 sm:right-2">
        <Character who="gandalf" height={124} align="end" />
      </div>
    </div>
  );
}
