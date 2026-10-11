import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Fragment } from 'react';
import { CourseProgress } from '@/components/CourseProgress';
import { LANGUAGE_NAMES } from '@/components/LanguageBadge';
import { ExerciseMarker } from '@/components/lesson/ExerciseMarker';
import { exerciseFileName } from '@/components/lesson/files';
import { Hint } from '@/components/lesson/Hint';
import { LessonFooter } from '@/components/lesson/LessonFooter';
import { Markdown } from '@/components/lesson/Markdown';
import { RunnableCell } from '@/components/lesson/RunnableCell';
import { Workspace } from '@/components/lesson/Workspace';
import { TopBar } from '@/components/TopBar';
import { api, orNotFound, type ExerciseBlock } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lesson = await orNotFound(api.lesson((await params).id));
  return { title: lesson ? `${lesson.title} · ${lesson.course.title}` : 'Lesson not found' };
}

function Band({ children }: { children: React.ReactNode }) {
  return <h2 className="bg-band px-6 py-5 text-xl font-bold sm:px-8">{children}</h2>;
}

export default async function LessonPage({ params }: Props) {
  const lesson = await orNotFound(api.lesson((await params).id));
  if (!lesson) notFound();
  const course = await api.course(lesson.course.slug);

  const exercises = lesson.blocks.filter((b): b is ExerciseBlock => b.type === 'exercise');
  const firstRunnable = lesson.blocks.find((b) => b.type === 'runnable');
  const scratch =
    firstRunnable?.type === 'runnable'
      ? firstRunnable.code
      : lesson.course.language === 'python'
        ? '# Try anything here\n'
        : '// Try anything here\n';
  const courseHref = `/courses/${course.slug}`;
  const nextHref = lesson.nextLessonId ? `/lessons/${lesson.nextLessonId}` : null;
  const hints = exercises.filter((e) => e.hint);

  return (
    <div className="flex flex-col lg:h-dvh">
      <TopBar
        crumbs={[
          { label: LANGUAGE_NAMES[lesson.course.language], href: courseHref },
          { label: lesson.title },
        ]}
      >
        <CourseProgress lessonIds={course.lessons.map((l) => l.id)} courseTitle={course.title} />
      </TopBar>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Instructions */}
        <section
          className="min-h-0 overflow-y-auto border-line lg:border-r-4"
          aria-label="Instructions"
        >
          <div className="h-8 lg:h-9" aria-hidden />
          <Band>Instructions</Band>
          <article className="prose-shire px-6 py-8 sm:px-8">
            <p className="font-pixel text-sm text-muted">
              Lesson {lesson.position} of {lesson.lessonCount}
            </p>
            <h1 className="!mt-2 text-3xl font-extrabold">{lesson.title}</h1>
            {lesson.blocks.map((block, i) => (
              <Fragment key={block.type === 'markdown' ? `md-${i}` : block.id}>
                {block.type === 'markdown' && <Markdown>{block.markdown}</Markdown>}
                {block.type === 'runnable' && (
                  <RunnableCell code={block.code} language={block.language} />
                )}
                {block.type === 'exercise' && (
                  <ExerciseMarker
                    exercise={block}
                    fileName={exerciseFileName(block, exercises.indexOf(block), exercises.length)}
                  />
                )}
              </Fragment>
            ))}
          </article>

          {hints.length > 0 && (
            <>
              <Band>Help</Band>
              <div className="flex flex-col gap-4 px-6 py-8 sm:px-8">
                {hints.map((e, i) => (
                  <Hint
                    key={e.id}
                    markdown={e.hint!}
                    label={hints.length > 1 ? `Hint ${i + 1}` : 'Hint'}
                  />
                ))}
              </div>
            </>
          )}

          <LessonFooter
            lessonId={lesson.id}
            hasExercises={exercises.length > 0}
            prevHref={lesson.prevLessonId ? `/lessons/${lesson.prevLessonId}` : null}
            nextHref={nextHref}
            courseHref={courseHref}
          />
        </section>

        {/* Editor + terminal */}
        <section
          className="min-h-0 max-lg:border-t-4 max-lg:border-line lg:h-full"
          aria-label="Code workspace"
        >
          <Workspace
            key={lesson.id}
            lessonId={lesson.id}
            language={lesson.course.language}
            exercises={exercises}
            scratchCode={scratch}
            nextHref={nextHref}
          />
        </section>
      </div>
    </div>
  );
}
