import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Progress, SubmitResult, type RunResult } from '@theshire/shared';
import { buildApp, type App } from '../app';
import { ContentIndex } from '../content/load-content';
import { parseLesson } from '../content/parse-lesson';
import type { Runner } from '../sandbox/types';
import { cookieFrom, testApp } from '../test-utils';

const LESSON = `---
id: l1
title: Doubles
order: 1
---
\`\`\`python exercise id=double
def double(n):
    pass
\`\`\`

\`\`\`tests
- call: print(double(2))
  expect: "4"
- call: print(double(5))
  expect: "10"
  hidden: true
\`\`\`
`;

const content = new ContentIndex([
  {
    slug: 'c',
    title: 'C',
    description: 'D',
    language: 'python',
    order: 1,
    lessons: [parseLesson(LESSON, 'l1.md')],
  },
]);

/** Pretends to run Python: "correct" code doubles the argument, anything else prints 0. */
const fakeRunner: Runner = {
  run: async ({ code }) => {
    const arg = Number(/double\((\d+)\)\)\s*$/.exec(code)?.[1]);
    const stdout = code.includes('return n * 2') ? `${arg * 2}\n` : '0\n';
    return {
      stdout,
      stderr: '',
      exitCode: 0,
      timedOut: false,
      oomKilled: false,
      truncated: false,
      durationMs: 5,
    } satisfies RunResult;
  },
};

let app: App;
let cookie: string;
beforeEach(async () => {
  app = await buildApp(testApp({ content, runner: fakeRunner }));
  cookie = cookieFrom(
    (await app.inject({ method: 'GET', url: '/api/progress' })).headers['set-cookie'],
  );
});
afterEach(() => app.close());

const submit = (code: string, id = 'l1.double') =>
  app.inject({
    method: 'POST',
    url: `/api/exercises/${id}/submit`,
    headers: { cookie },
    payload: { code },
  });
const progress = async () =>
  Progress.parse(
    (await app.inject({ method: 'GET', url: '/api/progress', headers: { cookie } })).json(),
  );
const complete = () => app.inject({ method: 'PUT', url: '/api/progress/l1', headers: { cookie } });

describe('POST /api/exercises/:id/submit', () => {
  it('grades a wrong answer without leaking hidden test details', async () => {
    const res = await submit('def double(n):\n    return 0');
    expect(res.statusCode).toBe(200);
    const result = SubmitResult.parse(res.json());

    expect(result).toMatchObject({
      passed: false,
      passedCount: 0,
      totalCount: 2,
      lessonCompleted: false,
    });
    expect(result.tests[0]).toMatchObject({
      hidden: false,
      status: 'wrong_output',
      expect: '4',
      stdout: '0\n',
    });
    expect(result.tests[1]).toEqual({
      id: 't2',
      hidden: true,
      status: 'wrong_output',
      passed: false,
    });
    expect(res.body).not.toContain('double(5)');
    expect(res.body).not.toContain('"10"');

    expect((await progress()).exercises).toEqual([
      { exerciseId: 'l1.double', attempts: 1, passedAt: null },
    ]);
  });

  it('records a pass and completes the lesson once every exercise passes', async () => {
    await submit('def double(n):\n    return 0');
    const result = SubmitResult.parse((await submit('def double(n):\n    return n * 2')).json());

    expect(result).toMatchObject({ passed: true, passedCount: 2, lessonCompleted: true });
    const p = await progress();
    expect(p.exercises[0]).toMatchObject({ attempts: 2, passedAt: expect.any(String) });
    expect(p.completedLessons.map((l) => l.lessonId)).toEqual(['l1']);
  });

  it('returns 404 for an unknown exercise', async () => {
    const res = await submit('x', 'nope');
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('EXERCISE_NOT_FOUND');
  });

  it('rejects a missing code field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/exercises/l1.double/submit',
      headers: { cookie },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('PUT /api/progress/:lessonId', () => {
  it('refuses to complete a lesson whose exercises have not passed', async () => {
    const res = await complete();
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('EXERCISES_INCOMPLETE');
  });

  it('completes the lesson once its exercises pass, idempotently', async () => {
    await submit('def double(n):\n    return n * 2');
    const first = Progress.parse((await complete()).json());
    const second = Progress.parse((await complete()).json());
    expect(second.completedLessons).toEqual(first.completedLessons);
    expect(second.completedLessons).toHaveLength(1);
  });

  it('returns 404 for an unknown lesson', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/progress/nope', headers: { cookie } });
    expect(res.statusCode).toBe(404);
  });
});
