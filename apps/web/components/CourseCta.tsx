'use client';

import Link from 'next/link';
import type { CourseDetail } from '@/lib/api';
import { useProgress } from './ProgressProvider';

/** "Start", "Continue", or "Review" depending on how far the learner got. */
export function CourseCta({ course, size = 'sm' }: { course: CourseDetail; size?: 'sm' | 'md' }) {
  const { isLessonComplete } = useProgress();
  const next = course.lessons.find((l) => !isLessonComplete(l.id));
  const started = course.lessons.some((l) => isLessonComplete(l.id));
  const target = next ?? course.lessons[0];
  if (!target) return null;

  const label = !next ? 'Review' : started ? 'Continue' : 'Start';
  return (
    <Link
      href={`/lessons/${target.id}`}
      className={`btn btn-yellow ${size === 'sm' ? 'btn-sm' : ''}`}
    >
      {label} →
    </Link>
  );
}
