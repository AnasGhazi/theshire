import { z } from 'zod';
import { Language } from './run';

export const CourseSummary = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  language: Language,
  lessonCount: z.number().int().nonnegative(),
  exerciseCount: z.number().int().nonnegative(),
});
export type CourseSummary = z.infer<typeof CourseSummary>;

export const CourseList = z.object({ courses: z.array(CourseSummary) });
export type CourseList = z.infer<typeof CourseList>;

export const LessonSummary = z.object({
  id: z.string(),
  title: z.string(),
  order: z.number().int(),
  exerciseIds: z.array(z.string()),
});
export type LessonSummary = z.infer<typeof LessonSummary>;

export const CourseDetail = CourseSummary.extend({
  lessons: z.array(LessonSummary),
});
export type CourseDetail = z.infer<typeof CourseDetail>;

/** A test case as learners see it. Hidden tests reveal neither their call nor expected output. */
export const PublicExerciseTest = z.discriminatedUnion('hidden', [
  z.object({ id: z.string(), hidden: z.literal(false), call: z.string(), expect: z.string() }),
  z.object({ id: z.string(), hidden: z.literal(true) }),
]);
export type PublicExerciseTest = z.infer<typeof PublicExerciseTest>;

export const MarkdownBlock = z.object({
  type: z.literal('markdown'),
  markdown: z.string(),
});

export const RunnableBlock = z.object({
  type: z.literal('runnable'),
  id: z.string(),
  language: Language,
  code: z.string(),
});

export const ExerciseBlock = z.object({
  type: z.literal('exercise'),
  id: z.string(),
  language: Language,
  starterCode: z.string(),
  /** Markdown, shown on request. */
  hint: z.string().nullable(),
  tests: z.array(PublicExerciseTest),
});

export const LessonBlock = z.discriminatedUnion('type', [
  MarkdownBlock,
  RunnableBlock,
  ExerciseBlock,
]);
export type MarkdownBlock = z.infer<typeof MarkdownBlock>;
export type RunnableBlock = z.infer<typeof RunnableBlock>;
export type ExerciseBlock = z.infer<typeof ExerciseBlock>;
export type LessonBlock = z.infer<typeof LessonBlock>;

export const Lesson = z.object({
  id: z.string(),
  title: z.string(),
  order: z.number().int(),
  course: z.object({ slug: z.string(), title: z.string(), language: Language }),
  /** 1-based position within the course, and the course's lesson count. */
  position: z.number().int().positive(),
  lessonCount: z.number().int().positive(),
  prevLessonId: z.string().nullable(),
  nextLessonId: z.string().nullable(),
  blocks: z.array(LessonBlock),
});
export type Lesson = z.infer<typeof Lesson>;
