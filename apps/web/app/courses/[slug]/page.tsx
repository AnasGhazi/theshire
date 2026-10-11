import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COURSE_ART } from '@/components/CourseCard';
import { CourseCta } from '@/components/CourseCta';
import { CourseProgress } from '@/components/CourseProgress';
import { LanguageBadge } from '@/components/LanguageBadge';
import { LessonPath } from '@/components/LessonPath';
import { PixelHills } from '@/components/PixelHills';
import { TopBar } from '@/components/TopBar';
import { api, orNotFound } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await orNotFound(api.course((await params).slug));
  return { title: course?.title ?? 'Course not found' };
}

export default async function CoursePage({ params }: Props) {
  const course = await orNotFound(api.course((await params).slug));
  if (!course) notFound();

  return (
    <>
      <TopBar crumbs={[{ label: 'Courses', href: '/' }, { label: course.title }]} />
      <div className="relative">
        <PixelHills
          {...COURSE_ART[course.language]}
          className="block h-40 w-full opacity-90 sm:h-52"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-page" />
      </div>
      <main className="relative mx-auto -mt-16 max-w-3xl px-4 pb-24 sm:px-6">
        <div className="flex items-end gap-4">
          <LanguageBadge language={course.language} size="lg" />
          <h1 className="font-pixel text-3xl leading-tight sm:text-4xl">{course.title}</h1>
        </div>
        <p className="mt-5 text-lg text-muted">{course.description}</p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-5">
          <CourseProgress lessonIds={course.lessons.map((l) => l.id)} courseTitle={course.title} />
          <CourseCta course={course} size="md" />
        </div>

        <h2 className="mt-14 mb-6 font-pixel text-lg text-muted">Lessons</h2>
        <LessonPath lessons={course.lessons} />

        <p className="mt-12 text-center text-muted">
          <Link href="/" className="text-link hover:underline">
            ← All courses
          </Link>
        </p>
      </main>
    </>
  );
}
