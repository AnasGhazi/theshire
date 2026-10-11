'use client';

import { ProgressBar } from './ProgressBar';
import { useProgress } from './ProgressProvider';

/** Completed lessons out of the course's lessons, as a bar with a percentage. */
export function CourseProgress({
  lessonIds,
  courseTitle,
  size = 'md',
}: {
  lessonIds: string[];
  courseTitle: string;
  size?: 'sm' | 'md';
}) {
  const { progress, isLessonComplete } = useProgress();
  const done = lessonIds.filter(isLessonComplete).length;
  const value = lessonIds.length ? done / lessonIds.length : 0;

  return (
    <div className="flex items-center gap-3">
      <ProgressBar
        value={value}
        label={`${courseTitle} progress`}
        className={size === 'sm' ? 'w-full min-w-24' : 'w-40 sm:w-64 lg:w-72'}
      />
      <span
        className={`shrink-0 tabular-nums text-muted transition-opacity ${size === 'sm' ? 'text-sm' : 'text-lg'} ${progress ? '' : 'opacity-0'}`}
      >
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}
