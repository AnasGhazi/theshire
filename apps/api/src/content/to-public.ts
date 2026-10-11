import type {
  CourseDetail,
  CourseSummary,
  ExerciseBlock,
  Lesson,
  LessonBlock,
  PublicExerciseTest,
} from '@theshire/shared';
import type { LessonEntry } from './load-content';
import type { Course, Exercise, ExerciseTest, InternalBlock } from './types';

/** The single place server-side content becomes client-visible: hidden data stops here. */

export function toCourseSummary(course: Course): CourseSummary {
  return {
    slug: course.slug,
    title: course.title,
    description: course.description,
    language: course.language,
    lessonCount: course.lessons.length,
    exerciseCount: course.lessons.reduce((n, l) => n + l.exercises.length, 0),
  };
}

export function toCourseDetail(course: Course): CourseDetail {
  return {
    ...toCourseSummary(course),
    lessons: course.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      order: l.order,
      exerciseIds: l.exercises.map((e) => e.id),
    })),
  };
}

export function toPublicTest(test: ExerciseTest): PublicExerciseTest {
  return test.hidden
    ? { id: test.id, hidden: true }
    : { id: test.id, hidden: false, call: test.call, expect: test.expect };
}

export function toPublicExercise(exercise: Exercise): ExerciseBlock {
  return {
    type: 'exercise',
    id: exercise.id,
    language: exercise.language,
    starterCode: exercise.starterCode,
    hint: exercise.hint,
    tests: exercise.tests.map(toPublicTest),
  };
}

function toPublicBlock(block: InternalBlock): LessonBlock {
  return block.type === 'exercise' ? toPublicExercise(block.exercise) : block;
}

export function toPublicLesson({ lesson, course, index }: LessonEntry): Lesson {
  return {
    id: lesson.id,
    title: lesson.title,
    order: lesson.order,
    course: { slug: course.slug, title: course.title, language: course.language },
    position: index + 1,
    lessonCount: course.lessons.length,
    prevLessonId: course.lessons[index - 1]?.id ?? null,
    nextLessonId: course.lessons[index + 1]?.id ?? null,
    blocks: lesson.blocks.map(toPublicBlock),
  };
}
