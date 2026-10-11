import type { RunResult, SubmitResult, TestResult, TestStatus } from '@theshire/shared';
import type { Exercise, ExerciseTest } from '../content/types';
import type { Runner } from '../sandbox/types';

/** Ignores trailing whitespace per line and trailing blank lines; everything else must match. */
export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

/** The program for one test: the learner's code, then the test's call (if any). */
export function buildTestProgram(code: string, test: ExerciseTest): string {
  return test.call ? `${code}\n\n${test.call}\n` : code;
}

/** Characters a lenient comparison ignores: whitespace and everyday punctuation. */
const FORGIVEN = /[\s.,!?;:'"`]/g;

/** Non-empty lines, lowercased, with whitespace and everyday punctuation removed. */
function looseLines(text: string): string[] {
  return normalizeOutput(text)
    .split('\n')
    .map((line) => line.toLowerCase().replace(FORGIVEN, ''))
    .filter((line) => line.length > 0);
}

export type OutputMatch = 'exact' | 'close' | 'none';

/**
 * Compares program output with the expected output. An exact match ignores only trailing
 * whitespace. A close match also forgives capitalization, spacing, and punctuation, but the same
 * words, numbers, and line structure must be there. `strict` tests accept only exact matches.
 */
export function matchOutput(actual: string, expected: string, strict = false): OutputMatch {
  if (normalizeOutput(actual) === normalizeOutput(expected)) return 'exact';
  if (strict) return 'none';
  const want = looseLines(expected);
  if (want.length === 0) return 'none'; // nothing meaningful left to compare loosely
  const got = looseLines(actual);
  return got.length === want.length && got.every((line, i) => line === want[i]) ? 'close' : 'none';
}

export function judge(
  run: RunResult,
  test: Pick<ExerciseTest, 'expect' | 'strict'>,
): { status: TestStatus; exact: boolean } {
  if (run.timedOut) return { status: 'timeout', exact: false };
  if (run.oomKilled) return { status: 'memory_limit', exact: false };
  if (run.truncated) return { status: 'output_limit', exact: false };
  if (run.exitCode !== 0) return { status: 'error', exact: false };
  const match = matchOutput(run.stdout, test.expect, test.strict);
  return { status: match === 'none' ? 'wrong_output' : 'passed', exact: match === 'exact' };
}

/**
 * Runs the learner's code once per test, each in its own fresh sandbox, and compares stdout with
 * the expected output. Results for hidden tests carry only their status.
 */
export async function gradeSubmission(
  exercise: Exercise,
  code: string,
  runner: Runner,
): Promise<Omit<SubmitResult, 'lessonCompleted'>> {
  const tests = await Promise.all(
    exercise.tests.map(async (test): Promise<TestResult> => {
      const run = await runner.run({
        language: exercise.language,
        code: buildTestProgram(code, test),
      });
      const { status, exact } = judge(run, test);
      const passed = status === 'passed';
      if (test.hidden) return { id: test.id, hidden: true, status, passed };
      return {
        id: test.id,
        hidden: false,
        status,
        passed,
        exact,
        call: test.call,
        expect: test.expect,
        stdout: run.stdout,
        stderr: run.stderr,
        durationMs: run.durationMs,
      };
    }),
  );

  const passedCount = tests.filter((t) => t.passed).length;
  return {
    exerciseId: exercise.id,
    passed: passedCount === tests.length,
    passedCount,
    totalCount: tests.length,
    tests,
  };
}
