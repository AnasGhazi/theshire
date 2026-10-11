import { CourseCard } from '@/components/CourseCard';
import { HomeScene } from '@/components/characters/HomeScene';
import { HomeMusic } from '@/components/HomeMusic';
import { TopBar } from '@/components/TopBar';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const summaries = await api.courses();
  const courses = await Promise.all(summaries.map((c) => api.course(c.slug)));

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <section className="flex flex-col items-start gap-10 py-14 sm:py-20 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="font-pixel text-sm text-lime">Start your coding adventure</p>
            <h1 className="mt-4 font-pixel text-4xl leading-[1.15] sm:text-5xl">
              Learn to code. <span className="text-yellow">Second breakfast optional.</span>
            </h1>
            <p className="mt-5 text-xl text-muted">
              Short lessons, real code. Every example runs in your browser, and every exercise is
              checked the moment you submit.
            </p>
            <div className="mt-6">
              <HomeMusic />
            </div>
          </div>
          <HomeScene />
        </section>

        <h2 className="mb-6 font-pixel text-lg text-muted">Courses</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {courses.map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
        </div>
      </main>
    </>
  );
}
