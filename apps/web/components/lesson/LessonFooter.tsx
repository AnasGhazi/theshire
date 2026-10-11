'use client';

import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useProgress } from '../ProgressProvider';
import { errorMessage } from './useCodeRunner';

/** Completion state plus previous / next navigation at the end of the instructions. */
export function LessonFooter({
  lessonId,
  hasExercises,
  prevHref,
  nextHref,
  courseHref,
}: {
  lessonId: string;
  hasExercises: boolean;
  prevHref: string | null;
  nextHref: string | null;
  courseHref: string;
}) {
  const { isLessonComplete, setProgress } = useProgress();
  const [error, setError] = useState<string | null>(null);
  const done = isLessonComplete(lessonId);

  return (
    <div className="flex flex-col gap-5 border-t-2 border-line px-6 py-8 sm:px-8">
      {done ? (
        <p className="pop-in flex items-center gap-3 rounded-lg border-3 border-[#5f9d3a] bg-[#1d3a12]/60 px-4 py-3 font-pixel text-[#c9f78f]">
          <CircleCheck className="size-5" aria-hidden /> Lesson complete
        </p>
      ) : hasExercises ? (
        <p className="text-muted">Pass the exercise to complete this lesson.</p>
      ) : (
        <div>
          <button
            type="button"
            className="btn btn-yellow"
            onClick={() =>
              api
                .completeLesson(lessonId)
                .then(setProgress, (err: unknown) => setError(errorMessage(err)))
            }
          >
            Mark as complete
          </button>
          {error && <p className="mt-2 text-danger">{error}</p>}
        </div>
      )}
      <nav
        className="flex flex-wrap items-center justify-between gap-4"
        aria-label="Lesson navigation"
      >
        {prevHref ? (
          <Link href={prevHref} className="btn btn-ghost btn-sm">
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        <Link
          href={nextHref ?? courseHref}
          className={`btn btn-sm ${done ? 'btn-yellow' : 'btn-ghost'}`}
        >
          {nextHref ? 'Next lesson →' : 'Finish course →'}
        </Link>
      </nav>
    </div>
  );
}
