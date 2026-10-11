'use client';

import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { LessonSummary } from '@/lib/api';
import { useProgress } from './ProgressProvider';

/** The course as a path of numbered checkpoints, like levels on a map. */
export function LessonPath({ lessons }: { lessons: LessonSummary[] }) {
  const { isLessonComplete, isExercisePassed } = useProgress();
  const nextId = lessons.find((l) => !isLessonComplete(l.id))?.id;

  return (
    <ol className="relative flex flex-col gap-4 before:absolute before:top-6 before:bottom-6 before:left-[1.65rem] before:w-1 before:bg-line">
      {lessons.map((lesson, i) => {
        const done = isLessonComplete(lesson.id);
        const isNext = lesson.id === nextId;
        const passed = lesson.exerciseIds.filter(isExercisePassed).length;
        return (
          <li key={lesson.id} className="relative">
            <Link
              href={`/lessons/${lesson.id}`}
              className={`flex items-center gap-5 rounded-xl border-3 p-3 pr-5 transition-colors ${
                isNext
                  ? 'border-yellow bg-raised'
                  : 'border-line bg-raised/60 hover:border-[#4a5570]'
              }`}
            >
              <span
                className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-lg border-3 font-pixel ${
                  done
                    ? 'border-[#b5f26a] bg-[#3f8a22] text-white'
                    : isNext
                      ? 'border-[#fff1a8] bg-yellow text-[#1a1405]'
                      : 'border-line bg-panel text-muted'
                }`}
              >
                {done ? <Check className="size-5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-bold">{lesson.title}</span>
                <span className="text-sm text-muted">
                  {lesson.exerciseIds.length > 0
                    ? `${passed}/${lesson.exerciseIds.length} exercise${lesson.exerciseIds.length > 1 ? 's' : ''}`
                    : 'Reading'}
                </span>
              </span>
              {done ? (
                <span className="font-pixel text-xs text-lime">Done</span>
              ) : isNext ? (
                <span className="font-pixel text-xs text-yellow">Up next</span>
              ) : (
                <ChevronRight className="size-5 text-muted" aria-hidden />
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
