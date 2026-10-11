import type { ExerciseBlock, Language, MarkdownBlock, RunnableBlock } from '@theshire/shared';

/** A test case with everything the grader needs, including hidden expectations. */
export interface ExerciseTest {
  id: string;
  /** Code appended after the learner's code; may be empty when the program itself is graded. */
  call: string;
  expect: string;
  hidden: boolean;
}

/** Server-side exercise: carries hidden test data and the reference solution. */
export interface Exercise extends Omit<ExerciseBlock, 'type' | 'tests'> {
  lessonId: string;
  tests: ExerciseTest[];
  solution: string | null;
}

export type InternalBlock =
  MarkdownBlock | RunnableBlock | { type: 'exercise'; exercise: Exercise };

export interface ParsedLesson {
  id: string;
  title: string;
  order: number;
  blocks: InternalBlock[];
  exercises: Exercise[];
}

export interface Course {
  slug: string;
  title: string;
  description: string;
  language: Language;
  order: number;
  /** Sorted by `order`. */
  lessons: ParsedLesson[];
}
