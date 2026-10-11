import Link from 'next/link';
import type { CourseDetail } from '@/lib/api';
import { CourseCta } from './CourseCta';
import { CourseProgress } from './CourseProgress';
import { LanguageBadge } from './LanguageBadge';
import { PixelHills } from './PixelHills';

export const COURSE_ART: Record<CourseDetail['language'], Parameters<typeof PixelHills>[0]> = {
  python: { sky: ['#1b2f6b', '#28418a'], hills: ['#2f7d4a', '#3fae5a'], seed: 1 },
  javascript: { sky: ['#4a2a6b', '#6a3a8a'], hills: ['#a58a1f', '#d9b52a'], seed: 3 },
};

export function CourseCard({ course }: { course: CourseDetail }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border-3 border-line bg-raised transition-colors hover:border-[#4a5570]">
      <Link href={`/courses/${course.slug}`} className="relative block" tabIndex={-1} aria-hidden>
        <PixelHills {...COURSE_ART[course.language]} className="block h-36 w-full" />
        <span className="absolute bottom-3 left-4">
          <LanguageBadge language={course.language} />
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h2 className="font-pixel text-xl leading-tight">
            <Link href={`/courses/${course.slug}`} className="hover:text-yellow">
              {course.title}
            </Link>
          </h2>
          <p className="mt-2 text-muted">{course.description}</p>
        </div>
        <p className="text-sm text-muted">
          {course.lessonCount} lessons · {course.exerciseCount} exercises
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-32 flex-1">
            <CourseProgress
              lessonIds={course.lessons.map((l) => l.id)}
              courseTitle={course.title}
              size="sm"
            />
          </div>
          <CourseCta course={course} />
        </div>
      </div>
    </article>
  );
}
