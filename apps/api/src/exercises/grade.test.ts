import { describe, expect, it, vi } from 'vitest';
import type { RunResult } from '@theshire/shared';
import type { Exercise } from '../content/types';
import type { Runner } from '../sandbox/types';
import { buildTestProgram, gradeSubmission, normalizeOutput, statusOf } from './grade';

const run = (overrides: Partial<RunResult> = {}): RunResult => ({
  stdout: '',
  stderr: '',
  exitCode: 0,
  timedOut: false,
  oomKilled: false,
  truncated: false,
  durationMs: 10,
  ...overrides,
});

describe('normalizeOutput', () => {
  it('ignores trailing whitespace and line endings but not leading space or inner text', () => {
    expect(normalizeOutput('a  \r\nb\n\n\n')).toBe('a\nb');
    expect(normalizeOutput('  a')).toBe('  a');
    expect(normalizeOutput('a b')).not.toBe(normalizeOutput('ab'));
  });
});

describe('buildTestProgram', () => {
  it('appends the call on its own line after the learner code', () => {
    expect(
      buildTestProgram('def f():\n    return 1', {
        id: 't1',
        call: 'print(f())',
        expect: '1',
        hidden: false,
      }),
    ).toBe('def f():\n    return 1\n\nprint(f())\n');
  });

  it('grades the program itself when there is no call', () => {
    expect(
      buildTestProgram('print("hi")', { id: 't1', call: '', expect: 'hi', hidden: false }),
    ).toBe('print("hi")');
  });
});

describe('statusOf', () => {
  it.each([
    [run({ stdout: '6\n' }), 'passed'],
    [run({ stdout: '7\n' }), 'wrong_output'],
    [run({ stdout: '6\n', exitCode: 1 }), 'error'],
    [run({ exitCode: null, timedOut: true }), 'timeout'],
    [run({ exitCode: 137, oomKilled: true }), 'memory_limit'],
    [run({ exitCode: null, truncated: true, stdout: '6' }), 'output_limit'],
  ] as const)('%o -> %s', (result, status) => {
    expect(statusOf(result, '6')).toBe(status);
  });
});

describe('gradeSubmission', () => {
  const exercise: Exercise = {
    id: 'l.ex1',
    lessonId: 'l',
    language: 'python',
    starterCode: '',
    hint: null,
    solution: null,
    tests: [
      { id: 't1', call: 'print(f(1))', expect: '1', hidden: false },
      { id: 't2', call: 'print(f(2))', expect: '2', hidden: true },
    ],
  };

  it('runs each test separately and reports per-test results', async () => {
    const runner: Runner = {
      run: vi.fn(async ({ code }) => run({ stdout: code.includes('f(1)') ? '1\n' : '999\n' })),
    };

    const result = await gradeSubmission(exercise, 'def f(n): ...', runner);

    expect(runner.run).toHaveBeenCalledTimes(2);
    expect(runner.run).toHaveBeenCalledWith({
      language: 'python',
      code: 'def f(n): ...\n\nprint(f(1))\n',
    });
    expect(result).toEqual({
      exerciseId: 'l.ex1',
      passed: false,
      passedCount: 1,
      totalCount: 2,
      tests: [
        {
          id: 't1',
          hidden: false,
          status: 'passed',
          passed: true,
          call: 'print(f(1))',
          expect: '1',
          stdout: '1\n',
          stderr: '',
          durationMs: 10,
        },
        // Hidden: no call, expected value, or program output.
        { id: 't2', hidden: true, status: 'wrong_output', passed: false },
      ],
    });
  });

  it('passes only when every test passes', async () => {
    const runner: Runner = {
      run: async ({ code }) => run({ stdout: code.includes('f(1)') ? '1' : '2' }),
    };
    const result = await gradeSubmission(exercise, 'x', runner);
    expect(result).toMatchObject({ passed: true, passedCount: 2 });
  });
});
