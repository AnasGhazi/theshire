import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CourseDetail, CourseList, ErrorResponse, Lesson } from '@theshire/shared';
import { buildApp, type App } from '../app';
import { loadConfig } from '../config';
import { loadContent } from '../content/load-content';

let app: App;
beforeAll(async () => {
  app = await buildApp({
    probeDocker: async () => ({ available: true }),
    runner: { run: () => Promise.reject(new Error('not used')) },
    content: await loadContent(loadConfig({}).coursesDir),
  });
});
afterAll(() => app.close());

const get = (url: string) => app.inject({ method: 'GET', url });

describe('content routes', () => {
  it('GET /api/courses lists courses in order', async () => {
    const res = await get('/api/courses');
    expect(res.statusCode).toBe(200);
    const { courses } = CourseList.parse(res.json());
    expect(courses.map((c) => c.slug)).toEqual(['python-basics', 'javascript-basics']);
    expect(courses[0]).toMatchObject({ language: 'python', lessonCount: 4, exerciseCount: 4 });
  });

  it('GET /api/courses/:slug returns ordered lessons', async () => {
    const res = await get('/api/courses/python-basics');
    expect(res.statusCode).toBe(200);
    const course = CourseDetail.parse(res.json());
    expect(course.lessons.map((l) => l.order)).toEqual([1, 2, 3, 4]);
    expect(course.lessons[2]).toMatchObject({
      id: 'python-basics-03',
      title: 'Loops',
      exerciseIds: ['python-basics-03.sum-to-n'],
    });
  });

  it('GET /api/lessons/:id returns structured blocks and navigation', async () => {
    const res = await get('/api/lessons/python-basics-03');
    expect(res.statusCode).toBe(200);
    const lesson = Lesson.parse(res.json());
    expect(lesson).toMatchObject({
      position: 3,
      lessonCount: 4,
      prevLessonId: 'python-basics-02',
      nextLessonId: 'python-basics-04',
      course: { slug: 'python-basics', title: 'Python Basics', language: 'python' },
    });
    expect(lesson.blocks.some((b) => b.type === 'runnable')).toBe(true);
    expect(lesson.blocks.some((b) => b.type === 'markdown')).toBe(true);
  });

  it('never exposes hidden test data or solutions', async () => {
    const res = await get('/api/lessons/python-basics-03');
    const exercise = Lesson.parse(res.json()).blocks.find((b) => b.type === 'exercise');
    expect(exercise?.tests).toEqual([
      { id: 't1', hidden: false, call: 'print(sum_to(3))', expect: '6' },
      { id: 't2', hidden: false, call: 'print(sum_to(10))', expect: '55' },
      { id: 't3', hidden: true },
      { id: 't4', hidden: true },
    ]);
    expect(res.body).not.toContain('5050');
    expect(res.body).not.toContain('total += i'); // from the reference solution
    expect(res.body).not.toContain('solution');
  });

  it.each([
    ['/api/courses/nope', 'COURSE_NOT_FOUND'],
    ['/api/lessons/nope', 'LESSON_NOT_FOUND'],
  ])('%s returns 404 %s', async (url, code) => {
    const res = await get(url);
    expect(res.statusCode).toBe(404);
    expect(ErrorResponse.parse(res.json()).error.code).toBe(code);
  });
});
