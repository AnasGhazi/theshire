import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { ContentIndex } from './content/load-content';
import { parseLesson } from './content/parse-lesson';
import { testApp } from './test-utils';

const SECRET_CODE = 'print("do-not-log-me-7f3a")';

describe('logging', () => {
  it('logs run and submit outcomes with request ids, but never the code', async () => {
    const lines: Record<string, unknown>[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _enc, done) {
        lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
        done();
      },
    });
    const content = new ContentIndex([
      {
        slug: 'c',
        title: 'C',
        description: 'D',
        language: 'python',
        order: 1,
        lessons: [
          parseLesson(
            '---\nid: l\ntitle: L\norder: 1\n---\n```python exercise\nx\n```\n\n```tests\n- expect: "1"\n```',
            'l.md',
          ),
        ],
      },
    ]);
    const options = testApp({
      content,
      runner: {
        run: async () => ({
          stdout: '1\n',
          stderr: '',
          exitCode: 0,
          timedOut: false,
          oomKilled: false,
          truncated: false,
          durationMs: 42,
        }),
      },
    });
    const app = await buildApp({ ...options, logger: { level: 'info', stream } });

    await app.inject({
      method: 'POST',
      url: '/api/run',
      payload: { language: 'python', code: SECRET_CODE },
    });
    await app.inject({
      method: 'POST',
      url: '/api/exercises/l.ex1/submit',
      payload: { code: SECRET_CODE },
    });
    await app.close();

    expect(JSON.stringify(lines)).not.toContain('do-not-log-me');
    const run = lines.find((l) => l.msg === 'code run finished');
    expect(run).toMatchObject({
      language: 'python',
      exitCode: 0,
      durationMs: 42,
      codeBytes: SECRET_CODE.length,
    });
    expect(run?.requestId).toEqual(expect.any(String));
    expect(lines.find((l) => l.msg === 'submission graded')).toMatchObject({
      passed: true,
      passedCount: 1,
    });
  });
});
