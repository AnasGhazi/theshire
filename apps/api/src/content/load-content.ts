import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { z } from 'zod';
import { Language } from '@theshire/shared';
import { ContentError } from './content-error';
import { parseLesson } from './parse-lesson';
import type { Course, Exercise, ParsedLesson } from './types';

const CourseMeta = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(1),
  language: Language,
  order: z.number().int().default(100),
});

export interface LessonEntry {
  lesson: ParsedLesson;
  course: Course;
  /** 0-based index within the course. */
  index: number;
}

export interface ExerciseEntry extends LessonEntry {
  exercise: Exercise;
}

/** All course content, validated and indexed once at startup. */
export class ContentIndex {
  private readonly bySlug: Map<string, Course>;
  private readonly lessons = new Map<string, LessonEntry>();
  private readonly exercises = new Map<string, ExerciseEntry>();

  /** Sorted by course `order`, then title. */
  readonly courses: readonly Course[];

  constructor(courses: Course[]) {
    this.courses = [...courses].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    this.bySlug = new Map(courses.map((c) => [c.slug, c]));
    for (const course of courses) {
      course.lessons.forEach((lesson, index) => {
        const entry = { lesson, course, index };
        this.lessons.set(lesson.id, entry);
        for (const exercise of lesson.exercises)
          this.exercises.set(exercise.id, { ...entry, exercise });
      });
    }
  }

  getCourse(slug: string): Course | undefined {
    return this.bySlug.get(slug);
  }

  getLesson(id: string): LessonEntry | undefined {
    return this.lessons.get(id);
  }

  getExercise(id: string): ExerciseEntry | undefined {
    return this.exercises.get(id);
  }
}

/**
 * Loads every course under `coursesDir` (one folder per course with a course.json and *.md
 * lessons). Collects every problem across all files and throws them together, so broken content
 * stops the server at startup instead of failing a learner's request.
 */
export async function loadContent(coursesDir: string): Promise<ContentIndex> {
  const errors: string[] = [];
  const courses: Course[] = [];
  const lessonFiles = new Map<string, string>();
  const rel = (path: string) => relative(process.cwd(), path);

  const dirs = (await readdir(coursesDir, { withFileTypes: true })).filter((d) => d.isDirectory());
  for (const dir of dirs) {
    const courseDir = join(coursesDir, dir.name);
    const metaFile = join(courseDir, 'course.json');

    let meta: z.infer<typeof CourseMeta>;
    try {
      const parsed = CourseMeta.safeParse(JSON.parse(await readFile(metaFile, 'utf8')));
      if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
      meta = parsed.data;
    } catch (err) {
      errors.push(`${rel(metaFile)}: ${(err as Error).message}`);
      continue;
    }

    const lessons: ParsedLesson[] = [];
    const files = (await readdir(courseDir)).filter((f) => f.endsWith('.md')).sort();
    for (const name of files) {
      const file = join(courseDir, name);
      try {
        const lesson = parseLesson(await readFile(file, 'utf8'), rel(file));
        const clash = lessonFiles.get(lesson.id);
        if (clash)
          throw new ContentError(rel(file), 1, `lesson id "${lesson.id}" also used in ${clash}`);
        const sameOrder = lessons.find((l) => l.order === lesson.order);
        if (sameOrder) {
          throw new ContentError(
            rel(file),
            1,
            `order ${lesson.order} also used by "${sameOrder.id}"`,
          );
        }
        for (const ex of lesson.exercises) {
          if (ex.language !== meta.language) {
            throw new ContentError(
              rel(file),
              undefined,
              `exercise ${ex.id} must be ${meta.language}`,
            );
          }
        }
        lessonFiles.set(lesson.id, rel(file));
        lessons.push(lesson);
      } catch (err) {
        errors.push((err as Error).message);
      }
    }
    if (files.length === 0) errors.push(`${rel(courseDir)}: course has no lessons`);

    lessons.sort((a, b) => a.order - b.order);
    courses.push({ slug: dir.name, ...meta, lessons });
  }

  if (errors.length > 0) {
    throw new Error(`Invalid course content (${errors.length}):\n  ${errors.join('\n  ')}`);
  }
  return new ContentIndex(courses);
}
