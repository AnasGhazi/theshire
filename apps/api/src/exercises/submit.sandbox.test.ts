/**
 * End-to-end grading against the real Docker sandbox (npm run test:sandbox).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Lesson, Progress, SubmitResult, type ExerciseBlock } from '@theshire/shared';
import { buildApp, type App } from '../app';
import { loadConfig } from '../config';
import { loadContent, type ContentIndex } from '../content/load-content';
import { DockerRunner } from '../sandbox/docker-runner';
import { ConcurrencyLimiter, limitRunner } from '../sandbox/limiter';
import { cookieFrom, testApp } from '../test-utils';
import { gradeSubmission } from './grade';

const config = loadConfig({});
const runner = limitRunner(new DockerRunner(config.sandbox), new ConcurrencyLimiter(4, 100));
let content: ContentIndex;

beforeAll(async () => {
  content = await loadContent(config.coursesDir);
});

describe('course content', () => {
  it('every reference solution passes and every starter template fails', async () => {
    const exercises = content.courses.flatMap((c) => c.lessons.flatMap((l) => l.exercises));
    const outcomes = await Promise.all(
      exercises.map(async (exercise) => ({
        id: exercise.id,
        solution: (await gradeSubmission(exercise, exercise.solution ?? '', runner)).passed,
        starter: (await gradeSubmission(exercise, exercise.starterCode, runner)).passed,
      })),
    );
    expect(outcomes).toEqual(exercises.map((e) => ({ id: e.id, solution: true, starter: false })));
  });
});

describe('learner flow: lesson -> wrong answer -> right answer -> progress', () => {
  let app: App;
  let cookie: string;

  beforeAll(async () => {
    app = await buildApp(testApp({ content, runner }));
  });
  afterAll(() => app.close());

  it('completes the Loops lesson', async () => {
    // 1. Open the lesson (this also issues the learner cookie).
    const lessonRes = await app.inject({ method: 'GET', url: '/api/lessons/python-basics-03' });
    expect(lessonRes.statusCode).toBe(200);
    cookie = cookieFrom(lessonRes.headers['set-cookie']);
    const lesson = Lesson.parse(lessonRes.json());
    const exercise = lesson.blocks.find((b): b is ExerciseBlock => b.type === 'exercise');
    expect(exercise?.id).toBe('python-basics-03.sum-to-n');

    const submit = async (code: string) => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/exercises/${exercise!.id}/submit`,
        headers: { cookie },
        payload: { code },
      });
      expect(res.statusCode).toBe(200);
      return SubmitResult.parse(res.json());
    };

    // 2. An off-by-one answer fails, with useful feedback on visible tests only.
    const wrong = await submit('def sum_to(n):\n    return sum(range(n))');
    expect(wrong.passed).toBe(false);
    expect(wrong.tests[0]).toMatchObject({
      hidden: false,
      status: 'wrong_output',
      stdout: '3\n',
      expect: '6',
    });
    expect(wrong.tests.filter((t) => t.hidden)).toEqual([
      { id: 't3', hidden: true, status: 'wrong_output', passed: false },
      { id: 't4', hidden: true, status: 'wrong_output', passed: false },
    ]);

    // 3. A crashing answer reports the error.
    const crash = await submit('def sum_to(n):\n    return 1 / 0');
    expect(crash.tests[0]).toMatchObject({
      status: 'error',
      stderr: expect.stringContaining('ZeroDivisionError'),
    });

    // 4. A correct answer passes every test and completes the lesson.
    const right = await submit('def sum_to(n):\n    return n * (n + 1) // 2');
    expect(right).toMatchObject({
      passed: true,
      passedCount: 4,
      totalCount: 4,
      lessonCompleted: true,
    });

    // 5. Progress shows the lesson complete and three attempts.
    const progress = Progress.parse(
      (await app.inject({ method: 'GET', url: '/api/progress', headers: { cookie } })).json(),
    );
    expect(progress.completedLessons.map((l) => l.lessonId)).toEqual(['python-basics-03']);
    expect(progress.exercises).toEqual([
      { exerciseId: 'python-basics-03.sum-to-n', attempts: 3, passedAt: expect.any(String) },
    ]);
  });
});
