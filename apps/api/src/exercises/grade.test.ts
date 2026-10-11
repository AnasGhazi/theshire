import { describe, expect, it, vi } from 'vitest';
import type { RunResult } from '@theshire/shared';
import type { Exercise } from '../content/types';
import type { Runner } from '../sandbox/types';
import { buildTestProgram, gradeSubmission, judge, matchOutput, normalizeOutput } from './grade';

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
        strict: false,
      }),
    ).toBe('def f():\n    return 1\n\nprint(f())\n');
  });

  it('grades the program itself when there is no call', () => {
    expect(
      buildTestProgram('print("hi")', {
        id: 't1',
        call: '',
        expect: 'hi',
        hidden: false,
        strict: false,
      }),
    ).toBe('print("hi")');
  });
});

describe('matchOutput', () => {
  it.each([
    ['Hello, Shire!', 'Hello, Shire!\n', 'exact'],
    ['Hello, Shire!', 'hello, Shire!', 'close'], // capitalization
    ['Hello, Shire!', 'Hello Shire', 'close'], // punctuation
    ['Hello, Shire!', '  Hello,   Shire !', 'close'], // spacing
    ['[2,4]', '[2, 4]', 'close'],
    ['{"the":2}', "{'the': 2}", 'close'], // Python dict vs JSON quoting
    ['1\n2\n3', '1\n2\n3\n\n', 'exact'],
    ['Hello, Shire!', 'Hello, World!', 'none'], // different words
    ['55', '56', 'none'], // different numbers
    ['-2', '2', 'none'], // signs matter
    ['[]', '', 'none'],
    ['1\n2\n3', '123', 'none'], // line structure matters
    ['1\n2', '1\n2\n3', 'none'],
    ['', 'anything', 'none'],
  ] as const)('expected %j, got %j -> %s', (expected, actual, match) => {
    expect(matchOutput(actual, expected)).toBe(match);
  });

  it('accepts only exact output for strict tests', () => {
    expect(matchOutput('hello, Shire!', 'Hello, Shire!', true)).toBe('none');
    expect(matchOutput('Hello, Shire!', 'Hello, Shire!', true)).toBe('exact');
  });
});

describe('judge', () => {
  const test = { expect: '6', strict: false };
  it.each([
    [run({ stdout: '6\n' }), 'passed', true],
    [run({ stdout: '6.' }), 'passed', false],
    [run({ stdout: '7\n' }), 'wrong_output', false],
    [run({ stdout: '6\n', exitCode: 1 }), 'error', false],
    [run({ exitCode: null, timedOut: true }), 'timeout', false],
    [run({ exitCode: 137, oomKilled: true }), 'memory_limit', false],
    [run({ exitCode: null, truncated: true, stdout: '6' }), 'output_limit', false],
  ] as const)('%o -> %s', (result, status, exact) => {
    expect(judge(result, test)).toEqual({ status, exact });
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
      { id: 't1', call: 'print(f(1))', expect: '1', hidden: false, strict: false },
      { id: 't2', call: 'print(f(2))', expect: '2', hidden: true, strict: false },
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
          exact: true,
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
